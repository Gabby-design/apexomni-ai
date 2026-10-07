import { ChannelAdapter, OutboundOptions } from './base';
import { ChannelType, NormalizedMessage } from '../types';
import { env } from '../config/env';

export class TikTokAdapter implements ChannelAdapter {
  readonly channel: ChannelType = 'tiktok';

  verifyWebhook(query: Record<string, string>): { isValid: boolean; challenge?: string } {
    // TikTok challenge check
    const challenge = query['challenge'];
    if (challenge) {
      return { isValid: true, challenge };
    }
    return { isValid: true };
  }

  normalize(payload: any): NormalizedMessage | null {
    try {
      // TikTok Business Messaging event structure
      const event = payload?.event || payload?.entry?.[0];
      const message = payload?.message || event?.message;
      const openId = payload?.from_user_id || event?.from_user_id || payload?.user?.open_id;

      if (!message && !payload?.text) return null;

      const messageText = typeof message === 'string' ? message : message?.text || payload?.text || '';
      const userId = openId || payload?.open_id || `tt_user_${Date.now()}`;

      return {
        id: payload?.msg_id || `tt_msg_${Date.now()}`,
        channel: this.channel,
        channelUserId: userId,
        senderName: payload?.user?.nickname || `TikTok_${userId.slice(-4)}`,
        messageText: messageText.trim(),
        timestamp: payload?.create_time ? Number(payload.create_time) * 1000 : Date.now(),
        metadata: {
          conversationId: payload?.conversation_id,
          messageType: payload?.message_type || 'text',
        },
        rawPayload: payload,
      };
    } catch {
      return null;
    }
  }

  async sendResponse(
    channelUserId: string,
    messageText: string,
    options?: OutboundOptions
  ): Promise<boolean> {
    if (!env.TIKTOK_ACCESS_TOKEN) {
      console.log(`[TikTok Outbound Simulation] To: ${channelUserId} | Text: "${messageText}"`);
      return true;
    }

    try {
      const url = 'https://business-api.tiktok.com/open_api/v1.3/im/message/send/';
      const body = {
        to_user_id: channelUserId,
        message_type: 'text',
        content: { text: messageText },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Access-Token': env.TIKTOK_ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      return res.ok;
    } catch (err) {
      console.error('[TikTok Send Error]', err);
      return false;
    }
  }
}
