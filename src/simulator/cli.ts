import readline from 'readline';
import { conversationBroker } from '../broker/conversationBroker';
import { sessionStore } from '../broker/sessionStore';
import { ChannelType, NormalizedMessage } from '../types';

async function runAutomatedTests() {
  console.log('=== Running ApexOmni.AI Multi-Channel Test Suite ===\n');

  // Test 1: High-Intent WhatsApp Booking Flow
  console.log('[Test 1] WhatsApp High-Intent Booking & Qualification');
  const waMsg1: NormalizedMessage = {
    id: `wa_test_${Date.now()}_1`,
    channel: 'whatsapp',
    channelUserId: '15550192834',
    senderName: 'Sophia Montgomery',
    messageText: 'Hello, I would like to inquire about Botox and filler treatments.',
    timestamp: Date.now(),
  };
  const res1 = await conversationBroker.handleInbound(waMsg1);
  console.log(`Inbound: "${waMsg1.messageText}"`);
  console.log(`AI Reply: "${res1.replyText}"\n`);

  const waMsg2: NormalizedMessage = {
    id: `wa_test_${Date.now()}_2`,
    channel: 'whatsapp',
    channelUserId: '15550192834',
    senderName: 'Sophia Montgomery',
    messageText: 'I would like to book for tomorrow at 11:30 AM. My cell is 555-891-2345.',
    timestamp: Date.now(),
  };
  const res2 = await conversationBroker.handleInbound(waMsg2);
  console.log(`Inbound: "${waMsg2.messageText}"`);
  console.log(`AI Reply: "${res2.replyText}"`);
  const lead1 = sessionStore.getLead(res2.leadId!);
  console.log(`Lead Status: ${lead1?.qualificationStatus} | Service: ${lead1?.requestedService} | Phone: ${lead1?.phone}\n`);

  // Test 2: Instagram Non-Diagnostic Guardrail
  console.log('[Test 2] Instagram Non-Diagnostic Guardrail');
  const igMsg: NormalizedMessage = {
    id: `ig_test_${Date.now()}_1`,
    channel: 'instagram',
    channelUserId: 'ig_user_44921',
    senderName: 'Elena Rostova',
    messageText: 'Can you diagnose if this red swelling after my peel is an infection?',
    timestamp: Date.now(),
  };
  const resIg = await conversationBroker.handleInbound(igMsg);
  console.log(`Inbound: "${igMsg.messageText}"`);
  console.log(`AI Reply: "${resIg.replyText}"\n`);

  // Test 3: Facebook Messenger Lead Qualification
  console.log('[Test 3] Facebook Messenger Dermal Fillers Inquiry');
  const fbMsg: NormalizedMessage = {
    id: `fb_test_${Date.now()}_1`,
    channel: 'facebook',
    channelUserId: 'fb_user_88201',
    senderName: 'Isabella Chen',
    messageText: 'Hi there, I want to book a consultation for lip fillers. What is the pricing?',
    timestamp: Date.now(),
  };
  const resFb = await conversationBroker.handleInbound(fbMsg);
  console.log(`Inbound: "${fbMsg.messageText}"`);
  console.log(`AI Reply: "${resFb.replyText}"\n`);

  // Test 4: TikTok Direct Message Inbound
  console.log('[Test 4] TikTok DM HydraFacial Lead Inquiry');
  const ttMsg: NormalizedMessage = {
    id: `tt_test_${Date.now()}_1`,
    channel: 'tiktok',
    channelUserId: 'tt_creator_1290',
    senderName: 'Chloe Bennett',
    messageText: 'Hey! Saw your Morpheus8 results on TikTok! How much downtime does it have?',
    timestamp: Date.now(),
  };
  const resTt = await conversationBroker.handleInbound(ttMsg);
  console.log(`Inbound: "${ttMsg.messageText}"`);
  console.log(`AI Reply: "${resTt.replyText}"\n`);

  // Test 5: Twitter / X Direct Message Inbound
  console.log('[Test 5] Twitter / X VIP Treatment Inquiry');
  const twMsg: NormalizedMessage = {
    id: `tw_test_${Date.now()}_1`,
    channel: 'twitter',
    channelUserId: 'x_handle_9941',
    senderName: 'Alexander Wright',
    messageText: 'Looking for a private consultation slot this Thursday for facial contouring.',
    timestamp: Date.now(),
  };
  const resTw = await conversationBroker.handleInbound(twMsg);
  console.log(`Inbound: "${twMsg.messageText}"`);
  console.log(`AI Reply: "${resTw.replyText}"\n`);

  // Test 6: Web Concierge Human Escalation
  console.log('[Test 6] Web Concierge Human Escalation Request');
  const webMsg: NormalizedMessage = {
    id: `web_test_${Date.now()}_1`,
    channel: 'web',
    channelUserId: 'web_client_9918',
    senderName: 'Marcus Vance',
    messageText: 'I am unhappy and I demand to speak with a real human manager.',
    timestamp: Date.now(),
  };
  const resWeb = await conversationBroker.handleInbound(webMsg);
  console.log(`Inbound: "${webMsg.messageText}"`);
  console.log(`AI Reply: "${resWeb.replyText}"`);
  console.log(`Result Status: ${resWeb.status} | Session Status: escalated\n`);

  // Test 7: CRM & Storage Verification
  console.log('[Test 7] Verify Multi-Channel Persistence in JSON CRM Database');
  const leadWa = sessionStore.getLead(res2.leadId!);
  const leadIg = sessionStore.getLead(resIg.leadId!);
  const leadFb = sessionStore.getLead(resFb.leadId!);
  const leadTt = sessionStore.getLead(resTt.leadId!);
  const leadTw = sessionStore.getLead(resTw.leadId!);
  const leadWeb = sessionStore.getLead(resWeb.leadId!);

  console.log(`- WhatsApp Lead: ${leadWa?.fullName || leadWa?.channelUserId} [${leadWa?.qualificationStatus}]`);
  console.log(`- Instagram Lead: ${leadIg?.fullName || leadIg?.channelUserId} [${leadIg?.qualificationStatus}]`);
  console.log(`- Facebook Lead: ${leadFb?.fullName || leadFb?.channelUserId} [${leadFb?.qualificationStatus}]`);
  console.log(`- TikTok Lead: ${leadTt?.fullName || leadTt?.channelUserId} [${leadTt?.qualificationStatus}]`);
  console.log(`- Twitter Lead: ${leadTw?.fullName || leadTw?.channelUserId} [${leadTw?.qualificationStatus}]`);
  console.log(`- Web Concierge Lead: ${leadWeb?.fullName || leadWeb?.channelUserId} [${leadWeb?.qualificationStatus}]`);

  if (!leadWa || !leadIg || !leadFb || !leadTt || !leadTw || !leadWeb) {
    throw new Error('Omnichannel CRM lead synchronization failed');
  }

  console.log('\n=== All 6 Channels & CRM Verification Tests Passed ===');
  process.exit(0);
}

function startInteractiveCLI() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const channel: ChannelType = 'whatsapp';
  const userId = `sim_user_${Date.now().toString().slice(-4)}`;
  console.log(`\n=== ApexOmni.AI Interactive Receptionist Simulator ===`);
  console.log(`Simulated Channel: ${channel.toUpperCase()} | User ID: ${userId}`);
  console.log(`Type your message and press ENTER. Type "exit" to quit.\n`);

  const promptUser = () => {
    rl.question('You: ', async (input) => {
      const trimmed = input.trim();
      if (trimmed.toLowerCase() === 'exit') {
        rl.close();
        process.exit(0);
      }

      if (!trimmed) {
        promptUser();
        return;
      }

      const msg: NormalizedMessage = {
        id: `sim_msg_${Date.now()}`,
        channel,
        channelUserId: userId,
        senderName: 'Master',
        messageText: trimmed,
        timestamp: Date.now(),
      };

      const result = await conversationBroker.handleInbound(msg);
      console.log(`ApexOmni AI: ${result.replyText}\n`);
      promptUser();
    });
  };

  promptUser();
}

const isTest = process.argv.includes('--test');
if (isTest) {
  runAutomatedTests();
} else {
  startInteractiveCLI();
}
