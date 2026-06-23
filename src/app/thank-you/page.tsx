import { Suspense } from 'react';
import { db } from '@/lib/db';
import { waLinkFromText } from '@/lib/phone';
import { ThankYouContent } from './content';

// Resolve the CS contact info to show on the thank-you page. Prefer the contact of the program the
// buyer ordered (via Midtrans' order_id), falling back to any configured challenge contact (§21 —
// "Kontak (info lebih lanjut)" = Challenge.contactInfo). Returns null if none is set.
async function resolveContactInfo(orderCode?: string): Promise<string | null> {
  if (orderCode) {
    const order = await db.order
      .findUnique({ where: { orderCode }, include: { product: { include: { challenge: true } } } })
      .catch(() => null);
    const ci = order?.product.challenge?.contactInfo?.trim();
    if (ci) return ci;
  }
  const ch = await db.challenge
    .findFirst({ where: { contactInfo: { not: null } }, orderBy: { updatedAt: 'desc' }, select: { contactInfo: true } })
    .catch(() => null);
  return ch?.contactInfo?.trim() || null;
}

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const orderCode = pick('order_id') ?? pick('orderCode');

  const contactInfo = await resolveContactInfo(orderCode);
  const waLink = contactInfo ? waLinkFromText(contactInfo) : null;

  return (
    <main style={{ maxWidth: 480, margin: '48px auto', padding: '0 16px' }}>
      <Suspense fallback={<p>Memuat...</p>}>
        <ThankYouContent contactInfo={contactInfo} waLink={waLink} />
      </Suspense>
    </main>
  );
}
