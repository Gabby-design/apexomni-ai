---
doc: plans/plan-postgresql-persistence
purpose: "Implementation plan for production PostgreSQL persistence layer and modular StorageAdapter with zero-config JSON fallback"
authority: canonical
hosts_rules: []
mirrors_rules: []
last_reviewed: "2026-10-08"
---

# Plan — PostgreSQL Persistence Layer & Modular StorageAdapter

**Status:** active · **Classification:** feature · **Source:** [`docs/ai/prd/prd-postgresql-persistence.md`](../prd/prd-postgresql-persistence.md) · **Owner approval:** 2026-10-08 (Master)

## Objective

Equip ApexOmni.AI with a production-grade, durable PostgreSQL persistence layer while preserving instant local development via automatic fallback to local JSON storage when `DATABASE_URL` is omitted.

## Scope

- Type-safe asynchronous `StorageAdapter` interface covering leads, sessions, appointments, and message deduplication.
- `JsonStorageAdapter` refactoring existing flat-file database logic.
- `PostgresStorageAdapter` using native `pg` client with connection pooling and configurable SSL.
- Idempotent schema bootstrap (`001_init.sql`) executed during startup.
- Runtime storage factory dynamically selecting the engine based on `DATABASE_URL`.
- Exposing storage driver telemetry in `/health` and `/api/health`.
- Test harness validating adapter operations and fallback behavior.

## Non-goals

- ORM migrations tooling (Prisma/Drizzle) — native SQL DDL keeps startup fast and bundle minimal.
- Multi-master replication or distributed cache invalidation.
- Direct database management UI in the web workstation.

## Dependencies

- Node runtime >= 18.0.0
- `pg` (^8.13.0) and `@types/pg` (^8.11.0)

## Ordered tasks

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| SA01 | Define unified asynchronous `StorageAdapter` interface in `src/db/storageAdapter.ts` | Complete TypeScript interface for leads, sessions, appointments, and deduplication cache | complete |
| SA02 | Refactor flat-file store into `JsonStorageAdapter` implementing `StorageAdapter` | Zero regression in local persistence; all methods return Promises | complete |
| PG01 | Add `pg` and `@types/pg` to `package.json` and run `npm install` | Dependencies installed with clean type checks | complete |
| PG02 | Implement `PostgresStorageAdapter` with `pg.Pool` in `src/db/postgresAdapter.ts` | Supports connection pooling, SSL mode (`require`/`no-verify`), and graceful pool shutdown | complete |
| PG03 | Create SQL migration `src/db/migrations/001_init.sql` and auto-bootstrap runner | Creates `leads`, `sessions`, `appointments`, and `processed_messages` idempotently | complete |
| PG04 | Implement JSONB serialization/deserialization for chat history and lead profiles | Complex nested types round-trip correctly through PostgreSQL | complete |
| HF01 | Add `DATABASE_URL` and `DATABASE_SSL` to `src/config/env.ts` | Validates connection URI with Zod; optional in development | complete |
| HF02 | Implement storage factory `createStorageAdapter()` in `src/db/index.ts` | Chooses `PostgresStorageAdapter` when `DATABASE_URL` present, falls back to `JsonStorageAdapter` | complete |
| HF03 | Expose active storage driver and status in `/health` endpoint | `/health` returns `{ storage: "postgres" | "json_file", dbConnected: boolean }` | complete |
| VT01 | Refactor `conversationBroker.ts` and `app.ts` to async `StorageAdapter` | All broker handlers await storage calls with clean error propagation | complete |
| VT02 | Create automated storage test runner in `src/simulator/testStorage.ts` | `npm run test:storage` validates CRUD, deduplication, and fallback | complete |
| VT03 | Synchronize documentation (`ARCHITECTURE.md`, `MEMORY.md`, `.env.example`, `WEBHOOK_SETUP.md`) | Documentation reflects persistence options and connection configuration | complete |

## Verification

1. `npm run build`: TypeScript compilation passes with zero errors.
2. `npm run test`: Omnichannel test suite passes with active `StorageAdapter`.
3. `npm run test:webhooks`: Webhook challenges and inbound dispatch pass.
4. `npm run test:calendar`: Calendar and deposit hold workflow passes.
5. `npm run test:storage`: Dedicated storage test passes against JSON adapter and PostgreSQL (when configured).

## Documentation impact

- `docs/ai/plans/INDEX.md`: Register active plan.
- `docs/ai/MEMORY.md`: Update Current Position and Architecture notes.
- `docs/ai/ARCHITECTURE.md`: Document `StorageAdapter` contract and PostgreSQL integration.
- `.env.example`: Add `DATABASE_URL` and `DATABASE_SSL` examples.
- `docs/WEBHOOK_SETUP.md`: Document managed PostgreSQL configuration (Neon, Supabase, Railway, Render).

## Owner decisions required

None remaining. Master approved:
- Primary backing store: PostgreSQL
- Fallback: Graceful local JSON store
- Abstraction: Modular `StorageAdapter` with native `pg` client
