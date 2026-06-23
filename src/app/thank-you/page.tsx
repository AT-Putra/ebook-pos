import { Suspense } from 'react';
import { db } from '@/lib/db';
import { waLinkFromText } from '@/lib/phone';
import { ThankYouContent } from './content';

/** Formats a date in Indonesian, WIB. */
function formatWib(d: Date): string {
  return (
    new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(d) +
    ' WIB'
  );
}

// Fallback CS contact (any configured challenge) when the order doesn't resolve one (§21 —
// "Kontak (info lebih lanjut)" = Challenge.contactInfo).
async function fallbackContactInfo(): Promise<string | null> {
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

  let orderStatus: string | null = null;
  let paidAtText: string | null = null;
  let contactInfo: string | null = null;

  if (orderCode) {
    const order = await db.order
      .findUnique({ where: { orderCode }, include: { product: { include: { challenge: true } } } })
      .catch(() => null);
    if (order) {
      orderStatus = order.status;
      if (order.paidAt) paidAtText = formatWib(order.paidAt);
      contactInfo = order.product.challenge?.contactInfo?.trim() || null;
    }
  }
  if (!contactInfo) contactInfo = await fallbackContactInfo();
  const waLink = contactInfo ? waLinkFromText(contactInfo) : null;

  return (
    <main style={{ maxWidth: 480, margin: '48px auto', padding: '0 16px' }}>
      <Suspense fallback={<p>Memuat...</p>}>
        <ThankYouContent orderStatus={orderStatus} paidAtText={paidAtText} contactInfo={contactInfo} waLink={waLink} />
      </Suspense>
    </main>
  );
}
