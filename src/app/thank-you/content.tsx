'use client';

import { useSearchParams } from 'next/navigation';

export function ThankYouContent({
  orderStatus,
  paidAtText,
  contactInfo,
  waLink,
}: {
  orderStatus: string | null;
  paidAtText: string | null;
  contactInfo: string | null;
  waLink: string | null;
}) {
  const params = useSearchParams();
  const orderCode = params.get('order_id') ?? params.get('orderCode');
  const status = params.get('transaction_status');

  // Confirmed by the DB (already paid — e.g. a repeat checkout for a product already bought).
  const confirmedPaid = orderStatus === 'PAID';
  // Optimistic (just came back from Midtrans before the webhook ran).
  const optimisticPaid = !status || status === 'settlement' || status === 'capture';

  return (
    <>
      <h1>{confirmedPaid ? '✅ Pembelian Selesai' : optimisticPaid ? '🎉 Pembayaran Berhasil!' : 'Status Pesanan'}</h1>

      {orderCode && (
        <p style={{ marginTop: 8, color: '#555', fontSize: '0.9rem' }}>
          Kode pesanan: <strong>{orderCode}</strong>
        </p>
      )}

      {confirmedPaid ? (
        <>
          <p style={{ marginTop: 16 }}>
            Kamu sudah menyelesaikan pembelian produk ini.
          </p>
          {paidAtText && (
            <p style={{ marginTop: 8, fontSize: '0.9rem', color: '#555' }}>
              Pembelian diselesaikan pada <strong>{paidAtText}</strong>.
            </p>
          )}
          <p style={{ marginTop: 8, fontSize: '0.9rem', color: '#555' }}>
            E-book sudah dikirim ke WhatsApp kamu. Jika belum kamu terima, silakan hubungi CS kami di bawah.
          </p>
        </>
      ) : optimisticPaid ? (
        <>
          <p style={{ marginTop: 16 }}>
            Terima kasih! E-book akan segera dikirim ke WhatsApp kamu dalam beberapa menit.
          </p>
          <p style={{ marginTop: 8, fontSize: '0.9rem', color: '#555' }}>
            Jika e-book belum kamu terima dalam 10 menit, silakan hubungi kami.
          </p>
        </>
      ) : (
        <p style={{ marginTop: 16 }}>
          Pembayaran sedang diproses. Kamu akan menerima e-book setelah pembayaran dikonfirmasi.
        </p>
      )}

      {contactInfo && (
        <div style={{ marginTop: 24, padding: '14px 16px', background: '#f8fafc', border: '1px solid #e7ebf0', borderRadius: 10 }}>
          <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>Butuh bantuan?</p>
          <p style={{ margin: '6px 0 0', fontSize: '0.88rem', color: '#475569', whiteSpace: 'pre-line' }}>
            Hubungi CS kami: {contactInfo}
          </p>
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-block', marginTop: 10, padding: '8px 16px', background: '#16a34a', color: '#fff', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}
            >
              💬 Hubungi CS via WhatsApp
            </a>
          )}
        </div>
      )}
    </>
  );
}
