import { GoogleGenAI } from '@google/genai';
import { ConversationSession, LeadProfile, ChatMessage } from '../types';
import { buildSystemPromptWithLeadContext } from './persona';
import { AGENT_TOOLS } from './tools';
import { ToolRunner } from './toolRunner';
import { sessionStore } from '../broker/sessionStore';
import { env } from '../config/env';

export class AgentEngine {
  private ai: GoogleGenAI | null = null;

  constructor() {
    if (env.GEMINI_API_KEY) {
      this.ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    }
  }

  // Prunes context to preserve tokens and focus (keeps last 20 messages per Master Prompt Pack)
  private pruneHistory(history: ChatMessage[], maxMessages = 20): ChatMessage[] {
    if (history.length <= maxMessages) return history;
    return history.slice(-maxMessages);
  }

  private summarizeLead(lead: LeadProfile): string {
    return [
      `- Lead ID: ${lead.id}`,
      `- Name: ${lead.fullName || 'Unknown'}`,
      `- Phone: ${lead.phone || 'Not provided'}`,
      `- Email: ${lead.email || 'Not provided'}`,
      `- Requested Service: ${lead.requestedService || 'Not specified'}`,
      `- Urgency: ${lead.urgency || 'Not specified'}`,
      `- Qualification Status: ${lead.qualificationStatus}`,
      `- Channel: ${lead.channel} (${lead.channelUserId})`,
    ].join('\n');
  }

  async processMessage(
    session: ConversationSession,
    lead: LeadProfile,
    inboundText: string
  ): Promise<string> {
    const leadSummary = this.summarizeLead(lead);
    const systemInstruction = buildSystemPromptWithLeadContext(leadSummary);

    // If session is escalated, do not auto-reply
    if (session.status === 'escalated') {
      return 'A clinic director is currently handling this conversation. You will receive an update shortly.';
    }

    // Check for explicit escalation request
    const lowerInbound = inboundText.toLowerCase();
    if (
      lowerInbound.includes('human') ||
      lowerInbound.includes('talk to someone') ||
      lowerInbound.includes('real person') ||
      lowerInbound.includes('representative')
    ) {
      await ToolRunner.escalateToStaff({
        leadId: lead.id,
        channel: session.channel,
        reason: 'Customer explicitly demanded human interaction',
        urgencyLevel: 'high',
      });
      session.status = 'escalated';
      return 'I completely understand. I have notified our clinical concierge director to take over immediately. A team member will assist you right away.';
    }

    // If Gemini API Key is configured, use Google GenAI
    if (this.ai && env.GEMINI_API_KEY) {
      try {
        return await this.callGemini(session, lead, inboundText, systemInstruction);
      } catch (err) {
        console.error('[Gemini API Call Error - Fallback to deterministic agent]', err);
      }
    }

    // High-performance deterministic fallback agent
    return await this.fallbackReceptionistLogic(session, lead, inboundText);
  }

  private async callGemini(
    session: ConversationSession,
    lead: LeadProfile,
    inboundText: string,
    systemInstruction: string
  ): Promise<string> {
    if (!this.ai) throw new Error('Gemini client not initialized');

    const pruned = this.pruneHistory(session.history);
    const contents: any[] = [];

    for (const msg of pruned) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: inboundText }],
    });

    const geminiFunctionDeclarations = AGENT_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    // Master Prompt Pack weights
    let activeModel = 'gemini-3.5-flash-lite';
    const configWeights = {
      systemInstruction,
      temperature: 0.4,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 300,
      candidateCount: 1,
      tools: [{ functionDeclarations: geminiFunctionDeclarations as any }],
    };

    let response: any;
    try {
      response = await this.ai.models.generateContent({
        model: activeModel,
        contents,
        config: configWeights,
      });
    } catch (modelErr: any) {
      console.warn(`[${activeModel} fallback to gemini-3.8-flash]`, modelErr.message);
      activeModel = 'gemini-3.8-flash';
      response = await this.ai.models.generateContent({
        model: activeModel,
        contents,
        config: configWeights,
      });
    }

    const candidate = response.candidates?.[0];
    const functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall);

    if (functionCalls && functionCalls.length > 0) {
      // 1. Append model turn containing tool call
      contents.push(candidate.content);

      // 2. Execute tools and format functionResponse parts
      const functionResponseParts: any[] = [];
      for (const fc of functionCalls) {
        const call: any = (fc as any).functionCall;
        if (!call) continue;
        console.log(`[Executing Function Call: ${call.name}]`, call.args);

        let result: any = { status: 'recorded' };
        if (call.name === 'check_availability' || call.name === 'checkAvailability') {
          result = await ToolRunner.checkAvailability(call.args || {});
        } else if (call.name === 'create_booking' || call.name === 'bookAppointment') {
          result = await ToolRunner.bookAppointment(call.args || {});
        } else if (call.name === 'send_payment_link') {
          result = await ToolRunner.sendPaymentLink(call.args || {});
        } else if (call.name === 'reschedule_booking') {
          result = await ToolRunner.rescheduleBooking(call.args || {});
        } else if (call.name === 'cancel_booking') {
          result = await ToolRunner.cancelBooking(call.args || {});
        } else if (call.name === 'save_lead' || call.name === 'updateLeadProfile') {
          result = await ToolRunner.saveLead({ ...call.args, leadId: lead.id });
        } else if (call.name === 'handoff_to_human' || call.name === 'escalateToStaff') {
          result = await ToolRunner.handoffToHuman({ ...call.args, leadId: lead.id, channel: session.channel });
          session.status = 'escalated';
          return 'I completely understand. I have notified our clinical concierge director to take over immediately. A team member will assist you right away.';
        }

        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: result,
          },
        });
      }

      // 3. Append tool result as user turn
      contents.push({
        role: 'user',
        parts: functionResponseParts,
      });

      // 4. Request the final natural language answer
      try {
        const followUp = await this.ai.models.generateContent({
          model: activeModel,
          contents,
          config: {
            systemInstruction,
            temperature: 0.4,
            topP: 0.9,
            maxOutputTokens: 300,
          },
        });
        if (followUp.text && followUp.text.trim()) {
          return followUp.text.trim();
        }
      } catch (err: any) {
        console.error('[Gemini Tool Follow-up Error]', err?.message);
      }
    }

    if (response.text && response.text.trim()) {
      return response.text.trim();
    }

    return await this.fallbackReceptionistLogic(session, lead, inboundText);
  }

  private async fallbackReceptionistLogic(
    session: ConversationSession,
    lead: LeadProfile,
    text: string
  ): Promise<string> {
    const lower = text.toLowerCase();

    // 1. Phone extraction
    const phoneMatch = text.match(/(\+?\d{1,2}\s?)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/);
    if (phoneMatch) {
      lead.phone = phoneMatch[0].trim();
      sessionStore.updateLead(lead.id, { phone: lead.phone });
    }

    // 2. Email extraction
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      lead.email = emailMatch[0].trim();
      sessionStore.updateLead(lead.id, { email: lead.email });
    }

    // 3. Service detection
    if (lower.includes('botox') || lower.includes('filler') || lower.includes('inject')) {
      lead.requestedService = 'Injectables & Aesthetics';
      sessionStore.updateLead(lead.id, { requestedService: lead.requestedService });
    } else if (lower.includes('skin') || lower.includes('laser') || lower.includes('facial') || lower.includes('contour')) {
      lead.requestedService = 'Facial Contouring & Laser';
      sessionStore.updateLead(lead.id, { requestedService: lead.requestedService });
    } else if (lower.includes('sculpt') || lower.includes('body')) {
      lead.requestedService = 'Body Contouring';
      sessionStore.updateLead(lead.id, { requestedService: lead.requestedService });
    }

    // 4. Downtime & recovery questions
    if (lower.includes('downtime') || lower.includes('recover') || lower.includes('heal') || lower.includes('swelling')) {
      return 'For our injectables and contouring treatments, downtime is minimal—most patients resume daily activities immediately, with any mild swelling resolving within 24-48 hours. Would you like to review available appointment times with Dr. Vance this week?';
    }

    // 5. Pricing questions
    if (lower.includes('price') || lower.includes('cost') || lower.includes('how much') || lower.includes('fee')) {
      return 'Our comprehensive consultation and 3D facial imaging with Dr. Vance is $150, which is credited entirely toward any treatment you proceed with. Which procedure are you most interested in exploring?';
    }

    // 6. Medical / diagnostic disclaimer check
    if (lower.includes('diagnos') || lower.includes('rash') || lower.includes('infected') || lower.includes('pain')) {
      return 'While I cannot offer clinical diagnoses over chat, our medical directors will review your exact needs during a private in-clinic evaluation. Would you like to check available consultation times this week?';
    }

    // 7. Booking slot request or confirmation
    if (lower.includes('book') || lower.includes('slot') || lower.includes('schedule') || lower.includes('11:30') || lower.includes('2:00')) {
      if (!lead.phone) {
        return 'We would be delighted to reserve that appointment for you with Dr. Vance. Could you please share the best mobile number to confirm your booking?';
      }

      const booking = await ToolRunner.bookAppointment({
        slotId: 'slot_direct_1',
        leadDetails: {
          fullName: lead.fullName || 'Valued Guest',
          phone: lead.phone,
          email: lead.email,
        },
        serviceType: lead.requestedService || 'Aesthetic Consultation',
      });

      return `Your private consultation for ${booking.serviceType} is confirmed for ${booking.startTime}! A confirmation link has been sent to ${lead.phone}.`;
    }

    // 8. Availability check
    if (lower.includes('available') || lower.includes('when') || lower.includes('tomorrow') || lower.includes('time')) {
      await ToolRunner.checkAvailability({
        dateRange: 'this week',
        serviceType: lead.requestedService || 'Aesthetic Consultation',
      });
      return `We currently have two priority openings: tomorrow at 11:30 AM and Thursday at 2:00 PM with Dr. Vance. Would either of those suit your schedule?`;
    }

    // 9. Initial greeting variations
    if (lower === 'hi' || lower === 'hello' || lower === 'hey' || lower.startsWith('good')) {
      const greetings = [
        'Good day and welcome to ApexOmni Clinic. It is a pleasure to connect with you. Which aesthetic or wellness goals can we help you achieve today?',
        'Welcome to ApexOmni. Our clinical concierge team is at your service. Are you looking into facial rejuvenation, injectables, or body contouring?',
      ];
      return greetings[session.history.length % greetings.length];
    }

    if (lead.requestedService) {
      return `Thank you for sharing that with us. We have openings this week for ${lead.requestedService}. Would you like to view our earliest available slots with Dr. Vance?`;
    }

    return 'Welcome to ApexOmni Clinic. Which aesthetic or wellness procedure may we assist you with today?';
  }
}

export const agentEngine = new AgentEngine();
