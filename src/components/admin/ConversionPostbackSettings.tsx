'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Card } from './Card';

type Config = { enabled: boolean; postbackUrl: string | null };

export function ConversionPostbackSettings() {
  const [config, setConfig] = useState<Config | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [postbackUrl, setPostbackUrl] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/conversion')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d) {
          setConfig(d.config);
          setEnabled(d.config.enabled);
          setPostbackUrl(d.config.postbackUrl ?? '');
        }
      });
  }, []);

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('');
    setSaving(true);
    try {
      const res = await fetch('/api/admin/conversion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, postbackUrl }),
      });
      if (res.ok) {
        const d = await res.json();
        setConfig(d.config);
        setEnabled(d.config.enabled);
        setPostbackUrl(d.config.postbackUrl ?? '');
        setStatus('Tersimpan.');
      } else {
        setStatus((await res.json()).error ?? 'Gagal menyimpan.');
      }
    } finally {
      setSaving(false);
    }
  }

  const input: React.CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 10px', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' };

  if (!config) {
    return <Card title="Conversion Postback (Iklan)"><p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>Memuat…</p></Card>;
  }

  return (
    <Card
      title="Conversion Postback (Iklan)"
      description="Kirim callback ke publisher iklan saat pembayaran sukses (PAID). trxid diambil dari tracking order (ref/utm_source/fbclid)."
    >
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          Aktifkan postback konversi
        </label>

        <div>
          <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 4 }}>URL postback (template)</label>
          <input
            type="text"
            value={postbackUrl}
            onChange={e => setPostbackUrl(e.target.value)}
            placeholder="https://publisher.com/cb?clickid={trxid}&payout={amount}"
            style={input}
          />
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '5px 0 0' }}>
            Wajib <code>https://</code> dan memuat <code>{'{trxid}'}</code>. Macro opsional:
            {' '}<code>{'{amount}'}</code> (IDR), <code>{'{orderid}'}</code>. Dikirim sebagai GET saat order PAID.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="submit" disabled={saving}
            style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
          {status && <span style={{ fontSize: '0.8rem', color: status === 'Tersimpan.' ? '#16a34a' : '#dc2626' }}>{status}</span>}
        </div>
      </form>
    </Card>
  );
}
