import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConversationSession, LeadProfile, ChatMessage, BookingConfirmation } from '../types';
import { StorageAdapter, StorageHealthInfo } from './storageAdapter';

export interface DatabaseState {
  leads: Record<string, LeadProfile>;
  sessions: Record<string, ConversationSession>;
  appointments: Record<string, BookingConfirmation>;
  processedMessageIds: string[];
}

export class JsonStorageAdapter implements StorageAdapter {
  readonly driverName = 'json_file';
  private dbPath: string;
  private state: DatabaseState;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    let dataDir = path.join(process.cwd(), 'data');

    if (isServerless) {
      dataDir = path.join(os.tmpdir(), 'apexomni-data');
    }

    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch {
      dataDir = os.tmpdir();
    }

    this.dbPath = path.join(dataDir, 'apexomni.json');
    this.state = this.load();
  }

  async init(): Promise<void> {
    this.ensureSynced();
  }

  private load(): DatabaseState {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.appointments) parsed.appointments = {};
        if (!parsed.leads) parsed.leads = {};
        if (!parsed.sessions) parsed.sessions = {};
        if (!parsed.processedMessageIds) parsed.processedMessageIds = [];
        return parsed;
      }
    } catch {
      // Keep fresh in-memory state
    }
    return {
      leads: {},
      sessions: {},
      appointments: {},
      processedMessageIds: [],
    };
  }

  private ensureSynced(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
      this.saveSync();
      return;
    }
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
      // Keep existing state
    }
  }

  private saveSync(): void {
    try {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = null;
      }
      fs.writeFileSync(this.dbPath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('[JsonStorageAdapter Save Error]', err);
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveSync();
    }, 50);
  }

  // Deduplication
  async hasMessage(messageId: string): Promise<boolean> {
    this.ensureSynced();
    return this.state.processedMessageIds.includes(messageId);
  }

  async addMessageId(messageId: string): Promise<void> {
    this.state.processedMessageIds.push(messageId);
    if (this.state.processedMessageIds.length > 5000) {
      this.state.processedMessageIds.shift();
    }
    this.scheduleSave();
  }

  // Leads
  async saveLead(lead: LeadProfile): Promise<void> {
    this.state.leads[lead.id] = lead;
    this.scheduleSave();
  }

  async getLead(leadId: string): Promise<LeadProfile | undefined> {
    this.ensureSynced();
    return this.state.leads[leadId];
  }

  async findLeadByChannelUser(channel: string, channelUserId: string): Promise<LeadProfile | undefined> {
    this.ensureSynced();
    return Object.values(this.state.leads).find(
      (l) => l.channel === channel && l.channelUserId === channelUserId
    );
  }

  // Sessions
  async saveSession(session: ConversationSession): Promise<void> {
    this.state.sessions[session.id] = session;
    this.scheduleSave();
  }

  async getSession(sessionId: string): Promise<ConversationSession | undefined> {
    this.ensureSynced();
    return this.state.sessions[sessionId];
  }

  async getSessionByChannelUser(channel: string, channelUserId: string): Promise<ConversationSession | undefined> {
    this.ensureSynced();
    return Object.values(this.state.sessions).find(
      (s) => s.channel === channel && s.channelUserId === channelUserId
    );
  }

  async addSessionMessage(sessionId: string, message: ChatMessage): Promise<void> {
    this.ensureSynced();
    const session = this.state.sessions[sessionId];
    if (session) {
      session.history.push(message);
      session.updatedAt = Date.now();
      session.lastMessageTimestamp = message.timestamp;
      this.scheduleSave();
    }
  }

  async updateSessionStatus(sessionId: string, status: ConversationSession['status']): Promise<void> {
    this.ensureSynced();
    const session = this.state.sessions[sessionId];
    if (session) {
      session.status = status;
      session.updatedAt = Date.now();
      this.scheduleSave();
    }
  }

  // Appointments
  async saveBooking(booking: BookingConfirmation): Promise<void> {
    this.ensureSynced();
    if (!this.state.appointments) this.state.appointments = {};
    this.state.appointments[booking.bookingId] = booking;
    this.saveSync();
  }

  async getBooking(bookingId: string): Promise<BookingConfirmation | undefined> {
    this.ensureSynced();
    return this.state.appointments?.[bookingId];
  }

  async getAllBookings(): Promise<BookingConfirmation[]>;
  async getAllBookings(): Promise<BookingConfirmation[]> {
    this.ensureSynced();
    return Object.values(this.state.appointments || {});
  }

  async updateDepositStatus(bookingId: string, status: BookingConfirmation['depositStatus']): Promise<boolean> {
    this.ensureSynced();
    if (!this.state.appointments || !this.state.appointments[bookingId]) return false;
    this.state.appointments[bookingId].depositStatus = status;
    this.saveSync();
    return true;
  }

  async getHealth(): Promise<StorageHealthInfo> {
    return {
      driver: 'json_file',
      connected: true,
      details: `File store at ${this.dbPath} with ${Object.keys(this.state.leads).length} leads, ${Object.keys(this.state.appointments).length} bookings`,
    };
  }

  async close(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveSync();
    }
  }
}
