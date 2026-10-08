import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // LLM Providers
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Meta Cloud API
  META_APP_SECRET: z.string().optional(),
  META_VERIFY_TOKEN: z.string().default('apexomni_verify_token'),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  INSTAGRAM_PAGE_ACCESS_TOKEN: z.string().optional(),
  FACEBOOK_PAGE_ACCESS_TOKEN: z.string().optional(),

  // TikTok API
  TIKTOK_APP_ID: z.string().optional(),
  TIKTOK_APP_SECRET: z.string().optional(),
  TIKTOK_ACCESS_TOKEN: z.string().optional(),

  // Twitter / X API
  TWITTER_API_KEY: z.string().optional(),
  TWITTER_API_SECRET: z.string().optional(),
  TWITTER_BEARER_TOKEN: z.string().optional(),

  // Calendars
  CALENDLY_API_KEY: z.string().optional(),
  CAL_COM_API_KEY: z.string().optional(),
  CLINIC_CALENDAR_ID: z.string().optional(),

  // Alerts & Persistence
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  SLACK_WEBHOOK_URL: z.string().optional(),
  STAFF_ALERT_PHONE: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const env: EnvConfig = envSchema.parse(process.env);
