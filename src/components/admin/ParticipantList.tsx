'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable, type DataTableColumn } from './DataTable';
import { PageHeader } from './Card';

type ProgramOption = { id: string; label: string };

type Participant = {
  id: string;
  customerName: string;
  whatsapp: string;
  status: string;
  displayStatus: string;
  group: 'pending' | 'active' | 'completed' | 'dropped';
  dayOfChallenge: number | null;
  phaseName: string | null;
  finalOverdue: boolean;
  startAt: string | null;
  purchaseAt: string;
  initialWeightKg: number | null;
  finalWeightKg: number | null;
  percentLoss: number | null;
  dropReason: string | null;
  notes: string | null;
  hasInitialVideo: boolean;
  hasFinalVideo: boolean;
};

const GROUP_BADGE: Record<Participant['group'], { bg: string; fg: string }> = {
  active: { bg: '#dcfce7', fg: '#16a34a' },
  completed: { bg: '#dbeafe', fg: '#2563eb' },
  dropped: { bg: '#fee2e2', fg: '#dc2626' },
  pending: { bg: '#fef9c3', fg: '#ca8a04' },
};

const GROUP_FILTERS = [
  { value: '', label: 'Semua' },
  { value: 'pending', label: 'Menunggu verifikasi' },
  { value: 'active', label: 'Aktif' },
  { value: 'completed', label: 'Selesai' },
  { value: 'dropped', label: 'Gugur' },
];

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('id-ID') : '—';
}

export function ParticipantList() {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programId, setProgramId] = useState('');
  const [group, setGroup] = useState('');
  const [rows, setRows] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Participant | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/programs');
      if (!res.ok) return;
      const { programs: list } = await res.json();
      setPrograms(list.map((p: { id: string; name: string; programName: string | null }) => ({ id: p.id, label: p.programName || p.name })));
    })();
  }, []);

  const load = useCallback(async (pid: string, grp: string) => {
    if (!pid) { setRows([]); return; }
    setLoading(true);
    try {
      const q = new URLSearchParams({ programId: pid });
      if (grp) q.set('group', grp);
      const res = await fetch(`/api/admin/participants?${q.toString()}`);
      if (res.ok) setRows((await res.json()).participants);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(programId, group); }, [programId, group, load]);

  const columns: DataTableColumn<Participant>[] = useMemo(() => [
    { id: 'name', header: 'Nama', align: 'left', accessor: p => p.customerName },
    { id: 'whatsapp', header: 'WhatsApp', align: 'left', accessor: p => p.whatsapp },
    {
      id: 'status', header: 'Status', accessor: p => p.displayStatus,
      cell: p => {
        const b = GROUP_BADGE[p.group];
        return <span style={{ background: b.bg, color: b.fg, borderRadius: 999, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 600 }}>{p.displayStatus}</span>;
      },
    },
    { id: 'day', header: 'Hari/Fase', accessor: p => p.dayOfChallenge ?? 0, cell: p => p.dayOfChallenge ? `Hari ${p.dayOfChallenge}${p.phaseName ? ` · ${p.phaseName}` : ''}` : '—', exportValue: p => p.dayOfChallenge ? `Hari ${p.dayOfChallenge}` : '—' },
    { id: 'awal', header: 'Berat Awal', accessor: p => p.initialWeightKg ?? 0, cell: p => p.initialWeightKg != null ? `${p.initialWeightKg} kg` : '—' },
    { id: 'akhir', header: 'Berat Akhir', accessor: p => p.finalWeightKg ?? 0, cell: p => p.finalWeightKg != null ? `${p.finalWeightKg} kg` : '—' },
    { id: 'loss', header: '% Turun', accessor: p => p.percentLoss ?? -1, cell: p => p.percentLoss != null ? `${p.percentLoss}%` : '—', exportValue: p => p.percentLoss != null ? `${p.percentLoss}%` : '—' },
    { id: 'mulai', header: 'Mulai', accessor: p => p.startAt ?? '', cell: p => fmtDate(p.startAt) },
    {
      id: 'aksi', header: 'Aksi', align: 'right', accessor: () => '',
      cell: p => <button onClick={() => setSelected(p)} style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Kelola</button>,
    },
  ], []);

  async function afterAction() {
    await load(programId, group);
    setSelected(null);
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <PageHeader title="User / Active" subtitle="Peserta challenge dan statusnya." />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div>
          <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 }}>Program</label>
          <select value={programId} onChange={e => setProgramId(e.target.value)} style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 10px', fontSize: '0.875rem' }}>
            <option value="">— pilih program —</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 }}>Status</label>
          <select value={group} onChange={e => setGroup(e.target.value)} style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 10px', fontSize: '0.875rem' }}>
            {GROUP_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {!programId ? (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Pilih program untuk melihat peserta.</p>
      ) : loading ? (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Memuat…</p>
      ) : (
        <DataTable columns={columns} rows={rows} pageSize={20} exportFileName="peserta-challenge" exportTitle="Peserta Challenge" emptyMessage="Belum ada peserta." />
      )}

      {selected && <ParticipantModal p={selected} onClose={() => setSelected(null)} onDone={afterAction} />}
    </div>
  );
}

function ParticipantModal({ p, onClose, onDone }: { p: Participant; onClose: () => void; onDone: () => void }) {
  const [initialWeight, setInitialWeight] = useState('');
  const [finalWeight, setFinalWeight] = useState('');
  const [dropReason, setDropReason] = useState('');
  const [notes, setNotes] = useState(p.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function act(payload: Record<string, unknown>) {
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/admin/participants/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) onDone();
      else setErr((await res.json()).error ?? 'Gagal.');
    } finally {
      setBusy(false);
    }
  }

  const sectionTitle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '14px 0 6px' };
  const numInput: React.CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 6, padding: '7px 10px', fontSize: '0.875rem', width: 120 };
  const primaryBtn: React.CSSProperties = { padding: '7px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' };
  const ghostBtn: React.CSSProperties = { padding: '7px 14px', background: '#fff', color: '#374151', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.82rem', cursor: 'pointer' };
  const videoLink = (kind: 'initial' | 'final') => `/api/admin/participants/${p.id}/proof/${kind}`;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', zIndex: 50, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, padding: '1.4rem', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{p.customerName}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>
        <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>{p.whatsapp} · {p.displayStatus}{p.finalOverdue ? ' · ⚠ lewat batas bukti akhir' : ''}</p>

        {/* Initial proof */}
        <div style={sectionTitle}>Bukti Awal</div>
        {p.hasInitialVideo
          ? <a href={videoLink('initial')} target="_blank" rel="noreferrer" style={{ fontSize: '0.82rem', color: '#2563eb' }}>▶ Lihat video bukti awal</a>
          : <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Belum ada video.</span>}
        {p.status === 'PENDING_INITIAL_REVIEW' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8, flexWrap: 'wrap' }}>
            <div><label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 }}>Berat awal (kg)</label>
              <input type="number" value={initialWeight} onChange={e => setInitialWeight(e.target.value)} style={numInput} /></div>
            <button disabled={busy || !initialWeight} style={primaryBtn} onClick={() => act({ action: 'verify_initial', initialWeightKg: Number(initialWeight) })}>Verifikasi & Mulai</button>
            <button disabled={busy} style={ghostBtn} onClick={() => act({ action: 'reject_initial' })}>Tolak</button>
          </div>
        )}

        {/* Final proof */}
        <div style={sectionTitle}>Bukti Akhir</div>
        {p.hasFinalVideo
          ? <a href={videoLink('final')} target="_blank" rel="noreferrer" style={{ fontSize: '0.82rem', color: '#2563eb' }}>▶ Lihat video bukti akhir</a>
          : <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Belum ada video.</span>}
        {p.status === 'PENDING_FINAL_REVIEW' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8, flexWrap: 'wrap' }}>
            <div><label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 }}>Berat akhir (kg)</label>
              <input type="number" value={finalWeight} onChange={e => setFinalWeight(e.target.value)} style={numInput} /></div>
            <button disabled={busy || !finalWeight} style={primaryBtn} onClick={() => act({ action: 'verify_final', finalWeightKg: Number(finalWeight) })}>Verifikasi & Selesai</button>
            <button disabled={busy} style={ghostBtn} onClick={() => act({ action: 'reject_final' })}>Tolak</button>
          </div>
        )}

        {p.percentLoss != null && <p style={{ fontSize: '0.85rem', margin: '10px 0 0' }}>Penurunan: <strong>{p.percentLoss}%</strong> ({p.initialWeightKg} → {p.finalWeightKg} kg)</p>}

        {/* Drop + notes */}
        <div style={sectionTitle}>Tindakan</div>
        {p.group !== 'dropped' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ flex: '1 1 200px' }}><label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 }}>Alasan gugur</label>
              <input value={dropReason} onChange={e => setDropReason(e.target.value)} placeholder="melanggar aturan / disqualified" style={{ ...numInput, width: '100%', boxSizing: 'border-box' }} /></div>
            <button disabled={busy} style={{ ...ghostBtn, color: '#dc2626', borderColor: '#fecaca' }} onClick={() => act({ action: 'drop', dropReason: dropReason || 'disqualified' })}>Gugurkan</button>
          </div>
        )}
        <div>
          <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 }}>Catatan</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '7px 10px', fontSize: '0.82rem', boxSizing: 'border-box', resize: 'vertical' }} />
          <button disabled={busy} style={{ ...ghostBtn, marginTop: 6 }} onClick={() => act({ action: 'note', notes })}>Simpan catatan</button>
        </div>

        {err && <p style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: 10 }}>{err}</p>}
      </div>
    </div>
  );
}
