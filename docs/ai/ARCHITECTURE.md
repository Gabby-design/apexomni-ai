---
doc: ARCHITECTURE
purpose: "The current architectural model: workspaces, services, dependency directions, contracts, persistence, integrations, deployment shape, structural constraints"
authority: canonical
hosts_rules: []
mirrors_rules: []
last_reviewed: "2026-10-06"
---

# ARCHITECTURE — Gabby

> How the repository is structured **now** — not how it was planned, not a directory listing. Document boundaries and why they exist, non-obvious constraints, what breaks if you touch a given thing, and where authority lives. Every statement is `[verified]` against the repository or tagged otherwise.

## 1. Repository shape

- `src/config/`: Zod environment configuration validation (`env.ts`).
- `src/types/`: Core type definitions (`NormalizedMessage`, `LeadProfile`, `ConversationSession`, etc.).
- `src/channels/`: Multi-channel inbound and outbound adapters (`whatsapp`, `instagram`, `facebook`, `tiktok`, `twitter`, `web`).
- `src/agent/`: AI receptionist persona, tool definitions (`AGENT_TOOLS`), tool execution runner (`ToolRunner`), and LLM orchestrator (`AgentEngine`).
- `src/broker/`: Shared state session store (`SessionStore`), deduplication, idempotency cache, and central routing broker (`ConversationBroker`).
- `src/server.ts`: Express and WebSocket server exposing webhook endpoints and live concierge chat.
- `src/simulator/`: Interactive CLI and automated test suite.

## 2. Boundaries and dependency directions

- Channels normalize raw vendor payloads into `NormalizedMessage` and forward to `ConversationBroker`.
- `ConversationBroker` handles idempotency, deduplication, identity resolution (`SessionStore`), calls `AgentEngine`, and routes responses back via `ChannelAdapter`.
- `AgentEngine` maintains context window pruning and executes tools (`ToolRunner`).

## 3. Cross-boundary contracts

- Inbound messages follow `NormalizedMessage` interface.
- Outbound responses are string payloads dispatched via `ChannelAdapter.sendResponse`.
- Function calls adhere to JSON schema declarations in `AGENT_TOOLS`.

## 4. Persistence

- In-memory `SessionStore` with identity mapping; extensible to PostgreSQL / Redis via `DATABASE_URL`.

## 5. Integrations

- Meta Cloud API (WhatsApp, Instagram, Facebook).
- TikTok for Business Messaging API.
- Twitter / X Account Activity API.
- Google Gemini API (`@google/genai`).
- Calendar integrations (Calendly / Cal.com).

## 6. Deployment shape

- Containerized via `Dockerfile` (Node.js 20 Alpine).
- Serverless / PaaS ready for Railway, Render, Fly.io.
