import { v4 as uuidv4 } from 'uuid';
import {
  ChannelType,
  ConversationSession,
  LeadProfile,
  ChatMessage,
} from '../types';
import { dbService } from '../db';

export class SessionStore {
  // Deduplication / Idempotency
  async isMessageProcessed(messageId: string): Promise<boolean> {
    return await dbService.hasMessage(messageId);
  }

  async markMessageProcessed(messageId: string): Promise<void> {
    await dbService.addMessageId(messageId);
  }

  // Identity Resolution
  async getOrCreateLead(channel: ChannelType, channelUserId: string, senderName?: string): Promise<LeadProfile> {
    let existing = await dbService.findLeadByChannelUser(channel, channelUserId);

    if (existing) {
      if (senderName && !existing.fullName) {
        existing.fullName = senderName;
        existing.updatedAt = Date.now();
        await dbService.saveLead(existing);
      }
      return existing;
    }

    const leadId = `lead_${uuidv4().slice(0, 8)}`;
    const newLead: LeadProfile = {
      id: leadId,
      channel,
      channelUserId,
      fullName: senderName,
      qualificationStatus: 'in_progress',
      notes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await dbService.saveLead(newLead);
    return newLead;
  }

  async getLead(leadId: string): Promise<LeadProfile | undefined> {
    return await dbService.getLead(leadId);
  }

  async updateLead(leadId: string, patch: Partial<LeadProfile>): Promise<LeadProfile | undefined> {
    const lead = await dbService.getLead(leadId);
    if (!lead) return undefined;

    Object.assign(lead, patch, { updatedAt: Date.now() });

    // Auto-update qualification status if criteria met
    if (lead.fullName && (lead.phone || lead.email) && lead.requestedService) {
      lead.qualificationStatus = 'qualified';
    }

    await dbService.saveLead(lead);
    return lead;
  }

  // Conversation Session Management
  async getOrCreateSession(channel: ChannelType, channelUserId: string, leadId: string): Promise<ConversationSession> {
    let session = await dbService.getSessionByChannelUser(channel, channelUserId);

    if (!session) {
      session = {
        id: `sess_${uuidv4().slice(0, 8)}`,
        channel,
        channelUserId,
        leadId,
        status: 'active',
        history: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageTimestamp: Date.now(),
      };
      await dbService.saveSession(session);
    }

    return session;
  }

  async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
    await dbService.addSessionMessage(sessionId, message);
  }

  async setSessionStatus(sessionId: string, status: ConversationSession['status']): Promise<void> {
    await dbService.updateSessionStatus(sessionId, status);
  }
}

export const sessionStore = new SessionStore();
