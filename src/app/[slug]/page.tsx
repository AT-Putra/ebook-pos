import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { CheckoutForm } from '@/components/checkout-form';
import { isOnSale, salesStatus } from '@/lib/programs';

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

  const onSale = isOnSale(product);
  const status = salesStatus(product);

  return (
    <main style={{ maxWidth: 480, margin: '48px auto', padding: '0 16px' }}>
      <h1>{product.name}</h1>
      {product.description && <p>{product.description}</p>}
      <p>
        Harga: <strong>Rp {product.priceIdr.toLocaleString('id-ID')}</strong>
      </p>
      {onSale ? (
        <CheckoutForm productSlug={product.slug} trackingId={ref ?? ''} />
      ) : (
        <div
          style={{
            marginTop: 16,
            padding: '16px 18px',
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
          }}
        >
          <strong>
            {status === 'scheduled' ? 'Penjualan belum dibuka.' : 'Penjualan ditutup.'}
          </strong>
          <p style={{ margin: '6px 0 0', fontSize: '0.9rem' }}>
            {status === 'scheduled'
              ? 'Produk ini belum tersedia untuk dibeli. Silakan kembali lagi nanti.'
              : 'Maaf, periode penjualan produk ini telah berakhir.'}
          </p>
        </div>
      )}
    </main>
  );
}
