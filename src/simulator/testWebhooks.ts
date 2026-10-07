import { env } from '../config/env';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

async function runWebhookTests() {
  const baseUrl = `http://localhost:${env.PORT}`;
  console.log(`=== ApexOmni.AI Webhook Verification Test Suite ===`);
  console.log(`Target Base URL: ${baseUrl}\n`);

  const results: TestResult[] = [];

  // Helper fetch function
  const testGet = async (endpoint: string, expectedStatus: number, expectedBody?: string) => {
    const res = await fetch(`${baseUrl}${endpoint}`);
    const text = await res.text();
    const passed = res.status === expectedStatus && (!expectedBody || text === expectedBody);
    return { status: res.status, text, passed };
  };

  const testPost = async (endpoint: string, body: any, expectedStatus: number) => {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    const passed = res.status === expectedStatus;
    return { status: res.status, json, passed };
  };

  // Test 1: WhatsApp Hub Challenge Verification (Success)
  console.log('[Test 1.1] WhatsApp Hub Challenge (Valid Token)');
  const challenge1 = 'wa_challenge_998811';
  const waVerify = await testGet(
    `/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(env.META_VERIFY_TOKEN)}&hub.challenge=${challenge1}`,
    200,
    challenge1
  );
  results.push({
    name: 'WhatsApp Webhook Verification (Valid)',
    passed: waVerify.passed,
    details: `Status ${waVerify.status}, Body: ${waVerify.text}`,
  });
  console.log(`Result: ${waVerify.passed ? 'PASSED' : 'FAILED'} - Body: "${waVerify.text}"\n`);

  // Test 2: WhatsApp Hub Challenge Verification (Invalid Token -> 403)
  console.log('[Test 1.2] WhatsApp Hub Challenge (Invalid Token)');
  const waInvalid = await testGet(
    `/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test`,
    403
  );
  results.push({
    name: 'WhatsApp Webhook Verification (Invalid Token 403)',
    passed: waInvalid.passed,
    details: `Status ${waInvalid.status}`,
  });
  console.log(`Result: ${waInvalid.passed ? 'PASSED' : 'FAILED'} - Status: ${waInvalid.status}\n`);

  // Test 3: Instagram Hub Challenge Verification
  console.log('[Test 1.3] Instagram Hub Challenge (Valid Token)');
  const challengeIg = 'ig_challenge_772244';
  const igVerify = await testGet(
    `/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(env.META_VERIFY_TOKEN)}&hub.challenge=${challengeIg}`,
    200,
    challengeIg
  );
  results.push({
    name: 'Instagram Webhook Verification (Valid)',
    passed: igVerify.passed,
    details: `Status ${igVerify.status}, Body: ${igVerify.text}`,
  });
  console.log(`Result: ${igVerify.passed ? 'PASSED' : 'FAILED'} - Body: "${igVerify.text}"\n`);

  // Test 4: Facebook Hub Challenge Verification
  console.log('[Test 1.4] Facebook Hub Challenge (Valid Token)');
  const challengeFb = 'fb_challenge_553311';
  const fbVerify = await testGet(
    `/webhooks/facebook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(env.META_VERIFY_TOKEN)}&hub.challenge=${challengeFb}`,
    200,
    challengeFb
  );
  results.push({
    name: 'Facebook Webhook Verification (Valid)',
    passed: fbVerify.passed,
    details: `Status ${fbVerify.status}, Body: ${fbVerify.text}`,
  });
  console.log(`Result: ${fbVerify.passed ? 'PASSED' : 'FAILED'} - Body: "${fbVerify.text}"\n`);

  // Test 5: Inbound WhatsApp Cloud API Payload Ingestion
  console.log('[Test 1.5] WhatsApp Inbound Message Ingestion & AI Dispatch');
  const waPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550001111',
                phone_number_id: '109923847281',
              },
              contacts: [
                {
                  profile: { name: 'Victoria Sterling' },
                  wa_id: '14155552671',
                },
              ],
              messages: [
                {
                  from: '14155552671',
                  id: `wamid.HBgLMTQxNTU1NTI2NzEVAgASGBQzQUJDMDEyMzQ1Njc_${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: {
                    body: 'Hello, what are your consultation hours for Morpheus8 skin tightening?',
                  },
                  type: 'text',
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const waInboundRes = await testPost('/webhooks/whatsapp', waPayload, 200);
  const waPassed = waInboundRes.passed && waInboundRes.json?.status === 'processed' && Boolean(waInboundRes.json?.replyText);
  results.push({
    name: 'WhatsApp Cloud Inbound Ingestion & Autonomous AI Reply',
    passed: waPassed,
    details: `Status: ${waInboundRes.status}, Reply: "${waInboundRes.json?.replyText?.slice(0, 60)}..."`,
  });
  console.log(`Result: ${waPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`AI Response: "${waInboundRes.json?.replyText}"\n`);

  // Test 6: Inbound Instagram Messaging Payload Ingestion
  console.log('[Test 1.6] Instagram DM Inbound Message Ingestion & AI Dispatch');
  const igPayload = {
    object: 'instagram',
    entry: [
      {
        id: 'IG_PAGE_ID_883',
        time: Date.now(),
        messaging: [
          {
            sender: { id: `ig_lead_user_${Date.now()}` },
            recipient: { id: 'IG_PAGE_ID_883' },
            timestamp: Date.now(),
            message: {
              mid: `m_ig_${Date.now()}`,
              text: 'Hi! Do you require a deposit to hold an appointment with Dr. Vance?',
            },
          },
        ],
      },
    ],
  };

  const igInboundRes = await testPost('/webhooks/instagram', igPayload, 200);
  const igPassed = igInboundRes.passed && igInboundRes.json?.status === 'processed' && Boolean(igInboundRes.json?.replyText);
  results.push({
    name: 'Instagram Direct Inbound Ingestion & Autonomous AI Reply',
    passed: igPassed,
    details: `Status: ${igInboundRes.status}, Reply: "${igInboundRes.json?.replyText?.slice(0, 60)}..."`,
  });
  console.log(`Result: ${igPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`AI Response: "${igInboundRes.json?.replyText}"\n`);

  // Summary
  console.log('=== Webhook Test Results Summary ===');
  let allPassed = true;
  for (const r of results) {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.name}`);
    if (!r.passed) allPassed = false;
  }

  if (allPassed) {
    console.log('\nAll Meta & Omnichannel Webhook Ingestion Tests Passed Successfully.');
  } else {
    console.error('\nSome Webhook Tests Failed.');
    process.exit(1);
  }
}

runWebhookTests().catch((err) => {
  console.error('[Webhook Test Fatal Error]', err);
  process.exit(1);
});
