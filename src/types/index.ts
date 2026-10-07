export type ChannelType =
  | 'whatsapp'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'twitter'
  | 'web';

export type SessionStatus = 'active' | 'escalated' | 'completed' | 'paused';

export type LeadQualificationStatus =
  | 'unqualified'
  | 'in_progress'
  | 'qualified'
  | 'disqualified';

export interface NormalizedMessage {
  id: string;
  channel: ChannelType;
  channelUserId: string;
  senderName?: string;
  messageText: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  rawPayload?: unknown;
}

export interface LeadProfile {
  id: string;
  channel: ChannelType;
  channelUserId: string;
  fullName?: string;
  phone?: string;
  email?: string;
  requestedService?: string;
  urgency?: 'immediate' | 'within_week' | 'flexible';
  budgetOrInsurance?: string;
  qualificationStatus: LeadQualificationStatus;
  estimatedValue?: number;
  notes?: string[];
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

export interface ConversationSession {
  id: string;
  channel: ChannelType;
  channelUserId: string;
  leadId: string;
  status: SessionStatus;
  history: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  lastMessageTimestamp: number;
}

export interface CalendarSlot {
  slotId: string;
  startTime: string;
  endTime: string;
  serviceType: string;
  providerName?: string;
}

export interface BookingConfirmation {
  bookingId: string;
  slotId: string;
  clientName: string;
  serviceType: string;
  startTime: string;
  depositStatus: 'collected' | 'hold' | 'waived' | 'pending';
  confirmationUrl: string;
}

export interface StaffAlertPayload {
  conversationId: string;
  leadId: string;
  channel: ChannelType;
  channelUserId: string;
  reason: string;
  priorityLevel: 'low' | 'medium' | 'high' | 'critical';
  summary?: string;
  timestamp: number;
}
