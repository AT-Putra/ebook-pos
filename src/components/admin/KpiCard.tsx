type Props = {
  label: string;
  value: string | number;
  sub?: string;
  stub?: boolean;
};

export function KpiCard({ label, value, sub, stub }: Props) {
  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: '1rem 1.25rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flex: 1, minWidth: 130,
    }}>
      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stub ? '#94a3b8' : '#0f172a' }}>
        {stub ? '—' : value}
      </div>
      {sub && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
