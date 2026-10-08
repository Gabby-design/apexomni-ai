# ApexOmni.AI Production & Webhook Operations Guide

## 1. Webhook Endpoints & Verification Protocols

| Channel | Inbound Webhook Endpoint | Method | Verification Protocol |
| :--- | :--- | :--- | :--- |
| **WhatsApp Business** | `https://<domain>/webhooks/whatsapp` | GET / POST | Meta Hub Challenge (`hub.verify_token`, `hub.challenge`) |
| **Instagram Direct** | `https://<domain>/webhooks/instagram` | GET / POST | Meta Hub Challenge (`hub.verify_token`, `hub.challenge`) |
| **Facebook Messenger** | `https://<domain>/webhooks/facebook` | GET / POST | Meta Hub Challenge (`hub.verify_token`, `hub.challenge`) |
| **TikTok for Business** | `https://<domain>/webhooks/tiktok` | POST | Signature verification |
| **X / Twitter DM** | `https://<domain>/webhooks/twitter` | GET / POST | CRC HMAC-SHA256 Challenge |
| **Website Concierge** | `https://<domain>/api/chat` | POST | Direct JSON REST Payload |
| **WebSocket Concierge** | `wss://<domain>/ws/concierge` | WS | Real-time bi-directional streaming |
| **Calendar & Appointments** | `https://<domain>/api/appointments` | GET | Appointment roster with deposit statuses |
| **Deposit Confirmation** | `https://<domain>/api/deposit/webhook` | POST | Stripe / Payment gateway deposit webhook |

---

## 2. Local Live Tunnel Setup (For Meta Developer Portal)

To expose your local running engine (`http://localhost:3050`) to the public internet for Meta webhook validation:

```bash
npm run tunnel
```
This generates a temporary public HTTPS address:
`https://<subdomain>.localtunnel.me`

Use this URL inside your Meta App configuration:
- Callback URL: `https://<subdomain>.localtunnel.me/webhooks/whatsapp`
- Verify Token: value from your `.env` `META_VERIFY_TOKEN` (default: `apexomni_verify_token_2026`)

---

## 3. Automated Verification Test Suites

ApexOmni includes three distinct test harnesses:

1. **Omnichannel & AI Persona Verification**:
   ```bash
   npm run test
   ```
   Validates all 6 channels, lead qualification, non-diagnostic guardrails, and CRM indexing.

2. **Meta Webhook Challenge & Ingestion Verification**:
   ```bash
   npm run test:webhooks
   ```
   Validates WhatsApp, Instagram, and Facebook hub challenges and inbound dispatch.

3. **Calendar Slot Locking & Deposit Workflow Verification**:
   ```bash
   npm run test:calendar
   ```
   Validates slot availability query, appointment creation, persistence, and deposit settlement webhook.

---

## 4. Live Cal.com Integration

To connect live calendar scheduling:
1. Obtain an API key from [Cal.com Settings -> Developer -> API Keys](https://app.cal.com/settings/developer/api-keys).
2. Create an Event Type (e.g., "VIP Clinical Consultation") and copy its numeric ID.
3. Add to your `.env` file:
   ```env
   CAL_COM_API_KEY=cal_live_xxxxxxxxxxxx
   CLINIC_CALENDAR_ID=123456
   ```
The engine automatically routes booking requests through Cal.com v2 API with graceful fallback to the dynamic VIP slot generator.

---

## 5. Cloud Deployment Blueprints

### Railway Deployment
1. Connect this GitHub repository to Railway.
2. Railway detects `Dockerfile` and `railway.json` automatically.
3. Configure Environment Variables in Railway:
   - `GEMINI_API_KEY`: Your Gemini API key.
   - `META_VERIFY_TOKEN`: Your custom verification token.
   - `PORT`: Railway assigns this automatically.

### Render Deployment
1. Create a **Blueprint** or **Web Service** using `render.yaml`.
2. Connect your repository.
3. Add `GEMINI_API_KEY` in the Environment Variables dashboard.

---

## 6. PostgreSQL Database Configuration

ApexOmni.AI supports optional managed PostgreSQL persistence across Supabase, Neon, Railway, and Render:

1. Create a PostgreSQL database on your preferred cloud provider.
2. Provide the connection string in your `.env` or cloud dashboard:
   ```env
   DATABASE_URL=postgres://user:password@ep-host.region.aws.neon.tech/dbname?sslmode=require
   DATABASE_SSL=true
   ```
3. The engine automatically bootstraps all required tables (`leads`, `sessions`, `appointments`, `processed_messages`) on startup.
4. If `DATABASE_URL` is omitted, the engine automatically falls back to local JSON flat-file storage (`data/apexomni.json`).
5. Run `npm run test:storage` to verify database health and operations.
