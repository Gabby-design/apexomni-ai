// Simulate Vercel Serverless Runtime Environment before loading app
process.env.VERCEL = '1';

import http from 'http';
import { app } from '../app';

async function runVercelVerification() {
  console.log('=== ApexOmni.AI Vercel Serverless Runtime Verification ===\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://localhost:${port}`;

  console.log(`[Vercel Emulation] Serverless function listening on ephemeral port ${port}\n`);

  try {
    // 1. Health check with Vercel environment flag
    console.log('[Test 1] Health Check & Storage Telemetry in Serverless Mode');
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.log(`Status: ${healthData.status}`);
    console.log(`Environment: ${healthData.environment}`);
    console.log(`Storage Driver: ${healthData.storage?.driver}`);
    console.log(`Storage Connected: ${healthData.storage?.connected}\n`);

    if (healthData.environment !== 'vercel_serverless') {
      throw new Error(`Expected environment 'vercel_serverless', got '${healthData.environment}'`);
    }

    // 2. Webhook verification
    console.log('[Test 2] Meta Webhook Hub Challenge');
    const waVerifyRes = await fetch(
      `${baseUrl}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=apexomni_verify_token&hub.challenge=test_vercel_challenge_88`
    );
    const waVerifyText = await waVerifyRes.text();
    console.log(`WhatsApp Challenge Response: "${waVerifyText}"`);
    if (waVerifyText !== 'test_vercel_challenge_88') {
      throw new Error('Meta challenge failed on serverless endpoint');
    }

    // 3. REST Concierge Chat Endpoint (Stateless API request)
    console.log('\n[Test 3] REST Chat Ingestion (/api/chat)');
    const chatRes = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'web',
        sessionId: `vercel_test_sess_${Date.now()}`,
        message: 'Hi, I need pricing information for HydraFacial.',
      }),
    });
    const chatData = await chatRes.json();
    console.log(`Chat Result Status: ${chatData.status}`);
    console.log(`AI Reply: "${chatData.replyText}"\n`);

    if (chatData.status !== 'processed' || !chatData.replyText) {
      throw new Error('Serverless REST chat invocation failed');
    }

    // 4. Appointment List Query
    console.log('[Test 4] Query Appointments Endpoint (/api/appointments)');
    const apptRes = await fetch(`${baseUrl}/api/appointments`);
    const apptData = await apptRes.json();
    console.log(`Bookings Count: ${apptData.count}\n`);

    // 5. Direct entrypoint require test (api/index.js)
    console.log('[Test 5] Direct Vercel Entrypoint Require (api/index.js)');
    const vercelHandler = require('../../api/index.js');
    if (!vercelHandler || typeof vercelHandler !== 'function') {
      throw new Error('api/index.js did not export Express application function');
    }
    console.log('Vercel api/index.js entrypoint loaded successfully.\n');

    console.log('=== All Vercel Serverless Emulation Tests Passed Successfully ===');
  } finally {
    server.close();
  }
}

runVercelVerification().catch((err) => {
  console.error('[Vercel Verification Error]', err);
  process.exit(1);
});
