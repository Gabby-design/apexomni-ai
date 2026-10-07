import { ChannelType } from '../types';
import { ChannelAdapter } from './base';
import { WhatsAppAdapter } from './whatsapp';
import { InstagramAdapter } from './instagram';
import { FacebookAdapter } from './facebook';
import { TikTokAdapter } from './tiktok';
import { TwitterAdapter } from './twitter';
import { WebConciergeAdapter } from './web';

export class ChannelRegistry {
  private adapters: Map<ChannelType, ChannelAdapter> = new Map();

  constructor() {
    this.register(new WhatsAppAdapter());
    this.register(new InstagramAdapter());
    this.register(new FacebookAdapter());
    this.register(new TikTokAdapter());
    this.register(new TwitterAdapter());
    this.register(new WebConciergeAdapter());
  }

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.channel, adapter);
  }

  get(channel: ChannelType): ChannelAdapter | undefined {
    return this.adapters.get(channel);
  }

  getWebAdapter(): WebConciergeAdapter {
    return this.adapters.get('web') as WebConciergeAdapter;
  }
}

export const channelRegistry = new ChannelRegistry();
export {
  ChannelAdapter,
  WhatsAppAdapter,
  InstagramAdapter,
  FacebookAdapter,
  TikTokAdapter,
  TwitterAdapter,
  WebConciergeAdapter,
};
