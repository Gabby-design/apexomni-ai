export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'check_availability',
    description: 'Get open appointment slots for a service on a given date range.',
    parameters: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Type of treatment or service, e.g. Morpheus8, Botox, Dermal Fillers.',
        },
        date_from: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format or relative date like tomorrow.',
        },
        date_to: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format.',
        },
      },
      required: ['service', 'date_from'],
    },
  },
  {
    name: 'create_booking',
    description: 'Create a pending appointment after the customer picks a slot.',
    parameters: {
      type: 'object',
      properties: {
        customer_name: { type: 'string', description: 'Full name of the client.' },
        phone: { type: 'string', description: 'Contact phone number.' },
        email: { type: 'string', description: 'Email address (optional).' },
        service: { type: 'string', description: 'Requested procedure name.' },
        start_time: { type: 'string', description: 'Selected appointment start time or slot.' },
        notes: { type: 'string', description: 'Optional special notes or requests.' },
      },
      required: ['customer_name', 'phone', 'service', 'start_time'],
    },
  },
  {
    name: 'send_payment_link',
    description: 'Generate and return a deposit or payment link for a booking.',
    parameters: {
      type: 'object',
      properties: {
        booking_id: { type: 'string', description: 'ID of the created booking.' },
      },
      required: ['booking_id'],
    },
  },
  {
    name: 'reschedule_booking',
    description: 'Move an existing booking to a new time.',
    parameters: {
      type: 'object',
      properties: {
        booking_id: { type: 'string', description: 'ID of the appointment to reschedule.' },
        new_start_time: { type: 'string', description: 'New requested start time.' },
      },
      required: ['booking_id', 'new_start_time'],
    },
  },
  {
    name: 'cancel_booking',
    description: 'Cancel an existing booking.',
    parameters: {
      type: 'object',
      properties: {
        booking_id: { type: 'string', description: 'ID of the appointment to cancel.' },
        reason: { type: 'string', description: 'Reason for cancellation.' },
      },
      required: ['booking_id'],
    },
  },
  {
    name: 'save_lead',
    description: 'Save or update lead details even if they do not book yet.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        interest: { type: 'string' },
        channel: { type: 'string' },
        status: {
          type: 'string',
          enum: ['new', 'warm', 'hot', 'booked', 'lost'],
        },
      },
      required: ['interest', 'channel'],
    },
  },
  {
    name: 'handoff_to_human',
    description: 'Escalate to the business owner/staff with a short summary.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Reason for human handoff.' },
        summary: { type: 'string', description: 'Short summary of the interaction.' },
        urgency: {
          type: 'string',
          enum: ['normal', 'urgent'],
        },
      },
      required: ['reason', 'summary'],
    },
  },

  // Aliases for backward compatibility
  {
    name: 'checkAvailability',
    description: 'Alias for check_availability.',
    parameters: {
      type: 'object',
      properties: {
        dateRange: { type: 'string' },
        serviceType: { type: 'string' },
        timezone: { type: 'string' },
      },
      required: ['dateRange', 'serviceType'],
    },
  },
  {
    name: 'bookAppointment',
    description: 'Alias for create_booking.',
    parameters: {
      type: 'object',
      properties: {
        slotId: { type: 'string' },
        leadDetails: {
          type: 'object',
          properties: {
            fullName: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['fullName', 'phone'],
        },
        serviceType: { type: 'string' },
      },
      required: ['slotId', 'leadDetails', 'serviceType'],
    },
  },
  {
    name: 'updateLeadProfile',
    description: 'Alias for save_lead.',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        patchData: { type: 'object' },
      },
      required: ['leadId', 'patchData'],
    },
  },
  {
    name: 'escalateToStaff',
    description: 'Alias for handoff_to_human.',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        channel: { type: 'string' },
        reason: { type: 'string' },
        urgencyLevel: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
      },
      required: ['leadId', 'channel', 'reason', 'urgencyLevel'],
    },
  },
];
