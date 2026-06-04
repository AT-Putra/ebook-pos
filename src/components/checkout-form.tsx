'use client';

import { useState, FormEvent } from 'react';

type Props = {
  productSlug: string;
  trackingId: string;
};

type FieldErrors = Record<string, string[]>;

export function CheckoutForm({ productSlug, trackingId }: Props) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setGlobalError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      productSlug,
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      whatsapp: formData.get('whatsapp') as string,
      trackingId: formData.get('trackingId') as string || undefined,
    };

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.status === 422) {
        setErrors(data.fields ?? {});
        return;
      }

      if (!res.ok) {
        setGlobalError(data.error ?? 'Terjadi kesalahan. Silakan coba lagi.');
        return;
      }

      // F2 will supply snapToken / redirectUrl.
      // For now redirect to the redirect URL if present.
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch {
      setGlobalError('Gagal terhubung ke server. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ marginTop: 24 }}>
      <input type="hidden" name="trackingId" value={trackingId} />

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="name">Nama Lengkap</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px' }}
        />
        {errors.name && <p style={{ color: 'red', marginTop: 4 }}>{errors.name[0]}</p>}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="email">Alamat Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px' }}
        />
        {errors.email && <p style={{ color: 'red', marginTop: 4 }}>{errors.email[0]}</p>}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="whatsapp">Nomor WhatsApp</label>
        <input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          required
          autoComplete="tel"
          placeholder="08xxx atau +628xxx"
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px' }}
        />
        {errors.whatsapp && <p style={{ color: 'red', marginTop: 4 }}>{errors.whatsapp[0]}</p>}
      </div>

      <p style={{ fontSize: '0.8rem', color: '#555', marginBottom: 16 }}>
        Dengan melanjutkan, kamu menyetujui{' '}
        <a href="/privacy" target="_blank" rel="noreferrer">
          kebijakan privasi
        </a>{' '}
        kami. Data kamu hanya digunakan untuk pengiriman e-book.
      </p>

      {globalError && <p style={{ color: 'red', marginBottom: 12 }}>{globalError}</p>}

      <button
        type="submit"
        disabled={loading}
        style={{ padding: '12px 24px', fontSize: '1rem', cursor: loading ? 'wait' : 'pointer' }}
      >
        {loading ? 'Memproses...' : 'Bayar Sekarang'}
      </button>
    </form>
  );
}
