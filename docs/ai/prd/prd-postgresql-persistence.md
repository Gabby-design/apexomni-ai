# PRD — PostgreSQL Persistence Layer & Modular Storage Adapter

## 1. Introduction / Overview

ApexOmni.AI currently persists leads, conversation sessions, appointments, and deduplication message IDs in a local JSON flat-file (`data/apexomni.json`) or temporary directory in serverless environments. In production deployments (Render, Railway, Fly.io, Vercel), local flat-file storage is ephemeral across process restarts and horizontal scaling.

This feature introduces a production-ready PostgreSQL persistence layer powered by a modular `StorageAdapter` architecture. When `DATABASE_URL` is set, the engine persists all state to PostgreSQL with connection pooling and SSL support. When `DATABASE_URL` is absent, the engine gracefully falls back to the existing local JSON file store, ensuring seamless local development without mandatory cloud database dependencies.

## 2. Goals

1. **Production Durability**: Ensure zero data loss for patient leads, conversation histories, and appointment bookings across container restarts and serverless invocations.
2. **Zero-Configuration Local DX**: Maintain immediate local development and offline testing via automatic fallback to JSON storage when `DATABASE_URL` is not provided.
3. **Pluggable Abstraction**: Abstract all database interactions behind a type-safe `StorageAdapter` interface, separating channel broker logic from database engines.
4. **Cloud Database Compatibility**: Support managed PostgreSQL providers (Neon, Supabase, Railway, Render) with SSL connection support and connection pooling.

## 3. User Stories

- **As a Clinic Receptionist / Manager**, I want all patient inquiries, qualification notes, and confirmed bookings stored permanently in a robust database so that system restarts or deployments never wipe customer records.
- **As a Developer**, I want to clone and run the repository locally with `npm run dev` or `npm test` without being forced to spin up a local PostgreSQL instance, while having seamless production PostgreSQL integration when `DATABASE_URL` is configured.
- **As a DevOps Engineer**, I want the health check endpoint (`/health`) to clearly report the active persistence driver (`postgres` or `json_file`) and database connection state for uptime monitoring.

## 4. Features / Tasks

### Storage Adapter Interface (`SA`)
- SA01: Define unified asynchronous `StorageAdapter` interface in `src/db/storageAdapter.ts` covering CRUD operations for leads, sessions, messages, appointments, and message deduplication.
- SA02: Refactor existing JSON database logic into `JsonStorageAdapter` implementing `StorageAdapter`.

### PostgreSQL Implementation (`PG`)
- PG01: Add `pg` and `@types/pg` dependencies to `package.json`.
- PG02: Implement `PostgresStorageAdapter` with `pg.Pool` connection pooling and configurable SSL mode.
- PG03: Create SQL schema definition (`src/db/migrations/001_init.sql`) and auto-bootstrap logic for `leads`, `sessions`, `appointments`, and `processed_messages`.
- PG04: Implement JSONB serialization for complex properties (chat history, metadata, service arrays).

### Hybrid Fallback & Configuration (`HF`)
- HF01: Update `src/config/env.ts` with optional `DATABASE_URL` and `DATABASE_SSL` Zod schema definitions.
- HF02: Implement storage factory `createStorageAdapter()` that selects `PostgresStorageAdapter` if `DATABASE_URL` is valid, falling back to `JsonStorageAdapter` with a clear startup notice.
- HF03: Expose storage engine telemetry and connection status in `/health` and `/api/health`.

### Verification & Test Suite (`VT`)
- VT01: Update `src/broker/conversationBroker.ts` and `src/app.ts` to consume the asynchronous `StorageAdapter`.
- VT02: Add automated test suite validating adapter contracts, JSON fallback, and migration bootstrap.
- VT03: Update `docs/WEBHOOK_SETUP.md` and `.env.example` with database setup instructions.

## 5. Non-Goals (Out of Scope)

- Heavy ORM dependencies (Prisma, TypeORM, Drizzle) — keep bundle minimal and cold starts fast with lightweight native `pg` client.
- Complex multi-region database replication or distributed transaction managers.
- In-memory Redis caching layer (can be added as an optional L1 cache in a later milestone).
- Direct user-facing database administrative UI (rely on workstation telemetry or external database dashboards like Supabase/Neon).

## 6. Design & Architecture Considerations

- All storage calls in `StorageAdapter` must be asynchronous (`Promise`-based) to accommodate network I/O with remote databases.
- The deduplication cache (`processed_messages`) should include an index on `message_id` and timestamp for efficient cleanup.
- PostgreSQL table design:
  - `leads`: `id` (VARCHAR PK), `channel` (VARCHAR), `channel_user_id` (VARCHAR), `data` (JSONB), `created_at` (BIGINT), `updated_at` (BIGINT).
  - `sessions`: `id` (VARCHAR PK), `channel` (VARCHAR), `channel_user_id` (VARCHAR), `lead_id` (VARCHAR), `status` (VARCHAR), `history` (JSONB), `updated_at` (BIGINT).
  - `appointments`: `booking_id` (VARCHAR PK), `channel` (VARCHAR), `status` (VARCHAR), `deposit_status` (VARCHAR), `slot_start` (BIGINT), `slot_end` (BIGINT), `patient_data` (JSONB), `created_at` (BIGINT).
  - `processed_messages`: `message_id` (VARCHAR PK), `created_at` (BIGINT).

## 7. Technical Considerations

- Environment variable: `DATABASE_URL=postgres://user:password@host:port/dbname?sslmode=require`
- Handle connection pool teardown on `SIGINT` / `SIGTERM` signals.
- In serverless runtimes (Vercel), ensure connection pooling parameters (`max: 1` or `@neondatabase/serverless` if requested) do not exceed connection limits.

## 8. Success Metrics

1. Successful zero-config startup and test pass rate with `npm test` using `JsonStorageAdapter`.
2. Seamless bootstrap and CRUD verification against a PostgreSQL test database when `DATABASE_URL` is supplied.
3. 100% test pass rate across `npm run test`, `npm run test:webhooks`, and `npm run test:calendar`.
4. Zero downtime / regression in webhook response latency (< 50ms database operation overhead).

## 9. Open Questions

- None. Requirements clarified: PostgreSQL primary store, graceful fallback to JSON store, modular `StorageAdapter` pattern.
