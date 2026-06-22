'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Card } from './Card';

type Config = {
  engine: 'waha' | 'fonnte';
  fonnteConfigured: boolean;
  fonnteWebhookConfigured: boolean;
};

const ENGINES: { value: Config['engine']; label: string; hint: string }[] = [
  { value: 'waha', label: 'WAHA', hint: 'Self-hosted WhatsApp HTTP API (default).' },
  { value: 'fonnte', label: 'Fonnte', hint: 'Layanan WhatsApp pihak ketiga (fonnte.com).' },
];

export function MessagingEngineSettings() {
  const [config, setConfig] = useState<Config | null>(null);
  const [engine, setEngine] = useState<Config['engine']>('waha');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/messaging')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d) {
          setConfig(d.config);
          setEngine(d.config.engine);
        }
      });
  }, []);

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('');
    setSaving(true);
    try {
      const res = await fetch('/api/admin/messaging', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine }),
      });
      if (res.ok) {
        const d = await res.json();
        setConfig(d.config);
        setEngine(d.config.engine);
        setStatus('Tersimpan.');
      } else {
        setStatus((await res.json()).error ?? 'Gagal menyimpan.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return (
      <Card title="Engine WhatsApp">
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>Memuat…</p>
      </Card>
    );
  }

  const fonnteMissing = engine === 'fonnte' && !config.fonnteConfigured;
  const fonnteWebhookMissing = engine === 'fonnte' && !config.fonnteWebhookConfigured;

  return (
    <Card
      title="Engine WhatsApp"
      description="Pilih layanan pengiriman pesan WhatsApp. Berlaku untuk pengiriman e-book, pengingat challenge, dan tes kirim. Perubahan langsung aktif."
    >
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ENGINES.map(opt => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                border: `1px solid ${engine === opt.value ? '#2563eb' : '#e2e8f0'}`,
                borderRadius: 8,
                cursor: 'pointer',
                background: engine === opt.value ? '#eff6ff' : '#fff',
              }}
            >
              <input
                type="radio"
                name="engine"
                value={opt.value}
                checked={engine === opt.value}
                onChange={() => setEngine(opt.value)}
                style={{ marginTop: 3 }}
              />
              <span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>{opt.label}</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {fonnteMissing && (
          <p style={{ fontSize: '0.75rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 10px', margin: 0 }}>
            ⚠️ <strong>FONNTE_TOKEN belum diatur</strong> di environment server. Pengiriman akan gagal sampai token diisi.
          </p>
        )}
        {fonnteWebhookMissing && (
          <p style={{ fontSize: '0.75rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 10px', margin: 0 }}>
            ⚠️ <strong>FONNTE_WEBHOOK_SECRET belum diatur</strong> — penerimaan bukti video challenge lewat webhook Fonnte tidak akan aktif.
          </p>
        )}

        <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
          Engine aktif saat ini: <strong>{config.engine === 'fonnte' ? 'Fonnte' : 'WAHA'}</strong>.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="submit"
            disabled={saving || engine === config.engine}
            style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600, cursor: saving || engine === config.engine ? 'default' : 'pointer', opacity: saving || engine === config.engine ? 0.6 : 1 }}
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
          {status && <span style={{ fontSize: '0.8rem', color: status === 'Tersimpan.' ? '#16a34a' : '#dc2626' }}>{status}</span>}
        </div>
      </form>
    </Card>
  );
}
