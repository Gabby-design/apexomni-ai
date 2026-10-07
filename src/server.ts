import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { env } from './config/env';
import { app } from './app';
import { channelRegistry } from './channels';
import { conversationBroker } from './broker/conversationBroker';

const server = http.createServer(app);

// Initialize WebSocket server only when running in persistent node runtime
if (!process.env.VERCEL) {
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
}

export { app, server };
export default app;
