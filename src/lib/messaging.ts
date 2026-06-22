import { db } from './db';
import { env } from './env';
import { wahaEngine } from './waha';
import { fonnteEngine } from './fonnte';

// Switchable WhatsApp engine (slice D15, §24). A single global active provider for ALL outbound
// WhatsApp (e-book/attachment delivery + challenge reminders/acks + the test-send). The engine is
// selected by the `MessagingConfig` singleton (Pengaturan UI) and resolved here.

export type WaEngineName = 'waha' | 'fonnte';

export type WaSendFileParams = {
  phone: string; // normalized 628… digits — the adapter formats it (WAHA → …@c.us, Fonnte → bare)
  mimeType: string;
  filename: string;
  base64Data: string;
  caption?: string;
};

export type WaSendTextParams = {
  phone: string;
  text: string;
  messageId?: string;
};

export type WaSendResult = { id: string };

/** A pluggable WhatsApp provider. `sendText` is the humanized path (§12.2.1); `sendFile` is
 *  the transactional file path (exempt from humanization). */
export interface WaEngine {
  name: WaEngineName;
  sendFile(p: WaSendFileParams): Promise<WaSendResult>;
  sendText(p: WaSendTextParams): Promise<WaSendResult>;
}

export const DEFAULT_ENGINE: WaEngineName = 'waha';

/** Pure: coerces an arbitrary stored/string value to a known engine name (defaults to WAHA). */
export function normalizeEngineName(value: string | null | undefined): WaEngineName {
  return value === 'fonnte' ? 'fonnte' : 'waha';
}

const ENGINES: Record<WaEngineName, WaEngine> = {
  waha: wahaEngine,
  fonnte: fonnteEngine,
};

// ── Config (cached read; cleared on update) — same pattern as lib/rate-limit.ts ──
let cache: { value: WaEngineName; at: number } | null = null;
const CONFIG_TTL_MS = 10_000;

export function clearMessagingConfigCache() {
  cache = null;
}

export async function getActiveEngineName(): Promise<WaEngineName> {
  if (cache && Date.now() - cache.at < CONFIG_TTL_MS) return cache.value;
  const row = await db.messagingConfig.findUnique({ where: { id: 'default' } });
  const value = normalizeEngineName(row?.engine);
  cache = { value, at: Date.now() };
  return value;
}

/** Resolves the currently-active WhatsApp engine. */
export async function getWaEngine(): Promise<WaEngine> {
  return ENGINES[await getActiveEngineName()];
}

/** Whether the Fonnte env is present (for the settings UI to warn — never exposes the token). */
export function isFonnteConfigured(): boolean {
  return env.FONNTE_TOKEN.length > 0;
}

/** Whether the Fonnte inbound webhook secret is configured. */
export function isFonnteWebhookConfigured(): boolean {
  return env.FONNTE_WEBHOOK_SECRET.length > 0;
}
