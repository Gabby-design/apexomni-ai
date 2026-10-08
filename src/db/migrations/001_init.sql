-- Migration 001: Initial schema for ApexOmni.AI persistence layer

-- 1. Leads Table
CREATE TABLE IF NOT EXISTS leads (
  id VARCHAR(128) PRIMARY KEY,
  channel VARCHAR(32) NOT NULL,
  channel_user_id VARCHAR(128) NOT NULL,
  full_name VARCHAR(256),
  phone VARCHAR(64),
  email VARCHAR(256),
  requested_service VARCHAR(256),
  urgency VARCHAR(32),
  budget_or_insurance VARCHAR(256),
  qualification_status VARCHAR(32) NOT NULL DEFAULT 'unqualified',
  estimated_value NUMERIC(10, 2),
  notes JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_channel_user ON leads(channel, channel_user_id);

-- 2. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(128) PRIMARY KEY,
  channel VARCHAR(32) NOT NULL,
  channel_user_id VARCHAR(128) NOT NULL,
  lead_id VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  history JSONB DEFAULT '[]'::jsonb,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  last_message_timestamp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_channel_user ON sessions(channel, channel_user_id);

-- 3. Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
  booking_id VARCHAR(128) PRIMARY KEY,
  slot_id VARCHAR(128) NOT NULL,
  client_name VARCHAR(256) NOT NULL,
  service_type VARCHAR(256) NOT NULL,
  start_time VARCHAR(64) NOT NULL,
  deposit_status VARCHAR(32) NOT NULL DEFAULT 'hold',
  confirmation_url VARCHAR(512) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(deposit_status);

-- 4. Deduplication Table
CREATE TABLE IF NOT EXISTS processed_messages (
  message_id VARCHAR(256) PRIMARY KEY,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_processed_messages_created ON processed_messages(created_at);
