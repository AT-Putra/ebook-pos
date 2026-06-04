'use client';

import { useSearchParams } from 'next/navigation';

export function ThankYouContent() {
  const params = useSearchParams();
  const orderCode = params.get('order_id') ?? params.get('orderCode');
  const status = params.get('transaction_status');

  const isPaid = !status || status === 'settlement' || status === 'capture';

  return (
    <>
      <h1>{isPaid ? '🎉 Pembayaran Berhasil!' : 'Status Pesanan'}</h1>

      {orderCode && (
        <p style={{ marginTop: 8, color: '#555', fontSize: '0.9rem' }}>
          Kode pesanan: <strong>{orderCode}</strong>
        </p>
      )}

      {isPaid ? (
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
    </>
  );
}
