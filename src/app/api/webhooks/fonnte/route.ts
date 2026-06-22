import { NextRequest, NextResponse } from 'next/server';
import {
  parseFonnteInbound,
  isFonnteVideo,
  fonnteInboundMessageId,
  verifyFonnteWebhookToken,
  downloadFonnteMedia,
} from '@/lib/fonnte';
import { findActiveChallengeOrderByWhatsapp, storeProofSubmission } from '@/lib/challenge-inbox';
import { normalizeIndonesianPhone } from '@/lib/phone';

// Fonnte inbound message webhook — auto-captures challenge proof videos when the active engine is
// Fonnte (slice D15, §24.4). Fonnte exposes NO HMAC, so this route authenticates with a shared
// secret in the URL: configure the device webhook as `…/api/webhooks/fonnte?token=<FONNTE_WEBHOOK_SECRET>`.
// Fonnte's `sender` is a plain phone number (no `…@lid`) and media is a public `url`. Always acks 200
// quickly to valid calls. The store/record/advance/ack core is shared with the WAHA webhook.

const TAG = '[fonnte-inbox]';

export async function POST(req: NextRequest) {
  // 1. Authenticate (shared secret in the URL). Fails closed if FONNTE_WEBHOOK_SECRET is unset.
  const token = req.nextUrl.searchParams.get('token');
  if (!verifyFonnteWebhookToken(token)) {
    console.warn(`${TAG} 401 rejected: invalid/missing ?token (check FONNTE_WEBHOOK_SECRET matches the Fonnte webhook URL)`);
    return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
  }

  // 2. Parse the form payload (Fonnte posts form-encoded / multipart fields).
  let fields: Record<string, string>;
  try {
    const form = await req.formData();
    fields = {};
    for (const [k, v] of form.entries()) if (typeof v === 'string') fields[k] = v;
  } catch {
    console.warn(`${TAG} 400 invalid form body`);
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
  }

  const inbound = parseFonnteInbound(fields);
  console.log(`${TAG} received sender=%s hasUrl=%s ext=%s`, inbound.sender, !!inbound.mediaUrl, inbound.extension);

  const ignore = (reason: string) => {
    console.log(`${TAG} ignored: ${reason}`);
    return NextResponse.json({ ok: true, ignored: reason });
  };

  // 3. Only inbound video attachments matter.
  if (!inbound.sender) return ignore('no-sender');
  if (!isFonnteVideo(inbound)) return ignore('no-video');
  const mediaUrl = inbound.mediaUrl!;

  // 4. Resolve the sender to a normalized phone number (Fonnte gives a plain number — no LID).
  let whatsapp: string;
  try {
    whatsapp = normalizeIndonesianPhone(inbound.sender);
  } catch {
    return ignore('bad-number');
  }

  // 5. Match → a PAID order for a challenge-active program.
  const order = await findActiveChallengeOrderByWhatsapp(whatsapp);
  if (!order || !order.product.challenge || !order.paidAt) {
    return ignore('no-active-challenge');
  }

  // 6. Hand off to the shared, engine-agnostic core.
  const result = await storeProofSubmission({
    order,
    whatsapp,
    messageId: fonnteInboundMessageId(inbound),
    mimeTypeHint: 'video/mp4',
    rawPayload: fields,
    downloadMedia: () => downloadFonnteMedia(mediaUrl),
  });

  if (result.status === 'ignored') return ignore(result.reason ?? 'ignored');
  return NextResponse.json({ ok: true });
}
