import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { ChannelType } from './types';
import { channelRegistry } from './channels';
import { conversationBroker } from './broker/conversationBroker';
import { dbService } from './db';

const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend files from /public
const publicDir = path.join(process.cwd(), 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// Favicon handler to eliminate 500/404 browser noise
app.get('/favicon.ico', (_req: Request, res: Response) => {
  res.status(204).end();
});

// 1. Health Checks
const handleHealth = (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ApexOmni.AI Omnichannel Receptionist Engine',
    timestamp: Date.now(),
    environment: process.env.VERCEL ? 'vercel_serverless' : 'standalone',
  });
};

app.get('/health', handleHealth);
app.get('/api/health', handleHealth);

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
    return res.status(200).json({ status: 'ignored_or_malformed' });
  }

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

// 6. Deposit Webhook Endpoint
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

// 7. Root fallback for direct visits
app.get('/', (_req: Request, res: Response) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>ApexOmni.AI Engine</title></head>
      <body style="background:#06090F;color:#F1F5F9;font-family:sans-serif;padding:2rem;">
        <h1>ApexOmni.AI Omnichannel Engine</h1>
        <p>Status: Online (Serverless Mode)</p>
      </body>
    </html>
  `);
});

export { app };
export default app;
