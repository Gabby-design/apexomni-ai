import http from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { env } from './config/env';
import { ChannelType } from './types';
import { channelRegistry } from './channels';
import { conversationBroker } from './broker/conversationBroker';
import { dbService } from './db';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

// 1. Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ApexOmni.AI Omnichannel Receptionist Engine',
    timestamp: Date.now(),
  });
});

// 2. Webhook Verification (Meta WhatsApp / Instagram / Facebook, Twitter CRC, TikTok)
app.get('/webhooks/:channel', (req: Request, res: Response) => {
  const channel = req.params.channel as ChannelType;
  const adapter = channelRegistry.get(channel);

  if (!adapter) {
    return res.status(404).send('Channel adapter not found');
  }

  const queryParams = req.query as Record<string, string>;
  const verification = adapter.verifyWebhook(queryParams);

  if (verification.isValid) {
    if (channel === 'twitter' && verification.challenge) {
      return res.status(200).send(verification.challenge);
    }
    return res.status(200).send(verification.challenge || 'OK');
  }

  return res.status(403).send('Verification token mismatch');
});

// 3. Webhook Ingestion Endpoint
app.post('/webhooks/:channel', async (req: Request, res: Response) => {
  const channel = req.params.channel as ChannelType;
  const adapter = channelRegistry.get(channel);

  if (!adapter) {
    return res.status(404).json({ error: 'Channel not supported' });
  }

  const normalized = adapter.normalize(req.body);
  if (!normalized) {
    // Acknowledge receipt to prevent webhook retries
    return res.status(200).json({ status: 'ignored_or_malformed' });
  }

  // Process asynchronously or synchronously
  const result = await conversationBroker.handleInbound(normalized);
  return res.status(200).json(result);
});

// 4. REST Chat Endpoint for Web Concierge
app.post('/api/chat', async (req: Request, res: Response) => {
  const adapter = channelRegistry.get('web');
  if (!adapter) {
    return res.status(500).json({ error: 'Web adapter unavailable' });
  }

  const normalized = adapter.normalize(req.body);
  if (!normalized) {
    return res.status(400).json({ error: 'Invalid message payload' });
  }

  if (req.body.channel) {
    normalized.channel = req.body.channel;
  }

  const result = await conversationBroker.handleInbound(normalized);
  return res.json(result);
});

// 5. Appointments & Calendar Slot Query
app.get('/api/appointments', (_req: Request, res: Response) => {
  const bookings = dbService.getAllBookings();
  return res.json({ bookings, count: bookings.length });
});

// 6. Deposit Webhook Endpoint (Stripe or Payment Processor Confirmation)
app.post('/api/deposit/webhook', (req: Request, res: Response) => {
  const { bookingId, status } = req.body;
  if (!bookingId) {
    return res.status(400).json({ error: 'Missing bookingId' });
  }
  const updated = dbService.updateDepositStatus(bookingId, status || 'collected');
  if (!updated) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  return res.json({ success: true, bookingId, depositStatus: status || 'collected' });
});

// 7. Server initialization with WebSocket support
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/concierge' });

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId') || `web_${Date.now()}`;
  const webAdapter = channelRegistry.getWebAdapter();

  webAdapter.registerSocket(sessionId, ws);

  ws.on('message', async (data: string) => {
    try {
      const payload = JSON.parse(data.toString());
      payload.sessionId = sessionId;

      const normalized = webAdapter.normalize(payload);
      if (normalized) {
        await conversationBroker.handleInbound(normalized);
      }
    } catch (err) {
      console.error('[WebSocket Message Error]', err);
    }
  });

  // Welcome ping
  ws.send(
    JSON.stringify({
      type: 'connected',
      sessionId,
      message: 'Connected to ApexOmni Concierge Live Server',
    })
  );
});

server.listen(env.PORT, () => {
  console.log(`ApexOmni.AI Engine running on port ${env.PORT}`);
  console.log(`Web Concierge WebSocket ready at ws://localhost:${env.PORT}/ws/concierge`);
});

export { app, server };
