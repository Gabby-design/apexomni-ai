# MEMORY — Gabby

> Current state only. Rewritten when reality changes; never a diary, never contradictory facts side by side. Read top to bottom at every session start. No secrets.

## Current Position

- Owner: **Master** (always address as Master across all sessions)
- Project: ApexOmni.AI Omnichannel Receptionist Engine.
- Status: PostgreSQL persistence layer & modular StorageAdapter implemented with zero-config JSON flat-file fallback. All test harnesses passing (storage, omnichannel, webhooks, calendar).
- Local Server: Active on http://localhost:3050.

## Fixed Decisions

- Language/Runtime: TypeScript, Node.js >= 18.
- Multi-channel ingestion: Modular normalizers emitting `NormalizedMessage`.
- LLM Provider: Google Gemini API (`@google/genai`) with fallback receptionist logic.
- Persistence: Modular `StorageAdapter` interface with production `PostgresStorageAdapter` and zero-config `JsonStorageAdapter` fallback.

## Architecture

- Webhook and WebSocket server in `src/server.ts`.
- Inbound normalizers in `src/channels/`.
- Central routing broker in `src/broker/conversationBroker.ts`.
- Persona and tool execution in `src/agent/`.

## Features

- Multi-channel normalizers for WhatsApp, Instagram, Facebook, TikTok, Twitter, and Web Concierge.
- Automated qualification, non-diagnostic guardrails, and human escalation alerting.
- CLI simulator and automated test runner (`npm run test`).

<!-- How to run it, what is required, what commonly goes wrong on setup. No secrets. -->

## Gotchas

<!-- Specific: "X silently fails when Y". -->

## Deferred Work

## Deviations

<!-- Where the code diverges from its own conventions and whether that is tolerated. -->

## Open Questions

<!-- Mirror of SYSTEM.md → open_confirmations plus product questions awaiting the owner. -->
