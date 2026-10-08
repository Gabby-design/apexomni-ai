import { NormalizedMessage, ConversationSession, LeadProfile } from '../types';
import { sessionStore } from './sessionStore';
import { agentEngine } from '../agent/engine';
import { channelRegistry } from '../channels';

export interface BrokerResult {
  status: 'processed' | 'duplicate_ignored' | 'error';
  sessionId?: string;
  leadId?: string;
  responseSent?: boolean;
  replyText?: string;
  error?: string;
}

export class ConversationBroker {
  async handleInbound(message: NormalizedMessage): Promise<BrokerResult> {
    try {
      // 1. Deduplication / Idempotency check
      if (await sessionStore.isMessageProcessed(message.id)) {
        return { status: 'duplicate_ignored' };
      }
      await sessionStore.markMessageProcessed(message.id);

      // 2. Identity Resolution
      const lead = await sessionStore.getOrCreateLead(
        message.channel,
        message.channelUserId,
        message.senderName
      );

      // 3. Session Resolution
      const session = await sessionStore.getOrCreateSession(
        message.channel,
        message.channelUserId,
        lead.id
      );

      // 4. Record user message
      await sessionStore.addMessage(session.id, {
        role: 'user',
        content: message.messageText,
        timestamp: message.timestamp,
      });

      // 5. Agent Orchestration
      const replyText = await agentEngine.processMessage(
        session,
        lead,
        message.messageText
      );

      // 6. Record assistant reply
      await sessionStore.addMessage(session.id, {
        role: 'assistant',
        content: replyText,
        timestamp: Date.now(),
      });

      // 7. Outbound Response Dispatching
      const adapter = channelRegistry.get(message.channel);
      let responseSent = false;
      if (adapter) {
        responseSent = await adapter.sendResponse(message.channelUserId, replyText);
      }

      return {
        status: 'processed',
        sessionId: session.id,
        leadId: lead.id,
        responseSent,
        replyText,
      };
    } catch (err: any) {
      console.error('[Broker Processing Error]', err);
      return {
        status: 'error',
        error: err?.message || 'Unknown broker error',
      };
    }
  }
}

export const conversationBroker = new ConversationBroker();
