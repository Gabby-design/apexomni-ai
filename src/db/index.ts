import fs from 'fs';
import path from 'path';
import { ConversationSession, LeadProfile, ChatMessage, BookingConfirmation } from '../types';
import { env } from '../config/env';

export interface DatabaseState {
  leads: Record<string, LeadProfile>;
  sessions: Record<string, ConversationSession>;
  appointments: Record<string, BookingConfirmation>;
  processedMessageIds: string[];
}

export class DatabaseService {
  private dbPath: string;
  private state: DatabaseState;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = path.join(dataDir, 'apexomni.json');
    this.state = this.load();
  }

  private load(): DatabaseState {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.appointments) parsed.appointments = {};
        return parsed;
      }
    } catch (err) {
      console.error('[DB Load Warning - Initializing Fresh State]', err);
    }
    return {
      leads: {},
      sessions: {},
      appointments: {},
      processedMessageIds: [],
    };
  }

  ensureSynced(): void {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed) {
          if (!parsed.appointments) parsed.appointments = {};
          if (!parsed.leads) parsed.leads = {};
          if (!parsed.sessions) parsed.sessions = {};
          if (!parsed.processedMessageIds) parsed.processedMessageIds = [];
          this.state = parsed;
        }
      }
    } catch {
      // Keep existing in-memory state on temporary lock
    }
  }

  saveSync(): void {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB Save Error]', err);
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveSync();
    }, 50);
  }

  // Deduplication
  hasMessage(messageId: string): boolean {
    this.ensureSynced();
    return this.state.processedMessageIds.includes(messageId);
  }

  addMessageId(messageId: string): void {
    this.state.processedMessageIds.push(messageId);
    if (this.state.processedMessageIds.length > 5000) {
      this.state.processedMessageIds.shift();
    }
    this.scheduleSave();
  }

  // Leads
  saveLead(lead: LeadProfile): void {
    this.state.leads[lead.id] = lead;
    this.scheduleSave();
  }

  getLead(leadId: string): LeadProfile | undefined {
    return this.state.leads[leadId];
  }

  findLeadByChannelUser(channel: string, channelUserId: string): LeadProfile | undefined {
    return Object.values(this.state.leads).find(
      (l) => l.channel === channel && l.channelUserId === channelUserId
    );
  }

  // Sessions
  saveSession(session: ConversationSession): void {
    this.state.sessions[session.id] = session;
    this.scheduleSave();
  }

  getSessionByChannelUser(channel: string, channelUserId: string): ConversationSession | undefined {
    return Object.values(this.state.sessions).find(
      (s) => s.channel === channel && s.channelUserId === channelUserId
    );
  }

  addSessionMessage(sessionId: string, message: ChatMessage): void {
    const session = this.state.sessions[sessionId];
    if (session) {
      session.history.push(message);
      session.updatedAt = Date.now();
      session.lastMessageTimestamp = message.timestamp;
      this.scheduleSave();
    }
  }

  updateSessionStatus(sessionId: string, status: ConversationSession['status']): void {
    const session = this.state.sessions[sessionId];
    if (session) {
      session.status = status;
      session.updatedAt = Date.now();
      this.scheduleSave();
    }
  }

  // Appointments / Slot Locks
  saveBooking(booking: BookingConfirmation): void {
    this.ensureSynced();
    if (!this.state.appointments) this.state.appointments = {};
    this.state.appointments[booking.bookingId] = booking;
    this.saveSync();
  }

  getBooking(bookingId: string): BookingConfirmation | undefined {
    this.ensureSynced();
    return this.state.appointments?.[bookingId];
  }

  getAllBookings(): BookingConfirmation[] {
    this.ensureSynced();
    return Object.values(this.state.appointments || {});
  }

  updateDepositStatus(bookingId: string, status: BookingConfirmation['depositStatus']): boolean {
    this.ensureSynced();
    if (!this.state.appointments || !this.state.appointments[bookingId]) return false;
    this.state.appointments[bookingId].depositStatus = status;
    this.saveSync();
    return true;
  }
}

export const dbService = new DatabaseService();
