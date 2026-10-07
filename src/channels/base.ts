import { ChannelType, NormalizedMessage } from '../types';

export interface OutboundOptions {
  replyToMessageId?: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelAdapter {
  readonly channel: ChannelType;

  verifyWebhook(query: Record<string, string>): {
    isValid: boolean;
    challenge?: string;
  };

  normalize(payload: unknown): NormalizedMessage | null;

  sendResponse(
    channelUserId: string,
    messageText: string,
    options?: OutboundOptions
  ): Promise<boolean>;
}
