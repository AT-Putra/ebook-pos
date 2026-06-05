'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';

type Origin = {
  id: string;
  origin: string;
  label: string | null;
  isActive: boolean;
  createdAt: string;
};

export function OriginManager() {
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/origins');
      if (res.ok) setOrigins((await res.json()).origins);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      const res = await fetch('/api/admin/origins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: data.get('origin'), label: data.get('label') || undefined }),
      });
      if (res.ok) {
        form.reset();
        await load();
      } else {
        setError((await res.json()).error ?? 'Gagal menambah domain.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(o: Origin) {
    await fetch(`/api/admin/origins/${o.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !o.isActive }),
    });
    load();
  }

  async function remove(o: Origin) {
    if (!confirm(`Hapus domain ${o.origin}?`)) return;
    await fetch(`/api/admin/origins/${o.id}`, { method: 'DELETE' });
    load();
  }

  const card: React.CSSProperties = { background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1.1rem 1.25rem' };

  return (
    <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={card}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 4px' }}>Domain Whitelist (CORS)</h2>
        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem' }}>
          Domain landing page yang boleh mengirim checkout ke API ini dari browser. Contoh:
          <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, margin: '0 4px' }}>https://landing.contoh.com</code>
        </p>

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 260px' }}>
            <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 }}>Origin (URL)</label>
            <input name="origin" type="text" required placeholder="https://landing.contoh.com"
              style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '7px 10px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 }}>Label (opsional)</label>
            <input name="label" type="text" placeholder="Kampanye IG"
              style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '7px 10px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
          </div>
          <button type="submit" disabled={submitting}
            style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Menambah…' : 'Tambah'}
          </button>
        </form>
        {error && <p style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: 8 }}>{error}</p>}
      </div>

      <div style={card}>
        {loading ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Memuat…</p>
        ) : origins.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Belum ada domain. Tambahkan di atas.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>Origin</th>
                <th style={{ padding: '8px 10px' }}>Label</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {origins.map((o, i) => (
                <tr key={o.id} style={{ background: i % 2 ? '#f8fafc' : '#fff' }}>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{o.origin}</td>
                  <td style={{ padding: '8px 10px', color: '#64748b' }}>{o.label ?? '—'}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <button onClick={() => toggle(o)} style={{
                      border: 'none', cursor: 'pointer', borderRadius: 999, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 600,
                      background: o.isActive ? '#dcfce7' : '#f1f5f9', color: o.isActive ? '#16a34a' : '#94a3b8',
                    }}>{o.isActive ? 'Aktif' : 'Nonaktif'}</button>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    <button onClick={() => remove(o)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem' }}>Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
