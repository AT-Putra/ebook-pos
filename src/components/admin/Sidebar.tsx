'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Leads Report', href: '/admin' },
  { label: 'Leads', href: '/admin/leads' },
  { label: 'Purchase', href: '/admin/purchases' },
  { label: 'Users / Active', href: '/admin/active' },
  { label: 'WA Logs', href: '/admin/wa-logs' },
  { label: 'Program', href: '/admin/program' },
  { label: 'Laporan', href: '/admin/reports' },
  { label: 'Pengaturan', href: '/admin/settings' },
];

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  return (
    <aside style={{
      width: 200, minHeight: '100vh', background: '#1e293b', color: '#cbd5e1',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{ padding: '1.25rem 1rem', fontWeight: 700, fontSize: '0.95rem', color: '#fff', borderBottom: '1px solid #334155' }}>
        Leads Report
      </div>
      <nav style={{ flex: 1, padding: '0.5rem 0' }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'block', padding: '0.6rem 1rem', fontSize: '0.875rem',
                color: active ? '#fff' : '#94a3b8',
                background: active ? '#2563eb' : 'transparent',
                textDecoration: 'none', borderRadius: 4, margin: '1px 6px',
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #334155', fontSize: '0.8rem' }}>
        <div style={{ color: '#94a3b8', marginBottom: 4 }}>Admin</div>
        <div style={{ color: '#e2e8f0', marginBottom: 8 }}>{userName}</div>
        <button
          onClick={handleLogout}
          style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Keluar
        </button>
      </div>
    </aside>
  );
}
