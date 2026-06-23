'use client';

import { useState, FormEvent } from 'react';

/** Public download form: enter the registered WhatsApp number → POST → stream the PDF. */
export function DownloadForm({ token }: { token: string }) {
  const [whatsapp, setWhatsapp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`/api/download/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Gagal mengunduh. Coba lagi.');
        return;
      }

      // Stream the PDF blob to a download.
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="?([^"]+)"?/.exec(cd);
      const fileName = match?.[1] ?? 'ebook.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', border: '1px solid #e7ebf0', borderRadius: 12, padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Download E-book</h1>
        <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
          Masukkan nomor WhatsApp yang kamu pakai saat membeli untuk mengunduh e-book kamu.
        </p>

        {done ? (
          <div style={{ fontSize: '0.9rem', color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px' }}>
            ✅ E-book sedang diunduh. Jika unduhan tidak mulai otomatis, kirim ulang formulir di bawah.
          </div>
        ) : null}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: done ? 16 : 0 }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: '#475569', display: 'block', marginBottom: 5 }}>Nomor WhatsApp</label>
            <input
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              required
              inputMode="tel"
              placeholder="08xxxxxxxxxx"
              style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', fontSize: '0.95rem', boxSizing: 'border-box' }}
            />
          </div>

          {error && (
            <p style={{ fontSize: '0.82rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '9px 12px', margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{ padding: '11px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.95rem', fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? 'Memproses…' : 'Download E-book'}
          </button>
        </form>
      </div>
    </main>
  );
}
