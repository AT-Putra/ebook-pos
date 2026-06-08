'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardStack, PageHeader } from './Card';
import { defaultChallengeConfig, type ChallengeConfig as Cfg } from '@/lib/challenge';

type ProgramOption = { id: string; label: string };

const TEMPLATE_LABELS: Record<string, string> = {
  after_purchase: 'Setelah pembelian', h7: 'H+7 (belum mulai)', h13: 'H+13', h14: 'H+14',
  h15: 'H+15 (gugur awal)', proof_received: 'Menerima bukti video', day1: 'Hari 1 (mulai)', day30: 'Hari 30', day60: 'Hari 60',
  day90: 'Hari 90 (bukti akhir)', day97: 'Hari 97', day103: 'Hari 103', day104: 'Hari 104',
  day105: 'Hari 105 (gugur akhir)', final_received: 'Bukti akhir diterima',
};

const lbl: React.CSSProperties = { fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3, fontWeight: 600 };
const inp: React.CSSProperties = { width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '7px 10px', fontSize: '0.875rem', boxSizing: 'border-box' };

export function ChallengeConfig() {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programId, setProgramId] = useState('');
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [exists, setExists] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testStatus, setTestStatus] = useState<Record<string, string>>({});
  const [testingKey, setTestingKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/programs');
      if (!res.ok) return;
      const { programs: list } = await res.json();
      setPrograms(list.map((p: { id: string; name: string; programName: string | null }) => ({ id: p.id, label: p.programName || p.name })));
    })();
  }, []);

  const loadChallenge = useCallback(async (pid: string) => {
    setLoading(true); setStatus('');
    try {
      const res = await fetch(`/api/admin/challenges/${pid}`);
      if (!res.ok) return;
      const { challenge, defaults } = await res.json();
      if (challenge) {
        setExists(true);
        // challenge wins; defaults fill any gap; coerce nullable strings so inputs stay controlled
        setCfg({
          ...defaults,
          ...challenge,
          rewardsText: challenge.rewardsText ?? '',
          contactInfo: challenge.contactInfo ?? '',
          messageTemplates: { ...defaults.messageTemplates, ...(challenge.messageTemplates ?? {}) },
        });
        setIsActive(challenge.isActive);
      } else {
        setExists(false);
        setCfg(defaults);
        setIsActive(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function onSelect(pid: string) {
    setProgramId(pid);
    setCfg(null);
    if (pid) loadChallenge(pid);
  }

  function patch(p: Partial<Cfg>) { setCfg(c => (c ? { ...c, ...p } : c)); }

  async function sendTest(key: string) {
    if (!cfg) return;
    if (!testPhone.trim()) { setTestStatus(s => ({ ...s, [key]: 'Isi nomor tes dulu.' })); return; }
    const text = (cfg.messageTemplates[key] ?? '').replaceAll('{{contact}}', cfg.contactInfo || '-');
    setTestingKey(key);
    setTestStatus(s => ({ ...s, [key]: 'Mengirim…' }));
    try {
      const res = await fetch('/api/admin/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: testPhone, text }),
      });
      const data = await res.json().catch(() => ({}));
      setTestStatus(s => ({ ...s, [key]: res.ok ? 'Terkirim ✓' : (data.error ?? 'Gagal mengirim.') }));
    } catch {
      setTestStatus(s => ({ ...s, [key]: 'Gagal mengirim.' }));
    } finally {
      setTestingKey(null);
    }
  }

  async function save() {
    if (!cfg || !programId) return;
    setSaving(true); setStatus('');
    try {
      const res = await fetch(`/api/admin/challenges/${programId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cfg, isActive }),
      });
      if (res.ok) { setExists(true); setStatus('Tersimpan.'); }
      else { const d = await res.json(); setStatus(d.issues?.join(' ') ?? d.error ?? 'Gagal menyimpan.'); }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <PageHeader title="Challenge" subtitle="Konfigurasi reward challenge per program." />
      <CardStack>
        <Card title="Pilih Program">
          <select value={programId} onChange={e => onSelect(e.target.value)} style={{ ...inp, maxWidth: 360 }}>
            <option value="">— pilih program —</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {loading && <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '10px 0 0' }}>Memuat…</p>}
          {programId && !loading && !exists && cfg && (
            <p style={{ color: '#ca8a04', fontSize: '0.8rem', margin: '10px 0 0' }}>Belum ada challenge untuk program ini — isi lalu simpan untuk membuatnya (nilai default sudah terisi).</p>
          )}
        </Card>

        {cfg && (
          <>
            <Card title="Status & Timeline">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', marginBottom: 14 }}>
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                Challenge aktif (peserta bisa ikut)
              </label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <NumField label="Batas mulai (hari)" value={cfg.startWindowDays} onChange={v => patch({ startWindowDays: v })} />
                <NumField label="Durasi (hari)" value={cfg.durationDays} onChange={v => patch({ durationDays: v })} />
                <NumField label="Batas bukti akhir (hari)" value={cfg.finalProofWindowDays} onChange={v => patch({ finalProofWindowDays: v })} />
              </div>
            </Card>

            <Card title="Aturan Video">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <NumField label="Maks durasi (detik)" value={cfg.videoMaxSeconds} onChange={v => patch({ videoMaxSeconds: v })} />
                <NumField label="Maks ukuran (MB)" value={cfg.videoMaxSizeMb} onChange={v => patch({ videoMaxSizeMb: v })} />
                <div style={{ flex: '1 1 120px' }}>
                  <label style={lbl}>Format</label>
                  <input value={cfg.videoFormat} onChange={e => patch({ videoFormat: e.target.value })} style={inp} />
                </div>
              </div>
            </Card>

            <Card title="Fase" description="Urutan fase challenge (hari mulai–selesai, nama, fokus).">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cfg.phases.map((ph, i) => (
                  <div key={i} style={{ border: '1px solid #eef2f7', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ flex: '2 1 200px' }}><label style={lbl}>Nama Fase {i + 1}</label>
                        <input value={ph.name} onChange={e => patchPhase(i, { name: e.target.value })} style={inp} /></div>
                      <NumField label="Hari mulai" value={ph.startDay} onChange={v => patchPhase(i, { startDay: v })} />
                      <NumField label="Hari selesai" value={ph.endDay} onChange={v => patchPhase(i, { endDay: v })} />
                    </div>
                    <div><label style={lbl}>Fokus</label>
                      <textarea value={ph.focus} onChange={e => patchPhase(i, { focus: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Reward & Pemenang">
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Deskripsi reward</label>
                <textarea value={cfg.rewardsText} onChange={e => patch({ rewardsText: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} />
              </div>
              <label style={lbl}>Tingkat pemenang</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cfg.winnerTiers.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 140px' }}><label style={lbl}>Label</label>
                      <input value={t.label} onChange={e => patchTier(i, { label: e.target.value })} style={inp} /></div>
                    <div style={{ flex: '2 1 200px' }}><label style={lbl}>Hadiah</label>
                      <input value={t.prize} onChange={e => patchTier(i, { prize: e.target.value })} style={inp} /></div>
                    <NumField label="Jumlah" value={t.count} onChange={v => patchTier(i, { count: v })} />
                    <button onClick={() => patch({ winnerTiers: cfg.winnerTiers.filter((_, j) => j !== i) })}
                      style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', padding: '8px 4px' }}>Hapus</button>
                  </div>
                ))}
                <button onClick={() => patch({ winnerTiers: [...cfg.winnerTiers, { label: '', prize: '', count: 1 }] })}
                  style={{ alignSelf: 'flex-start', border: '1px dashed #cbd5e1', background: '#fff', color: '#2563eb', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem' }}>+ Tambah tingkat</button>
              </div>
            </Card>

            <Card title="Kontak & Template WhatsApp" description="Template dipakai oleh reminder otomatis (slice berikutnya). {{contact}} diganti dengan kontak di bawah.">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                <div style={{ flex: '1 1 240px' }}>
                  <label style={lbl}>Kontak (info lebih lanjut)</label>
                  <input value={cfg.contactInfo} onChange={e => patch({ contactInfo: e.target.value })} placeholder="0812-xxxx-xxxx" style={inp} />
                </div>
                <div style={{ flex: '1 1 240px' }}>
                  <label style={lbl}>Nomor tujuan tes (kirim contoh pesan)</label>
                  <input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="0812-xxxx-xxxx" style={inp} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Object.entries(cfg.messageTemplates).map(([key, val]) => (
                  <div key={key}>
                    <label style={lbl}>{TEMPLATE_LABELS[key] ?? key}</label>
                    <textarea value={val} onChange={e => patch({ messageTemplates: { ...cfg.messageTemplates, [key]: e.target.value } })}
                      rows={2} style={{ ...inp, resize: 'vertical', fontSize: '0.8rem' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <button type="button" onClick={() => sendTest(key)} disabled={testingKey === key}
                        style={{ padding: '5px 12px', background: '#fff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', opacity: testingKey === key ? 0.6 : 1 }}>
                        {testingKey === key ? 'Mengirim…' : 'Kirim tes'}
                      </button>
                      {testStatus[key] && (
                        <span style={{ fontSize: '0.75rem', color: testStatus[key] === 'Terkirim ✓' ? '#16a34a' : testStatus[key] === 'Mengirim…' ? '#64748b' : '#dc2626' }}>
                          {testStatus[key]}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={save} disabled={saving}
                style={{ padding: '9px 22px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Menyimpan…' : 'Simpan Challenge'}
              </button>
              {status && <span style={{ fontSize: '0.85rem', color: status === 'Tersimpan.' ? '#16a34a' : '#dc2626' }}>{status}</span>}
            </div>
          </>
        )}
      </CardStack>
    </div>
  );

  function patchPhase(i: number, p: Partial<Cfg['phases'][number]>) {
    setCfg(c => (c ? { ...c, phases: c.phases.map((ph, j) => (j === i ? { ...ph, ...p } : ph)) } : c));
  }
  function patchTier(i: number, p: Partial<Cfg['winnerTiers'][number]>) {
    setCfg(c => (c ? { ...c, winnerTiers: c.winnerTiers.map((t, j) => (j === i ? { ...t, ...p } : t)) } : c));
  }
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ flex: '1 1 120px' }}>
      <label style={lbl}>{label}</label>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} style={inp} />
    </div>
  );
}
