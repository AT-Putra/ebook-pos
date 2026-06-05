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
      background: '#fff', borderRadius: 10, padding: '1rem 1.1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flex: 1, minWidth: 150,
      borderTop: `3px solid ${stub ? '#cbd5e1' : accent}`,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>{label}</span>
        {icon && (
          <span style={{
            width: 28, height: 28, borderRadius: 8, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem',
            background: stub ? '#f1f5f9' : `${accent}1a`,
          }}>{icon}</span>
        )}
      </div>
      <div style={{ fontSize: '1.55rem', fontWeight: 700, color: stub ? '#94a3b8' : '#0f172a', lineHeight: 1.1 }}>
        {stub ? '—' : value}
      </div>
      {sub && <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{sub}</div>}
    </div>
  );
}
