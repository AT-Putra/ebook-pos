import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { CheckoutForm } from '@/components/checkout-form';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string }>;
};

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { ref } = await searchParams;

  const product = await db.product.findUnique({ where: { slug } });

  if (!product || !product.isActive) {
    notFound();
  }

  return (
    <main style={{ maxWidth: 480, margin: '48px auto', padding: '0 16px' }}>
      <h1>{product.name}</h1>
      {product.description && <p>{product.description}</p>}
      <p>
        Harga: <strong>Rp {product.priceIdr.toLocaleString('id-ID')}</strong>
      </p>
      <CheckoutForm
        productSlug={product.slug}
        trackingId={ref ?? ''}
      />
    </main>
  );
}
