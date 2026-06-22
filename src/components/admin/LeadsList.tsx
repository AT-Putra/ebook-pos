'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable, type DataTableColumn } from './DataTable';
import { PageHeader } from './Card';
import { formatIdr, leadStatusMeta } from '@/lib/leads';

type ProgramOption = { id: string; label: string };

type Lead = {
  id: string;
  orderCode: string;
  createdAt: string;
  paidAt: string | null;
  customerName: string;
  email: string;
  whatsapp: string;
  productId: string;
  productName: string;
  programName: string | null;
  amountIdr: number;
  status: string;
  trackingId: string | null;
  paymentType: string | null;
  deliveryId: string | null;
  deliveryStatus: string | null;
  deliveryAttempts: number | null;
  deliveryLastError: string | null;
  deliverySentAt: string | null;
};

const DELIVERY_LABEL: Record<string, string> = {
  PENDING: 'Menunggu', PROCESSING: 'Proses', SENT: 'Terkirim', FAILED: 'Gagal',
};

function fmtDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

const labelStyle: React.CSSProperties = { fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 };
const inputStyle: React.CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 10px', fontSize: '0.875rem' };

function StatusBadge({ status }: { status: string }) {
  const m = leadStatusMeta(status);
  return <span style={{ background: m.bg, color: m.fg, borderRadius: 999, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 600 }}>{m.label}</span>;
}

export function LeadsList() {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programId, setProgramId] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);

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
      if (from) q.set('from', from);
      if (to) q.set('to', to);
      const res = await fetch(`/api/admin/leads?${q.toString()}`);
      if (res.ok) setRows((await res.json()).rows);
    } finally {
      setLoading(false);
    }
  }, [programId, status, from, to]);

  useEffect(() => { load(); }, [load]);

  const columns: DataTableColumn<Lead>[] = useMemo(() => [
    { id: 'waktu', header: 'Waktu', align: 'left', accessor: r => r.createdAt, cell: r => fmtDateTime(r.createdAt) },
    { id: 'nama', header: 'Nama', align: 'left', accessor: r => r.customerName },
    { id: 'whatsapp', header: 'WhatsApp', align: 'left', accessor: r => r.whatsapp },
    { id: 'email', header: 'Email', align: 'left', accessor: r => r.email },
    { id: 'produk', header: 'Program/Produk', align: 'left', accessor: r => r.programName || r.productName, cell: r => r.programName || r.productName },
    { id: 'jumlah', header: 'Jumlah', accessor: r => r.amountIdr, cell: r => formatIdr(r.amountIdr), exportValue: r => r.amountIdr },
    { id: 'status', header: 'Status', align: 'left', accessor: r => r.status, cell: r => <StatusBadge status={r.status} />, exportValue: r => leadStatusMeta(r.status).label },
    { id: 'tracking', header: 'Tracking', align: 'left', accessor: r => r.trackingId ?? '', cell: r => r.trackingId ?? '—' },
    { id: 'kirim', header: 'Pengiriman', align: 'left', accessor: r => r.deliveryStatus ?? '', cell: r => r.deliveryStatus ? (DELIVERY_LABEL[r.deliveryStatus] ?? r.deliveryStatus) : '—' },
    {
      id: 'aksi', header: 'Aksi', align: 'right', accessor: () => '',
      cell: r => <button onClick={() => setSelected(r)} style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Detail</button>,
    },
  ], []);

  return (
    <div style={{ padding: '1.5rem' }}>
      <PageHeader title="Leads" subtitle="Semua submission checkout (order apa pun statusnya)." />

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
            <option value="PENDING">Menunggu bayar</option>
            <option value="PAID">Lunas</option>
            <option value="FAILED">Gagal</option>
            <option value="EXPIRED">Kedaluwarsa</option>
            <option value="CANCELLED">Dibatalkan</option>
            <option value="REFUNDED">Dikembalikan</option>
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

      {loading ? (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Memuat…</p>
      ) : (
        <DataTable columns={columns} rows={rows} pageSize={20} exportFileName="leads" exportTitle="Leads" emptyMessage="Belum ada lead." />
      )}

      {selected && <LeadModal lead={selected} onClose={() => setSelected(null)} onDone={() => { load(); setSelected(null); }} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ textAlign: 'right', fontWeight: 500, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function LeadModal({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const [correctedWa, setCorrectedWa] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function resend() {
    if (!lead.deliveryId || busy) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/deliveries/${lead.deliveryId}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(correctedWa ? { whatsapp: correctedWa } : {}),
      });
      if (res.ok) { setMsg('Kirim ulang dipicu.'); onDone(); }
      else setMsg((await res.json()).error ?? 'Gagal kirim ulang.');
    } catch {
      setMsg('Gagal kirim ulang.');
    } finally {
      setBusy(false);
    }
  }

  const sectionTitle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '14px 0 6px' };
  const primaryBtn: React.CSSProperties = { padding: '7px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', zIndex: 50, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, padding: '1.4rem', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{lead.customerName}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>
        <div style={{ marginBottom: 4 }}><StatusBadge status={lead.status} /></div>

        <div style={sectionTitle}>Order</div>
        <Row label="Kode order" value={lead.orderCode} />
        <Row label="Tanggal" value={fmtDateTime(lead.createdAt)} />
        <Row label="Program/Produk" value={lead.programName || lead.productName} />
        <Row label="Jumlah" value={formatIdr(lead.amountIdr)} />
        <Row label="Dibayar" value={fmtDateTime(lead.paidAt)} />
        {lead.paymentType && <Row label="Metode bayar" value={lead.paymentType} />}
        {lead.trackingId && <Row label="Tracking ID" value={lead.trackingId} />}

        <div style={sectionTitle}>Kontak</div>
        <Row label="Email" value={lead.email} />
        <Row label="WhatsApp" value={lead.whatsapp} />

        <div style={sectionTitle}>Pengiriman</div>
        {lead.deliveryStatus
          ? <>
              <Row label="Status" value={DELIVERY_LABEL[lead.deliveryStatus] ?? lead.deliveryStatus} />
              {lead.deliverySentAt && <Row label="Terkirim" value={fmtDateTime(lead.deliverySentAt)} />}
              {lead.deliveryAttempts != null && <Row label="Percobaan" value={lead.deliveryAttempts} />}
              {lead.deliveryLastError && <Row label="Error" value={<span style={{ color: '#dc2626' }}>{lead.deliveryLastError}</span>} />}
            </>
          : <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>Belum ada pengiriman (order belum lunas).</p>}

        {lead.deliveryId && (
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Kirim ulang e-book (opsional: koreksi nomor WhatsApp)</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={correctedWa} onChange={e => setCorrectedWa(e.target.value)} placeholder={lead.whatsapp} style={{ ...inputStyle, flex: '1 1 180px' }} />
              <button disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={resend}>{busy ? 'Mengirim…' : 'Kirim ulang'}</button>
            </div>
          </div>
        )}

        {msg && <p style={{ fontSize: '0.82rem', color: '#2563eb', marginTop: 10 }}>{msg}</p>}
      </div>
    </div>
  );
}
