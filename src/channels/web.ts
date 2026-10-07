import { WebSocket } from 'ws';
import { ChannelAdapter, OutboundOptions } from './base';
import { ChannelType, NormalizedMessage } from '../types';

export class WebConciergeAdapter implements ChannelAdapter {
  readonly channel: ChannelType = 'web';
  private activeSockets: Map<string, WebSocket> = new Map();

  registerSocket(sessionId: string, socket: WebSocket): void {
    this.activeSockets.set(sessionId, socket);
    socket.on('close', () => {
      this.activeSockets.delete(sessionId);
    });
  }

  verifyWebhook(_query: Record<string, string>): { isValid: boolean; challenge?: string } {
    return { isValid: true };
  }

  normalize(payload: any): NormalizedMessage | null {
    try {
      const sessionId = payload?.sessionId || payload?.channelUserId || `web_${Date.now()}`;
      const text = payload?.message || payload?.text || '';

      if (!text) return null;

      return {
        id: payload?.id || `web_msg_${Date.now()}`,
        channel: this.channel,
        channelUserId: sessionId,
        senderName: payload?.senderName || 'Web Visitor',
        messageText: text.trim(),
        timestamp: payload?.timestamp || Date.now(),
        metadata: {
          userAgent: payload?.userAgent,
          pageUrl: payload?.pageUrl,
          referrer: payload?.referrer,
          ip: payload?.ip,
          timezone: payload?.timezone || 'UTC',
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
    const socket = this.activeSockets.get(channelUserId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: 'assistant_message',
          channelUserId,
          message: messageText,
          timestamp: Date.now(),
          options,
        })
      );
      return true;
    }

    console.log(`[Web Concierge Outbound] Session: ${channelUserId} | Text: "${messageText}"`);
    return true;
  }
}
