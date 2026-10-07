import crypto from 'crypto';
import { ChannelAdapter, OutboundOptions } from './base';
import { ChannelType, NormalizedMessage } from '../types';
import { env } from '../config/env';

export class TwitterAdapter implements ChannelAdapter {
  readonly channel: ChannelType = 'twitter';

  verifyWebhook(query: Record<string, string>): { isValid: boolean; challenge?: string } {
    const crcToken = query['crc_token'];
    if (!crcToken) {
      return { isValid: false };
    }

    if (!env.TWITTER_API_SECRET) {
      // In simulation mode without secret
      return { isValid: true, challenge: JSON.stringify({ response_token: `sha256=${crcToken}` }) };
    }

    const hmac = crypto
      .createHmac('sha256', env.TWITTER_API_SECRET)
      .update(crcToken)
      .digest('base64');

    return {
      isValid: true,
      challenge: JSON.stringify({ response_token: `sha256=${hmac}` }),
    };
  }

  normalize(payload: any): NormalizedMessage | null {
    try {
      const dmEvent = payload?.direct_message_events?.[0];
      if (!dmEvent || dmEvent.type !== 'message_create') return null;

      const messageCreate = dmEvent.message_create;
      const senderId = messageCreate.sender_id;
      const messageText = messageCreate.message_data?.text || '';

      return {
        id: dmEvent.id || `x_${Date.now()}`,
        channel: this.channel,
        channelUserId: senderId,
        senderName: `X_User_${senderId.slice(-4)}`,
        messageText: messageText.trim(),
        timestamp: dmEvent.created_timestamp ? Number(dmEvent.created_timestamp) : Date.now(),
        metadata: {
          recipientId: messageCreate.target?.recipient_id,
          entities: messageCreate.message_data?.entities,
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
    if (!env.TWITTER_BEARER_TOKEN) {
      console.log(`[Twitter/X Outbound Simulation] To: ${channelUserId} | Text: "${messageText}"`);
      return true;
    }

    try {
      const url = `https://api.twitter.com/2/dm_conversations/with_participant_id:${channelUserId}/messages`;
      const body = {
        text: messageText,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.TWITTER_BEARER_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      return res.ok;
    } catch (err) {
      console.error('[Twitter/X Send Error]', err);
      return false;
    }
  }
}
