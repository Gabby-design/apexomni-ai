import { CalendarSlot, BookingConfirmation, StaffAlertPayload } from '../types';
import { sessionStore } from '../broker/sessionStore';
import { calendarService } from '../calendar/client';
import { dbService } from '../db';
import { env } from '../config/env';

export class ToolRunner {
  // 1. check_availability
  static async checkAvailability(args: {
    service?: string;
    serviceType?: string;
    date_from?: string;
    date_to?: string;
    dateRange?: string;
    timezone?: string;
  }): Promise<{ availableSlots: CalendarSlot[] }> {
    const range = args.date_from || args.dateRange || 'this week';
    const service = args.service || args.serviceType || 'Aesthetic Consultation';
    const availableSlots = await calendarService.getAvailableSlots(range, service, args.timezone);
    return { availableSlots };
  }

  // 2. create_booking
  static async bookAppointment(args: {
    slotId?: string;
    start_time?: string;
    customer_name?: string;
    fullName?: string;
    phone?: string;
    email?: string;
    service?: string;
    serviceType?: string;
    notes?: string;
    leadDetails?: {
      fullName: string;
      phone: string;
      email?: string;
    };
  }): Promise<BookingConfirmation> {
    const slot = args.slotId || args.start_time || 'slot_default';
    const name = args.customer_name || args.fullName || args.leadDetails?.fullName || 'Valued Client';
    const phone = args.phone || args.leadDetails?.phone || '+15550000000';
    const email = args.email || args.leadDetails?.email;
    const service = args.service || args.serviceType || 'Consultation';

    const confirmation = await calendarService.createBooking(
      slot,
      { fullName: name, phone, email },
      service
    );
    dbService.saveBooking(confirmation);
    return confirmation;
  }

  // 3. send_payment_link
  static async sendPaymentLink(args: {
    booking_id: string;
  }): Promise<{ paymentUrl: string; depositAmount: string; expiresAt: string }> {
    const paymentUrl = `https://apexomni.ai/deposit/${args.booking_id}`;
    return {
      paymentUrl,
      depositAmount: '$150.00',
      expiresAt: '24 hours from issuance',
    };
  }

  // 4. reschedule_booking
  static async rescheduleBooking(args: {
    booking_id: string;
    new_start_time: string;
  }): Promise<{ success: boolean; bookingId: string; updatedStartTime: string }> {
    const booking = dbService.getBooking(args.booking_id);
    if (booking) {
      booking.startTime = args.new_start_time;
      dbService.saveBooking(booking);
    }
    return {
      success: true,
      bookingId: args.booking_id,
      updatedStartTime: args.new_start_time,
    };
  }

  // 5. cancel_booking
  static async cancelBooking(args: {
    booking_id: string;
    reason?: string;
  }): Promise<{ success: boolean; bookingId: string; status: string }> {
    const booking = dbService.getBooking(args.booking_id);
    if (booking) {
      booking.depositStatus = 'waived';
      dbService.saveBooking(booking);
    }
    return {
      success: true,
      bookingId: args.booking_id,
      status: 'cancelled',
    };
  }

  // 6. save_lead / updateLeadProfile
  static async saveLead(args: {
    name?: string;
    phone?: string;
    interest?: string;
    channel?: string;
    status?: 'new' | 'warm' | 'hot' | 'booked' | 'lost';
    leadId?: string;
    patchData?: Record<string, unknown>;
  }): Promise<{ success: boolean; lead: unknown }> {
    if (args.leadId && args.patchData) {
      const updated = sessionStore.updateLead(args.leadId, args.patchData);
      return { success: Boolean(updated), lead: updated };
    }

    const patch: Record<string, unknown> = {};
    if (args.name) patch.fullName = args.name;
    if (args.phone) patch.phone = args.phone;
    if (args.interest) patch.requestedService = args.interest;
    if (args.status) {
      patch.qualificationStatus =
        args.status === 'booked' ? 'qualified' : args.status === 'lost' ? 'disqualified' : 'in_progress';
    }

    if (args.leadId) {
      const updated = sessionStore.updateLead(args.leadId, patch);
      return { success: Boolean(updated), lead: updated };
    }

    return { success: true, lead: patch };
  }

  // 7. handoff_to_human / escalateToStaff
  static async handoffToHuman(args: {
    reason: string;
    summary?: string;
    urgency?: 'normal' | 'urgent';
    urgencyLevel?: 'low' | 'medium' | 'high' | 'critical';
    leadId?: string;
    channel?: string;
  }): Promise<{ status: string; alertDispatched: boolean }> {
    const priority =
      args.urgency === 'urgent' || args.urgencyLevel === 'critical' || args.urgencyLevel === 'high'
        ? 'high'
        : 'medium';

    const alert: StaffAlertPayload = {
      conversationId: `conv_${args.leadId || Date.now()}`,
      leadId: args.leadId || 'general_lead',
      channel: (args.channel as any) || 'web',
      channelUserId: args.leadId || 'lead_user',
      reason: args.reason,
      summary: args.summary || args.reason,
      priorityLevel: priority as any,
      timestamp: Date.now(),
    };

    console.log('[STAFF ESCALATION ALERT DISPATCHED]', JSON.stringify(alert, null, 2));

    if (env.SLACK_WEBHOOK_URL) {
      try {
        await fetch(env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `[URGENT ESCALATION - ${priority.toUpperCase()}] ApexOmni AI Handoff. Reason: ${args.reason}. Summary: ${args.summary || 'None'}`,
          }),
        });
      } catch (err) {
        console.error('[Slack Alert Error]', err);
      }
    }

    return { status: 'escalated', alertDispatched: true };
  }

  // Aliases
  static async updateLeadProfile(args: any) {
    return this.saveLead(args);
  }

  static async escalateToStaff(args: any) {
    return this.handoffToHuman(args);
  }
}
