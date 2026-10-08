import { Pool, PoolConfig } from 'pg';
import fs from 'fs';
import path from 'path';
import { ConversationSession, LeadProfile, ChatMessage, BookingConfirmation } from '../types';
import { StorageAdapter, StorageHealthInfo } from './storageAdapter';

export interface PostgresConfig {
  connectionString: string;
  ssl?: boolean;
  maxConnections?: number;
}

export class PostgresStorageAdapter implements StorageAdapter {
  readonly driverName = 'postgres';
  private pool: Pool;
  private isInitialized = false;

  constructor(config: PostgresConfig) {
    const isSslRequired =
      config.ssl ||
      config.connectionString.includes('sslmode=require') ||
      config.connectionString.includes('neon.tech') ||
      config.connectionString.includes('supabase.co');

    const poolConfig: PoolConfig = {
      connectionString: config.connectionString,
      max: config.maxConnections || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    if (isSslRequired) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    this.pool = new Pool(poolConfig);

    this.pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Unexpected Error]', err);
    });
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    const migrationPath = path.join(__dirname, 'migrations', '001_init.sql');
    let sql: string;

    if (fs.existsSync(migrationPath)) {
      sql = fs.readFileSync(migrationPath, 'utf-8');
    } else {
      // Fallback relative to dist or root
      const fallbackPath = path.join(process.cwd(), 'src', 'db', 'migrations', '001_init.sql');
      sql = fs.readFileSync(fallbackPath, 'utf-8');
    }

    await this.pool.query(sql);
    this.isInitialized = true;
    console.log('[PostgreSQL] Database schema verified and initialized.');
  }

  // Deduplication
  async hasMessage(messageId: string): Promise<boolean> {
    const res = await this.pool.query(
      'SELECT 1 FROM processed_messages WHERE message_id = $1 LIMIT 1',
      [messageId]
    );
    return res.rowCount !== null && res.rowCount > 0;
  }

  async addMessageId(messageId: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO processed_messages (message_id, created_at) VALUES ($1, $2) ON CONFLICT (message_id) DO NOTHING',
      [messageId, Date.now()]
    );
  }

  // Leads
  async saveLead(lead: LeadProfile): Promise<void> {
    const query = `
      INSERT INTO leads (
        id, channel, channel_user_id, full_name, phone, email,
        requested_service, urgency, budget_or_insurance,
        qualification_status, estimated_value, notes, metadata,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        requested_service = EXCLUDED.requested_service,
        urgency = EXCLUDED.urgency,
        budget_or_insurance = EXCLUDED.budget_or_insurance,
        qualification_status = EXCLUDED.qualification_status,
        estimated_value = EXCLUDED.estimated_value,
        notes = EXCLUDED.notes,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
    `;
    const values = [
      lead.id,
      lead.channel,
      lead.channelUserId,
      lead.fullName || null,
      lead.phone || null,
      lead.email || null,
      lead.requestedService || null,
      lead.urgency || null,
      lead.budgetOrInsurance || null,
      lead.qualificationStatus,
      lead.estimatedValue || null,
      JSON.stringify(lead.notes || []),
      JSON.stringify(lead.metadata || {}),
      lead.createdAt,
      lead.updatedAt,
    ];
    await this.pool.query(query, values);
  }

  async getLead(leadId: string): Promise<LeadProfile | undefined> {
    const res = await this.pool.query('SELECT * FROM leads WHERE id = $1 LIMIT 1', [leadId]);
    if (res.rows.length === 0) return undefined;
    return this.mapLeadRow(res.rows[0]);
  }

  async findLeadByChannelUser(channel: string, channelUserId: string): Promise<LeadProfile | undefined> {
    const res = await this.pool.query(
      'SELECT * FROM leads WHERE channel = $1 AND channel_user_id = $2 ORDER BY updated_at DESC LIMIT 1',
      [channel, channelUserId]
    );
    if (res.rows.length === 0) return undefined;
    return this.mapLeadRow(res.rows[0]);
  }

  // Sessions
  async saveSession(session: ConversationSession): Promise<void> {
    const query = `
      INSERT INTO sessions (
        id, channel, channel_user_id, lead_id, status, history, created_at, updated_at, last_message_timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        history = EXCLUDED.history,
        updated_at = EXCLUDED.updated_at,
        last_message_timestamp = EXCLUDED.last_message_timestamp
    `;
    const values = [
      session.id,
      session.channel,
      session.channelUserId,
      session.leadId,
      session.status,
      JSON.stringify(session.history),
      session.createdAt,
      session.updatedAt,
      session.lastMessageTimestamp,
    ];
    await this.pool.query(query, values);
  }

  async getSession(sessionId: string): Promise<ConversationSession | undefined> {
    const res = await this.pool.query('SELECT * FROM sessions WHERE id = $1 LIMIT 1', [sessionId]);
    if (res.rows.length === 0) return undefined;
    return this.mapSessionRow(res.rows[0]);
  }

  async getSessionByChannelUser(channel: string, channelUserId: string): Promise<ConversationSession | undefined> {
    const res = await this.pool.query(
      'SELECT * FROM sessions WHERE channel = $1 AND channel_user_id = $2 ORDER BY updated_at DESC LIMIT 1',
      [channel, channelUserId]
    );
    if (res.rows.length === 0) return undefined;
    return this.mapSessionRow(res.rows[0]);
  }

  async addSessionMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const now = Date.now();
    const query = `
      UPDATE sessions
      SET history = history || $1::jsonb,
          updated_at = $2,
          last_message_timestamp = $3
      WHERE id = $4
    `;
    await this.pool.query(query, [JSON.stringify([message]), now, message.timestamp, sessionId]);
  }

  async updateSessionStatus(sessionId: string, status: ConversationSession['status']): Promise<void> {
    const query = 'UPDATE sessions SET status = $1, updated_at = $2 WHERE id = $3';
    await this.pool.query(query, [status, Date.now(), sessionId]);
  }

  // Appointments
  async saveBooking(booking: BookingConfirmation): Promise<void> {
    const query = `
      INSERT INTO appointments (
        booking_id, slot_id, client_name, service_type, start_time, deposit_status, confirmation_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (booking_id) DO UPDATE SET
        start_time = EXCLUDED.start_time,
        deposit_status = EXCLUDED.deposit_status
    `;
    const values = [
      booking.bookingId,
      booking.slotId,
      booking.clientName,
      booking.serviceType,
      booking.startTime,
      booking.depositStatus,
      booking.confirmationUrl,
    ];
    await this.pool.query(query, values);
  }

  async getBooking(bookingId: string): Promise<BookingConfirmation | undefined> {
    const res = await this.pool.query('SELECT * FROM appointments WHERE booking_id = $1 LIMIT 1', [
      bookingId,
    ]);
    if (res.rows.length === 0) return undefined;
    return this.mapBookingRow(res.rows[0]);
  }

  async getAllBookings(): Promise<BookingConfirmation[]> {
    const res = await this.pool.query('SELECT * FROM appointments ORDER BY created_at DESC');
    return res.rows.map((row) => this.mapBookingRow(row));
  }

  async updateDepositStatus(bookingId: string, status: BookingConfirmation['depositStatus']): Promise<boolean> {
    const res = await this.pool.query(
      'UPDATE appointments SET deposit_status = $1 WHERE booking_id = $2',
      [status, bookingId]
    );
    return res.rowCount !== null && res.rowCount > 0;
  }

  async getHealth(): Promise<StorageHealthInfo> {
    try {
      const res = await this.pool.query('SELECT NOW() as current_time');
      return {
        driver: 'postgres',
        connected: true,
        details: `Connected to PostgreSQL at ${res.rows[0]?.current_time}`,
      };
    } catch (err) {
      return {
        driver: 'postgres',
        connected: false,
        details: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // Row Mappers
  private mapLeadRow(row: any): LeadProfile {
    return {
      id: row.id,
      channel: row.channel,
      channelUserId: row.channel_user_id,
      fullName: row.full_name || undefined,
      phone: row.phone || undefined,
      email: row.email || undefined,
      requestedService: row.requested_service || undefined,
      urgency: row.urgency || undefined,
      budgetOrInsurance: row.budget_or_insurance || undefined,
      qualificationStatus: row.qualification_status,
      estimatedValue: row.estimated_value ? Number(row.estimated_value) : undefined,
      notes: typeof row.notes === 'string' ? JSON.parse(row.notes) : row.notes || [],
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }

  private mapSessionRow(row: any): ConversationSession {
    return {
      id: row.id,
      channel: row.channel,
      channelUserId: row.channel_user_id,
      leadId: row.lead_id,
      status: row.status,
      history: typeof row.history === 'string' ? JSON.parse(row.history) : row.history || [],
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      lastMessageTimestamp: Number(row.last_message_timestamp),
    };
  }

  private mapBookingRow(row: any): BookingConfirmation {
    return {
      bookingId: row.booking_id,
      slotId: row.slot_id,
      clientName: row.client_name,
      serviceType: row.service_type,
      startTime: row.start_time,
      depositStatus: row.deposit_status,
      confirmationUrl: row.confirmation_url,
    };
  }
}
