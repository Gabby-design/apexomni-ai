import { JsonStorageAdapter } from '../db/jsonAdapter';
import { PostgresStorageAdapter } from '../db/postgresAdapter';
import { createStorageAdapter, storageService } from '../db';
import { LeadProfile, ConversationSession, BookingConfirmation } from '../types';
import { env } from '../config/env';

async function runStorageVerification() {
  console.log('=== ApexOmni.AI StorageAdapter & Persistence Verification ===\n');

  // Test 1: Factory Resolution & Active Driver Health
  console.log('[Test 1] Storage Factory Resolution');
  const health = await storageService.getHealth();
  console.log(`Active Storage Driver: ${health.driver}`);
  console.log(`Connection Status: ${health.connected ? 'ONLINE' : 'OFFLINE'}`);
  console.log(`Driver Details: ${health.details}\n`);

  if (!health.connected) {
    throw new Error('Default storage adapter health check failed');
  }

  // Test 2: JsonStorageAdapter Contract Verification
  console.log('[Test 2] JsonStorageAdapter Core CRUD & Deduplication');
  const jsonAdapter = new JsonStorageAdapter();
  await jsonAdapter.init();

  const testMsgId = `test_msg_${Date.now()}`;
  const isDupeBefore = await jsonAdapter.hasMessage(testMsgId);
  await jsonAdapter.addMessageId(testMsgId);
  const isDupeAfter = await jsonAdapter.hasMessage(testMsgId);

  if (isDupeBefore || !isDupeAfter) {
    throw new Error('JsonStorageAdapter deduplication check failed');
  }
  console.log('  Deduplication: Verified');

  // Lead CRUD
  const testLead: LeadProfile = {
    id: `lead_test_${Date.now()}`,
    channel: 'web',
    channelUserId: 'usr_test_999',
    fullName: 'Audrey Hepburn',
    phone: '+13105550199',
    email: 'audrey@breakfast.luxury',
    requestedService: 'HydraFacial Deluxe',
    qualificationStatus: 'qualified',
    notes: ['VIP recurring client', 'Prefers morning slots'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await jsonAdapter.saveLead(testLead);
  const fetchedLead = await jsonAdapter.getLead(testLead.id);
  const foundLead = await jsonAdapter.findLeadByChannelUser('web', 'usr_test_999');

  if (!fetchedLead || fetchedLead.fullName !== testLead.fullName || !foundLead) {
    throw new Error('JsonStorageAdapter lead storage failed');
  }
  console.log('  Lead Persistence & Lookup: Verified');

  // Session & Message CRUD
  const testSession: ConversationSession = {
    id: `sess_test_${Date.now()}`,
    channel: 'web',
    channelUserId: 'usr_test_999',
    leadId: testLead.id,
    status: 'active',
    history: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastMessageTimestamp: Date.now(),
  };

  await jsonAdapter.saveSession(testSession);
  await jsonAdapter.addSessionMessage(testSession.id, {
    role: 'user',
    content: 'Can I book for 2pm tomorrow?',
    timestamp: Date.now(),
  });
  await jsonAdapter.updateSessionStatus(testSession.id, 'completed');

  const fetchedSession = await jsonAdapter.getSession(testSession.id);
  if (!fetchedSession || fetchedSession.history.length !== 1 || fetchedSession.status !== 'completed') {
    throw new Error('JsonStorageAdapter session persistence failed');
  }
  console.log('  Session & History Append: Verified');

  // Booking CRUD
  const testBooking: BookingConfirmation = {
    bookingId: `bk_test_${Date.now()}`,
    slotId: 'slot_99',
    clientName: testLead.fullName!,
    serviceType: 'HydraFacial Deluxe',
    startTime: '2026-10-10 14:00',
    depositStatus: 'hold',
    confirmationUrl: 'https://apexomni.ai/confirm/bk_test',
  };

  await jsonAdapter.saveBooking(testBooking);
  const fetchedBooking = await jsonAdapter.getBooking(testBooking.bookingId);
  const updatedDeposit = await jsonAdapter.updateDepositStatus(testBooking.bookingId, 'collected');

  if (!fetchedBooking || !updatedDeposit) {
    throw new Error('JsonStorageAdapter booking persistence failed');
  }
  const allBookings = await jsonAdapter.getAllBookings();
  if (allBookings.length === 0) {
    throw new Error('JsonStorageAdapter getAllBookings empty');
  }
  console.log('  Booking & Deposit Status Update: Verified\n');

  // Test 3: Optional PostgreSQL Adapter Test (if DATABASE_URL configured)
  if (env.DATABASE_URL && (env.DATABASE_URL.startsWith('postgres://') || env.DATABASE_URL.startsWith('postgresql://'))) {
    console.log('[Test 3] Live PostgreSQL Storage Adapter Verification');
    const pgAdapter = new PostgresStorageAdapter({
      connectionString: env.DATABASE_URL,
      ssl: env.DATABASE_SSL,
    });
    await pgAdapter.init();

    const pgHealth = await pgAdapter.getHealth();
    console.log(`  Postgres Health: ${pgHealth.connected ? 'ONLINE' : 'OFFLINE'} (${pgHealth.details})`);
    if (!pgHealth.connected) {
      throw new Error('PostgreSQL health check failed');
    }

    // Run identical operations
    await pgAdapter.addMessageId(testMsgId);
    const pgDupe = await pgAdapter.hasMessage(testMsgId);
    if (!pgDupe) throw new Error('Postgres message deduplication failed');

    await pgAdapter.saveLead(testLead);
    const pgLead = await pgAdapter.getLead(testLead.id);
    if (!pgLead || pgLead.fullName !== testLead.fullName) throw new Error('Postgres lead failed');

    await pgAdapter.saveBooking(testBooking);
    const pgBooking = await pgAdapter.getBooking(testBooking.bookingId);
    if (!pgBooking) throw new Error('Postgres booking failed');

    await pgAdapter.close();
    console.log('  Postgres Integration: Fully Verified\n');
  } else {
    console.log('[Test 3] Live PostgreSQL Storage (Skipped - DATABASE_URL not set)\n');
  }

  await jsonAdapter.close();
  console.log('=== All Persistence & StorageAdapter Tests Passed Successfully ===');
}

runStorageVerification().catch((err) => {
  console.error('[Storage Test Error]', err);
  process.exit(1);
});
