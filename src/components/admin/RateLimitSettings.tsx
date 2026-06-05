'use client';

import { useState, useEffect, FormEvent } from 'react';

type Config = { enabled: boolean; maxRequests: number; windowSeconds: number };

export function RateLimitSettings() {
  const [config, setConfig] = useState<Config | null>(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/rate-limit')
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setConfig(d.config));
  }, []);

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!config) return;
    setStatus('');
    setSaving(true);
    try {
      const res = await fetch('/api/admin/rate-limit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setConfig((await res.json()).config);
        setStatus('Tersimpan.');
      } else {
        setStatus((await res.json()).error ?? 'Gagal menyimpan.');
      }
    } finally {
      setSaving(false);
    }
  }

  const card: React.CSSProperties = { background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1.1rem 1.25rem', maxWidth: 760 };
  const input: React.CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 6, padding: '7px 10px', fontSize: '0.875rem', width: 120 };

  if (!config) return <div style={card}><p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Memuat…</p></div>;

  return (
    <div style={card}>
      <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 4px' }}>Rate Limit Checkout</h2>
      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem' }}>
        Batasi jumlah percobaan checkout per alamat IP untuk mencegah spam. Matikan untuk menonaktifkan sepenuhnya.
      </p>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={config.enabled}
            onChange={e => setConfig({ ...config, enabled: e.target.checked })} />
          Aktifkan rate limit
        </label>

        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', opacity: config.enabled ? 1 : 0.5 }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 }}>Maks. permintaan</label>
            <input type="number" min={1} max={10000} value={config.maxRequests} disabled={!config.enabled}
              onChange={e => setConfig({ ...config, maxRequests: Number(e.target.value) })} style={input} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 }}>Per (detik)</label>
            <input type="number" min={1} max={3600} value={config.windowSeconds} disabled={!config.enabled}
              onChange={e => setConfig({ ...config, windowSeconds: Number(e.target.value) })} style={input} />
          </div>
        </div>

        <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
          {config.enabled
            ? `Maksimal ${config.maxRequests} checkout per ${config.windowSeconds} detik per IP.`
            : 'Rate limit nonaktif — semua permintaan diizinkan.'}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="submit" disabled={saving}
            style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
          {status && <span style={{ fontSize: '0.8rem', color: status === 'Tersimpan.' ? '#16a34a' : '#dc2626' }}>{status}</span>}
        </div>
      </form>
    </div>
  );
}
