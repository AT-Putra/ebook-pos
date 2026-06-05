'use client';

import { useState, useCallback } from 'react';
import { KpiCard } from './KpiCard';
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

  // Totals row
  const totals = series.reduce<Omit<DayMetrics, 'date' | 'convRate' | 'convRateActive'> & { leads: number; purchase: number }>(
    (acc, d) => ({
      leads: acc.leads + d.leads,
      purchase: acc.purchase + d.purchase,
      revenue: acc.revenue + d.revenue,
      active: 0,
      totalWa: acc.totalWa + d.totalWa,
      sukses: acc.sukses + d.sukses,
      failed: acc.failed + d.failed,
    }),
    { leads: 0, purchase: 0, revenue: 0, active: 0, totalWa: 0, sukses: 0, failed: 0 }
  );
  const totalsConv = totals.leads > 0 ? (totals.purchase / totals.leads) * 100 : 0;

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Leads Report</h1>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Last updated: {lastUpdated}</span>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 2 }}>Periode</label>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px 8px', fontSize: '0.875rem' }} />
            <span style={{ color: '#64748b' }}>–</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px 8px', fontSize: '0.875rem' }} />
          </div>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: 2 }}>Program</label>
          <select disabled style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px 8px', fontSize: '0.875rem', background: '#f8fafc', color: '#94a3b8' }}>
            <option>Diet90</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
          <button onClick={handleApply} disabled={loading}
            style={{ padding: '5px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            Terapkan
          </button>
          <button onClick={handleReset} disabled={loading}
            style={{ padding: '5px 16px', background: '#fff', color: '#374151', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.875rem', cursor: 'pointer' }}>
            Reset
          </button>
        </div>
      </div>

      {/* Today real-time KPI cards */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.75rem' }}>
          Ringkasan Hari Ini (Real Time) — {todayWib()}
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <KpiCard label="Leads" value={today.leads} sub="Total leads hari ini" />
          <KpiCard label="Purchase" value={today.purchase} sub="Total purchase hari ini" />
          <KpiCard label="Conversion Rate" value={formatPct(today.convRate)} sub="Leads → Purchase" />
          <KpiCard label="Revenue" value={formatIDR(today.revenue)} sub="Total revenue hari ini" />
          <KpiCard label="Active" value={0} sub="Total users aktif" stub />
          <KpiCard label="Conversion Rate Active" value="0%" sub="Active (segera hadir)" stub />
        </div>
      </div>

      {/* 14-day series table */}
      <div>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.75rem' }}>
          Performa 14 Hari Terakhir (Data Hari Kemarin ke Belakang)
        </h2>
        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Tanggal', 'Leads', 'Purchase', 'Conv. Rate', 'Revenue', 'Active', 'Conv. Rate Active', 'Total WA', 'Sukses', 'Failed'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Tanggal' ? 'left' : 'right', color: '#374151', fontWeight: 600, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Tidak ada data.</td></tr>
              ) : (
                series.map((d, i) => (
                  <tr key={d.date} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={{ padding: '7px 12px', color: '#374151' }}>{d.date}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right' }}>{d.leads}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right' }}>{d.purchase}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right' }}>{formatPct(d.convRate)}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right' }}>{formatIDR(d.revenue)}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right' }}>{d.totalWa}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: '#16a34a' }}>{d.sukses}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: d.failed > 0 ? '#dc2626' : '#374151' }}>{d.failed}</td>
                  </tr>
                ))
              )}
              {/* Totals row */}
              {series.length > 0 && (
                <tr style={{ background: '#eff6ff', fontWeight: 600, borderTop: '2px solid #bfdbfe' }}>
                  <td style={{ padding: '7px 12px' }}>TOTAL</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>{totals.leads}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>{totals.purchase}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>{totalsConv.toFixed(2)}%</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>{formatIDR(totals.revenue)}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>{totals.totalWa}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#16a34a' }}>{totals.sukses}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: totals.failed > 0 ? '#dc2626' : '#374151' }}>{totals.failed}</td>
                </tr>
              )}
            </tbody>
          </table>
          {series.length > 0 && (
            <div style={{ padding: '6px 12px', fontSize: '0.7rem', color: '#94a3b8', borderTop: '1px solid #e2e8f0' }}>
              Menampilkan data {from} – {to}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
