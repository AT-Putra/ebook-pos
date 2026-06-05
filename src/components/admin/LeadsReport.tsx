'use client';

import { useState, useCallback, useMemo } from 'react';
import { KpiCard } from './KpiCard';
import { DataTable, type DataTableColumn } from './DataTable';
import type { ReportData, DayMetrics } from '@/lib/report';

function formatIDR(amount: number): string {
  return 'Rp' + amount.toLocaleString('id-ID');
}

function formatPct(rate: number): string {
  return (rate * 100).toFixed(2) + '%';
}

function todayWib(): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function defaultFrom(): string {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  d.setDate(d.getDate() - 14);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function LeadsReport({ initial }: { initial: ReportData }) {
  const [data, setData] = useState<ReportData>(initial);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [loading, setLoading] = useState(false);
  const [lastUpdated] = useState(() => new Date().toLocaleString('id-ID'));

  const fetchReport = useCallback(async (f: string, t: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/report?from=${f}&to=${t}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  function handleApply() { fetchReport(from, to); }
  function handleReset() {
    const f = defaultFrom();
    const t = defaultTo();
    setFrom(f); setTo(t);
    fetchReport(f, t);
  }

  const today = data.today;
  const series = data.series;

  const totals = useMemo(() => series.reduce(
    (acc, d) => ({
      leads: acc.leads + d.leads,
      purchase: acc.purchase + d.purchase,
      revenue: acc.revenue + d.revenue,
      totalWa: acc.totalWa + d.totalWa,
      sukses: acc.sukses + d.sukses,
      failed: acc.failed + d.failed,
    }),
    { leads: 0, purchase: 0, revenue: 0, totalWa: 0, sukses: 0, failed: 0 }
  ), [series]);
  const totalsConv = totals.leads > 0 ? (totals.purchase / totals.leads) : 0;

  const columns: DataTableColumn<DayMetrics>[] = useMemo(() => [
    { id: 'date', header: 'Tanggal', align: 'left', accessor: d => d.date },
    { id: 'leads', header: 'Leads', accessor: d => d.leads },
    { id: 'purchase', header: 'Purchase', accessor: d => d.purchase },
    { id: 'convRate', header: 'Conv. Rate', accessor: d => d.convRate, cell: d => formatPct(d.convRate), exportValue: d => formatPct(d.convRate) },
    { id: 'revenue', header: 'Revenue', accessor: d => d.revenue, cell: d => formatIDR(d.revenue), exportValue: d => formatIDR(d.revenue) },
    { id: 'active', header: 'Active', accessor: () => 0, cell: () => <span style={{ color: '#94a3b8' }}>—</span>, exportValue: () => '—' },
    { id: 'convRateActive', header: 'Conv. Rate Active', accessor: () => 0, cell: () => <span style={{ color: '#94a3b8' }}>—</span>, exportValue: () => '—' },
    { id: 'totalWa', header: 'Total WA', accessor: d => d.totalWa },
    { id: 'sukses', header: 'Sukses', accessor: d => d.sukses, cell: d => <span style={{ color: '#16a34a' }}>{d.sukses}</span> },
    { id: 'failed', header: 'Failed', accessor: d => d.failed, cell: d => <span style={{ color: d.failed > 0 ? '#dc2626' : '#374151' }}>{d.failed}</span> },
  ], []);

  const totalCell: React.CSSProperties = { padding: '8px 12px', textAlign: 'right' };
  const footerRow = series.length > 0 ? (
    <tr style={{ background: '#eff6ff', fontWeight: 700, borderTop: '2px solid #bfdbfe' }}>
      <td style={{ padding: '8px 12px' }}>TOTAL</td>
      <td style={totalCell}>{totals.leads}</td>
      <td style={totalCell}>{totals.purchase}</td>
      <td style={totalCell}>{formatPct(totalsConv)}</td>
      <td style={totalCell}>{formatIDR(totals.revenue)}</td>
      <td style={{ ...totalCell, color: '#94a3b8' }}>—</td>
      <td style={{ ...totalCell, color: '#94a3b8' }}>—</td>
      <td style={totalCell}>{totals.totalWa}</td>
      <td style={{ ...totalCell, color: '#16a34a' }}>{totals.sukses}</td>
      <td style={{ ...totalCell, color: totals.failed > 0 ? '#dc2626' : '#374151' }}>{totals.failed}</td>
    </tr>
  ) : null;

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>Leads Report</h1>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0' }}>
            Ringkasan performa leads, penjualan, dan komunikasi WA
          </p>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Last updated: {lastUpdated}</span>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', background: '#fff', padding: '0.85rem 1rem', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div>
          <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 }}>Periode</label>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px 8px', fontSize: '0.875rem' }} />
            <span style={{ color: '#64748b' }}>–</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px 8px', fontSize: '0.875rem' }} />
          </div>
        </div>
        <div>
          <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 }}>Program</label>
          <select disabled style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px 8px', fontSize: '0.875rem', background: '#f8fafc', color: '#94a3b8' }}>
            <option>Diet90</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button onClick={handleApply} disabled={loading}
            style={{ padding: '7px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 2px 6px rgba(37,99,235,0.3)' }}>
            {loading ? 'Memuat…' : 'Terapkan'}
          </button>
          <button onClick={handleReset} disabled={loading}
            style={{ padding: '7px 18px', background: '#fff', color: '#374151', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
            Reset
          </button>
        </div>
      </div>

      {/* Today real-time KPI cards */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          Ringkasan Hari Ini (Real Time) — {todayWib()}
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <KpiCard label="Leads" value={today.leads} sub="Total leads hari ini" icon="👥" accent="#2563eb" />
          <KpiCard label="Purchase" value={today.purchase} sub="Total purchase hari ini" icon="🛒" accent="#7c3aed" />
          <KpiCard label="Conversion Rate" value={formatPct(today.convRate)} sub="Leads → Purchase" icon="📈" accent="#0ea5e9" />
          <KpiCard label="Revenue" value={formatIDR(today.revenue)} sub="Total revenue hari ini" icon="💰" accent="#16a34a" />
          <KpiCard label="Active" value={0} sub="Total users aktif" icon="🔥" stub />
          <KpiCard label="Conv. Rate Active" value="0%" sub="Segera hadir (program)" icon="⚡" stub />
        </div>
      </div>

      {/* 14-day series table */}
      <div>
        <h2 style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
          Performa 14 Hari Terakhir (Data Hari Kemarin ke Belakang)
        </h2>
        <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 0.75rem' }}>
          Menampilkan data {from} – {to}
        </p>
        <DataTable
          columns={columns}
          rows={series}
          pageSize={20}
          exportFileName={`leads-report_${from}_${to}`}
          exportTitle={`Leads Report ${from} – ${to}`}
          footerRow={footerRow}
        />
      </div>
    </div>
  );
}
