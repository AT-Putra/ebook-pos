type Props = {
  label: string;
  value: string | number;
  sub?: string;
  icon?: string;
  accent?: string;
  stub?: boolean;
};

export function KpiCard({ label, value, sub, icon, accent = '#2563eb', stub }: Props) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '1.1rem 1.2rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flex: '1 1 165px', minWidth: 165,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      {icon && (
        <span style={{
          width: 46, height: 46, borderRadius: 12, flexShrink: 0,
          background: stub ? '#f1f5f9' : `${accent}1a`,
          color: stub ? '#94a3b8' : accent,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem',
        }}>{icon}</span>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500, marginBottom: 3, whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stub ? '#94a3b8' : '#0f172a', lineHeight: 1 }}>
          {stub ? '—' : value}
        </div>
        {sub && <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>
    </div>
  );
}
