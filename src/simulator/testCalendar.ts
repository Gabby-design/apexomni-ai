import { ToolRunner } from '../agent/toolRunner';
import { dbService } from '../db';
import { env } from '../config/env';

async function runCalendarTests() {
  const baseUrl = `http://localhost:${env.PORT}`;
  console.log('=== ApexOmni.AI Calendar & Deposit Workflow Verification ===\n');

  // Test 1: Availability check
  console.log('[Test 2.1] Fetch Available VIP Clinic Slots');
  const slotsRes = await ToolRunner.checkAvailability({
    dateRange: 'next 48 hours',
    serviceType: 'Morpheus8 RF Microneedling',
  });
  console.log(`Available Slots Found: ${slotsRes.availableSlots.length}`);
  if (slotsRes.availableSlots.length === 0) {
    throw new Error('No available slots returned');
  }
  const selectedSlot = slotsRes.availableSlots[0];
  console.log(`Selected Slot: ${selectedSlot.slotId} at ${selectedSlot.startTime} with ${selectedSlot.providerName}\n`);

  // Test 2: Booking creation and slot lock
  console.log('[Test 2.2] Book Appointment and Lock Slot with Deposit Hold');
  const booking = await ToolRunner.bookAppointment({
    slotId: selectedSlot.slotId,
    leadDetails: {
      fullName: 'Genevieve Du Pont',
      phone: '+14155559812',
      email: 'genevieve@dupont.luxury',
    },
    serviceType: 'Morpheus8 RF Microneedling',
  });
  console.log(`Booking ID: ${booking.bookingId}`);
  console.log(`Client: ${booking.clientName}`);
  console.log(`Service: ${booking.serviceType}`);
  console.log(`Initial Deposit Status: ${booking.depositStatus}`);
  console.log(`Confirmation URL: ${booking.confirmationUrl}\n`);

  if (!booking.bookingId || booking.depositStatus !== 'hold') {
    throw new Error('Booking creation failed or initial deposit status is not hold');
  }

  // Test 3: Query appointments via REST API
  console.log('[Test 2.3] Verify Appointment via REST Endpoint (GET /api/appointments)');
  const apiRes = await fetch(`${baseUrl}/api/appointments`);
  const apiData = await apiRes.json();
  console.log(`REST Bookings Count: ${apiData.count}`);
  const match = apiData.bookings.find((b: any) => b.bookingId === booking.bookingId);
  if (!match) {
    throw new Error(`Booking ${booking.bookingId} not found in REST /api/appointments output`);
  }
  console.log(`Verified booking in REST output: ${match.bookingId} (status: ${match.depositStatus})\n`);

  // Test 4: Deposit confirmation webhook
  console.log('[Test 2.4] Simulate Payment Deposit Webhook (POST /api/deposit/webhook)');
  const webhookRes = await fetch(`${baseUrl}/api/deposit/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookingId: booking.bookingId,
      status: 'collected',
    }),
  });
  const webhookData = await webhookRes.json();
  console.log(`Deposit Webhook Response:`, webhookData);
  if (!webhookData.success || webhookData.depositStatus !== 'collected') {
    throw new Error('Deposit status update failed');
  }

  // Test 5: Verify status update persisted in database and API
  console.log('\n[Test 2.5] Verify Persisted State in Database & API');
  const recheckRes = await fetch(`${baseUrl}/api/appointments`);
  const recheckData = await recheckRes.json();
  const updatedMatch = recheckData.bookings.find((b: any) => b.bookingId === booking.bookingId);
  console.log(`Updated Deposit Status for ${booking.bookingId}: ${updatedMatch?.depositStatus}`);
  if (updatedMatch?.depositStatus !== 'collected') {
    throw new Error('Persisted depositStatus did not update to collected');
  }

  console.log('\n=== All Calendar Slot Locking & Deposit Workflow Tests Passed ===');
}

runCalendarTests().catch((err) => {
  console.error('[Calendar Test Fatal Error]', err);
  process.exit(1);
});
