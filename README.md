# ApexOmni.AI — Omnichannel AI Receptionist Engine

Autonomous, high-ticket AI receptionist infrastructure built for service clinics, medspas, and high-value local businesses. Converts inquiries into confirmed, deposited appointments across 6 client touchpoints in under 20 seconds.

---

## Channels Supported
- **Website Live Concierge**: WebSocket & REST streaming console with real-time telemetry.
- **WhatsApp Business API**: Webhook ingestion, Meta Hub challenge verification, interactive buttons.
- **Instagram Direct Messages**: Meta Graph webhook ingestion, non-diagnostic safety guardrails.
- **Facebook Messenger**: Automated lead qualification and priority slot booking.
- **TikTok for Business DMs**: Automated inquiry handling with brand-aligned persona.
- **X / Twitter Direct Messages**: Rapid lead triage with CRC HMAC-SHA256 challenge verification.

---

## Architecture & Features
- **Neural Engine**: Google Gemini API integration with tool calling (`check_availability`, `create_booking`, `send_payment_link`, `reschedule_booking`, `cancel_booking`, `save_lead`, `handoff_to_human`).
- **Calendar & Slot Locking**: Cal.com v2 integration with dynamic slot allocation and deposit hold settlement.
- **Safety & Clinical Guardrails**: Strict non-diagnostic medical disclaimer rules and instant human staff escalation triggers.
- **Persistent CRM Database**: Local JSON storage (`data/apexomni.json`) with lead profile tracking.
- **Developer & Testing Suite**: Built-in simulators and automated testing harnesses for webhooks, calendars, and channels.

---

## Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file from `.env.example`:
```env
PORT=3050
NODE_ENV=development
GEMINI_API_KEY=your_gemini_api_key
META_VERIFY_TOKEN=apexomni_verify_token_2026
```

### 3. Build & Run
```bash
# Build TypeScript
npm run build

# Start Engine
npm start

# Development Watch Mode
npm run dev
```

### 4. Interactive Simulation & Testing
```bash
# Omnichannel Simulation Test Suite
npm run test

# Meta Webhook Challenge & Ingestion Test
npm run test:webhooks

# Calendar Slot Locking & Deposit Workflow Test
npm run test:calendar

# Interactive Simulator CLI
npm run simulate

# Public Tunnel (Local Development)
npm run tunnel
```

---

## Operations & Documentation
Detailed operational guides and Meta developer webhook configurations are available in [`docs/WEBHOOK_SETUP.md`](docs/WEBHOOK_SETUP.md).

---

## License
MIT
