'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable, type DataTableColumn } from './DataTable';
import { PageHeader } from './Card';

type ProgramOption = { id: string; label: string };

type WaLog = {
  id: string;
  createdAt: string;
  category: 'ebook' | 'attachment' | 'reminder';
  status: 'SENT' | 'FAILED';
  chatId: string;
  toPhone: string | null;
  templateKey: string | null;
  fileName: string | null;
  bodyPreview: string | null;
  wahaMessageId: string | null;
  error: string | null;
  orderId: string | null;
  orderCode: string | null;
  deliveryId: string | null;
  productId: string | null;
};

const CATEGORY_LABEL: Record<WaLog['category'], string> = {
  ebook: 'E-book',
  attachment: 'Lampiran',
  reminder: 'Reminder',
};

const STATUS_BADGE: Record<WaLog['status'], { bg: string; fg: string; label: string }> = {
  SENT: { bg: '#dcfce7', fg: '#16a34a', label: 'Terkirim' },
  FAILED: { bg: '#fee2e2', fg: '#dc2626', label: 'Gagal' },
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const labelStyle: React.CSSProperties = { fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 };
const inputStyle: React.CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 10px', fontSize: '0.875rem' };

export function WaLogs() {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programId, setProgramId] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<WaLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/programs');
      if (!res.ok) return;
      const { programs: list } = await res.json();
      setPrograms(list.map((p: { id: string; name: string; programName: string | null }) => ({ id: p.id, label: p.programName || p.name })));
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (programId) q.set('programId', programId);
      if (status) q.set('status', status);
      if (category) q.set('category', category);
      if (from) q.set('from', from);
      if (to) q.set('to', to);
      const res = await fetch(`/api/admin/wa-logs?${q.toString()}`);
      if (res.ok) setRows((await res.json()).rows);
    } finally {
      setLoading(false);
    }
  }, [programId, status, category, from, to]);

  useEffect(() => { load(); }, [load]);

  async function resend(log: WaLog) {
    if (!log.deliveryId || resendingId) return;
    setResendingId(log.id);
    setToast('');
    try {
      const res = await fetch(`/api/admin/deliveries/${log.deliveryId}/resend`, { method: 'POST' });
      if (res.ok) {
        setToast('Kirim ulang dipicu. Memuat log…');
        await load();
      } else {
        setToast((await res.json()).error ?? 'Gagal kirim ulang.');
      }
    } catch {
      setToast('Gagal kirim ulang.');
    } finally {
      setResendingId(null);
    }
  }

  const columns: DataTableColumn<WaLog>[] = useMemo(() => [
    { id: 'waktu', header: 'Waktu', align: 'left', accessor: r => r.createdAt, cell: r => fmtDateTime(r.createdAt) },
    { id: 'tujuan', header: 'Tujuan', align: 'left', accessor: r => r.toPhone ?? r.chatId },
    { id: 'kategori', header: 'Kategori', align: 'left', accessor: r => CATEGORY_LABEL[r.category], cell: r => CATEGORY_LABEL[r.category] },
    {
      id: 'status', header: 'Status', align: 'left', accessor: r => r.status,
      cell: r => {
        const b = STATUS_BADGE[r.status];
        return <span style={{ background: b.bg, color: b.fg, borderRadius: 999, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 600 }}>{b.label}</span>;
      },
      exportValue: r => STATUS_BADGE[r.status].label,
    },
    {
      id: 'detail', header: 'Detail', align: 'left',
      accessor: r => r.fileName ?? r.templateKey ?? r.bodyPreview ?? '',
      cell: r => (
        <span title={r.bodyPreview ?? ''}>
          {r.fileName ? `📎 ${r.fileName}` : r.templateKey ? r.templateKey : ''}
          {r.bodyPreview ? <span style={{ color: '#94a3b8' }}>{(r.fileName || r.templateKey) ? ' — ' : ''}{r.bodyPreview}</span> : null}
        </span>
      ),
      exportValue: r => [r.fileName, r.templateKey, r.bodyPreview].filter(Boolean).join(' — '),
    },
    { id: 'order', header: 'Order', align: 'left', accessor: r => r.orderCode ?? '', cell: r => r.orderCode ?? '—' },
    { id: 'msgid', header: 'Msg ID', align: 'left', accessor: r => r.wahaMessageId ?? '', cell: r => r.wahaMessageId ?? '—' },
    { id: 'error', header: 'Error', align: 'left', accessor: r => r.error ?? '', cell: r => r.error ? <span style={{ color: '#dc2626' }} title={r.error}>{r.error}</span> : '—' },
    {
      id: 'aksi', header: 'Aksi', align: 'right', accessor: () => '',
      cell: r => (r.status === 'FAILED' && r.deliveryId)
        ? <button disabled={resendingId === r.id} onClick={() => resend(r)} style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, opacity: resendingId === r.id ? 0.5 : 1 }}>{resendingId === r.id ? 'Mengirim…' : 'Kirim ulang'}</button>
        : <span style={{ color: '#cbd5e1' }}>—</span>,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [resendingId]);

  return (
    <div style={{ padding: '1.5rem' }}>
      <PageHeader title="WA Logs" subtitle="Riwayat pengiriman WhatsApp keluar (e-book, lampiran, reminder challenge)." />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'flex-end' }}>
        <div>
          <label style={labelStyle}>Program</label>
          <select value={programId} onChange={e => setProgramId(e.target.value)} style={inputStyle}>
            <option value="">Semua program</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
            <option value="">Semua</option>
            <option value="SENT">Terkirim</option>
            <option value="FAILED">Gagal</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Kategori</label>
          <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
            <option value="">Semua</option>
            <option value="ebook">E-book</option>
            <option value="attachment">Lampiran</option>
            <option value="reminder">Reminder</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Dari tanggal</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Sampai tanggal</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {toast && <p style={{ fontSize: '0.82rem', color: '#2563eb', marginBottom: 10 }}>{toast}</p>}

      {loading ? (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Memuat…</p>
      ) : (
        <DataTable columns={columns} rows={rows} pageSize={20} exportFileName="wa-logs" exportTitle="WA Logs" emptyMessage="Belum ada log pengiriman WhatsApp." />
      )}
    </div>
  );
}
