import { ConversationSession, LeadProfile, ChatMessage, BookingConfirmation } from '../types';

export interface StorageHealthInfo {
  driver: 'postgres' | 'json_file';
  connected: boolean;
  details?: string;
}

export interface StorageAdapter {
  driverName: 'postgres' | 'json_file';

  /** Initialize tables, schemas, or directory buffers */
  init(): Promise<void>;

  /** Message deduplication */
  hasMessage(messageId: string): Promise<boolean>;
  addMessageId(messageId: string): Promise<void>;

  /** Patient / Client leads */
  saveLead(lead: LeadProfile): Promise<void>;
  getLead(leadId: string): Promise<LeadProfile | undefined>;
  findLeadByChannelUser(channel: string, channelUserId: string): Promise<LeadProfile | undefined>;

  /** Conversation sessions & chat histories */
  saveSession(session: ConversationSession): Promise<void>;
  getSession(sessionId: string): Promise<ConversationSession | undefined>;
  getSessionByChannelUser(channel: string, channelUserId: string): Promise<ConversationSession | undefined>;
  addSessionMessage(sessionId: string, message: ChatMessage): Promise<void>;
  updateSessionStatus(sessionId: string, status: ConversationSession['status']): Promise<void>;

  /** Appointments & Calendar slot locks */
  saveBooking(booking: BookingConfirmation): Promise<void>;
  getBooking(bookingId: string): Promise<BookingConfirmation | undefined>;
  getAllBookings(): Promise<BookingConfirmation[]>;
  updateDepositStatus(bookingId: string, status: BookingConfirmation['depositStatus']): Promise<boolean>;

  /** Diagnostic and teardown */
  getHealth(): Promise<StorageHealthInfo>;
  close?(): Promise<void>;
}
