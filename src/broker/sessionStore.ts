import { v4 as uuidv4 } from 'uuid';
import {
  ChannelType,
  ConversationSession,
  LeadProfile,
  ChatMessage,
  LeadQualificationStatus,
} from '../types';
import { dbService } from '../db';

export class SessionStore {
  // Deduplication / Idempotency
  isMessageProcessed(messageId: string): boolean {
    return dbService.hasMessage(messageId);
  }

  markMessageProcessed(messageId: string): void {
    dbService.addMessageId(messageId);
  }

  // Identity Resolution
  getOrCreateLead(channel: ChannelType, channelUserId: string, senderName?: string): LeadProfile {
    let existing = dbService.findLeadByChannelUser(channel, channelUserId);

    if (existing) {
      if (senderName && !existing.fullName) {
        existing.fullName = senderName;
        existing.updatedAt = Date.now();
        dbService.saveLead(existing);
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

    dbService.saveLead(newLead);
    return newLead;
  }

  getLead(leadId: string): LeadProfile | undefined {
    return dbService.getLead(leadId);
  }

  updateLead(leadId: string, patch: Partial<LeadProfile>): LeadProfile | undefined {
    const lead = dbService.getLead(leadId);
    if (!lead) return undefined;

    Object.assign(lead, patch, { updatedAt: Date.now() });

    // Auto-update qualification status if criteria met
    if (lead.fullName && (lead.phone || lead.email) && lead.requestedService) {
      lead.qualificationStatus = 'qualified';
    }

    dbService.saveLead(lead);
    return lead;
  }

  // Conversation Session Management
  getOrCreateSession(channel: ChannelType, channelUserId: string, leadId: string): ConversationSession {
    let session = dbService.getSessionByChannelUser(channel, channelUserId);

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
      dbService.saveSession(session);
    }

    return session;
  }

  addMessage(sessionId: string, message: ChatMessage): void {
    dbService.addSessionMessage(sessionId, message);
  }

  setSessionStatus(sessionId: string, status: ConversationSession['status']): void {
    dbService.updateSessionStatus(sessionId, status);
  }
}

export const sessionStore = new SessionStore();
