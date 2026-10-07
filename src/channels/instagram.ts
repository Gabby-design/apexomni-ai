import { ChannelAdapter, OutboundOptions } from './base';
import { ChannelType, NormalizedMessage } from '../types';
import { env } from '../config/env';

export class InstagramAdapter implements ChannelAdapter {
  readonly channel: ChannelType = 'instagram';

  verifyWebhook(query: Record<string, string>): { isValid: boolean; challenge?: string } {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
      return { isValid: true, challenge };
    }
    return { isValid: false };
  }

  normalize(payload: any): NormalizedMessage | null {
    try {
      const entry = payload?.entry?.[0];
      const messaging = entry?.messaging?.[0];

      if (!messaging || !messaging.message) return null;

      const senderId = messaging.sender?.id;
      const messageObj = messaging.message;

      let messageText = messageObj.text || '';
      if (!messageText && messageObj.attachments) {
        messageText = `[Sent Attachment: ${messageObj.attachments[0]?.type || 'media'}]`;
      }

      return {
        id: messageObj.mid || `ig_${Date.now()}`,
        channel: this.channel,
        channelUserId: senderId,
        senderName: `IG_${senderId.slice(-4)}`,
        messageText: messageText.trim(),
        timestamp: messaging.timestamp || Date.now(),
        metadata: {
          mid: messageObj.mid,
          isEcho: Boolean(messageObj.is_echo),
          recipientId: messaging.recipient?.id,
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
    if (!env.INSTAGRAM_PAGE_ACCESS_TOKEN) {
      console.log(`[Instagram Outbound Simulation] To: ${channelUserId} | Text: "${messageText}"`);
      return true;
    }

    try {
      const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${env.INSTAGRAM_PAGE_ACCESS_TOKEN}`;
      const body = {
        recipient: { id: channelUserId },
        message: { text: messageText },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      return res.ok;
    } catch (err) {
      console.error('[Instagram Send Error]', err);
      return false;
    }
  }
}
