import { ChannelAdapter, OutboundOptions } from './base';
import { ChannelType, NormalizedMessage } from '../types';
import { env } from '../config/env';

export class WhatsAppAdapter implements ChannelAdapter {
  readonly channel: ChannelType = 'whatsapp';

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
      const change = entry?.changes?.[0]?.value;
      const message = change?.messages?.[0];
      const contact = change?.contacts?.[0];

      if (!message) return null;

      let messageText = '';
      if (message.type === 'text') {
        messageText = message.text?.body || '';
      } else if (message.type === 'button') {
        messageText = message.button?.text || '';
      } else if (message.type === 'interactive') {
        messageText =
          message.interactive?.button_reply?.title ||
          message.interactive?.list_reply?.title ||
          '';
      } else {
        messageText = `[Received ${message.type}]`;
      }

      return {
        id: message.id || `wa_${Date.now()}`,
        channel: this.channel,
        channelUserId: message.from,
        senderName: contact?.profile?.name || message.from,
        messageText: messageText.trim(),
        timestamp: message.timestamp ? Number(message.timestamp) * 1000 : Date.now(),
        metadata: {
          whatsappMessageId: message.id,
          phoneNumberId: change?.metadata?.phone_number_id,
          rawType: message.type,
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
    if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      console.log(`[WhatsApp Outbound Simulation] To: ${channelUserId} | Text: "${messageText}"`);
      return true;
    }

    try {
      const url = `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      const body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: channelUserId,
        type: 'text',
        text: { body: messageText },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      return res.ok;
    } catch (err) {
      console.error('[WhatsApp Send Error]', err);
      return false;
    }
  }
}
