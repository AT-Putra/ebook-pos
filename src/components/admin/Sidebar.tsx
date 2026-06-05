'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { label: 'Leads Report', href: '/admin', icon: '📊', ready: true },
  { label: 'Leads', href: '/admin/leads', icon: '👥' },
  { label: 'Purchase', href: '/admin/purchases', icon: '🛒' },
  { label: 'Users / Active', href: '/admin/active', icon: '🔥' },
  { label: 'WA Logs', href: '/admin/wa-logs', icon: '💬' },
  { label: 'Program', href: '/admin/program', icon: '🎯' },
  { label: 'Laporan', href: '/admin/reports', icon: '📄' },
  { label: 'Pengaturan', href: '/admin/settings', icon: '⚙️', ready: true },
];

export function Sidebar({ userName, userUsername }: { userName: string; userUsername: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const initials = (userName.trim()[0] ?? 'A').toUpperCase();

  async function logout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  return (
    <aside className="cms-sidebar">
      <style>{CSS}</style>

      <div className="cms-brand">
        <span className="cms-brand-logo">📊</span>
        <span>Leads Report</span>
      </div>

      <nav className="cms-nav">
        {NAV.map(item => {
          if (!item.ready) {
            return (
              <span key={item.href} className="cms-nav-item cms-nav-disabled" title="Segera hadir">
                <span className="cms-nav-ico">{item.icon}</span>
                <span>{item.label}</span>
                <span className="cms-soon">soon</span>
              </span>
            );
          }
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`cms-nav-item${active ? ' cms-nav-active' : ''}`}>
              <span className="cms-nav-ico">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="cms-user">
        <div className="cms-avatar">{initials}</div>
        <div className="cms-user-meta">
          <div className="cms-user-name">{userName}</div>
          <div className="cms-user-sub">@{userUsername}</div>
        </div>
        <button onClick={logout} className="cms-logout" title="Keluar">⎋</button>
      </div>
    </aside>
  );
}

const CSS = `
.cms-sidebar { width: 232px; min-height: 100vh; background: linear-gradient(180deg,#1e293b 0%,#0f172a 100%);
  color: #cbd5e1; display: flex; flex-direction: column; flex-shrink: 0; }
.cms-brand { display: flex; align-items: center; gap: 10px; padding: 1.25rem 1.1rem; font-weight: 700;
  font-size: 1rem; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.08); }
.cms-brand-logo { width: 30px; height: 30px; border-radius: 8px; background: #2563eb; display: inline-flex;
  align-items: center; justify-content: center; font-size: 0.95rem; }
.cms-nav { flex: 1; padding: 0.75rem 0.6rem; display: flex; flex-direction: column; gap: 2px; }
.cms-nav-item { display: flex; align-items: center; gap: 11px; padding: 0.6rem 0.8rem; font-size: 0.875rem;
  color: #94a3b8; text-decoration: none; border-radius: 8px; transition: background .15s, color .15s; }
.cms-nav-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
.cms-nav-active, .cms-nav-active:hover { background: #2563eb; color: #fff; font-weight: 600;
  box-shadow: 0 4px 12px rgba(37,99,235,0.35); }
.cms-nav-ico { width: 18px; text-align: center; font-size: 0.95rem; }
.cms-nav-disabled, .cms-nav-disabled:hover { color: #64748b; cursor: default; background: transparent; }
.cms-soon { margin-left: auto; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.04em;
  background: rgba(255,255,255,0.06); color: #64748b; padding: 1px 6px; border-radius: 999px; }
.cms-user { display: flex; align-items: center; gap: 10px; padding: 0.85rem 1rem;
  border-top: 1px solid rgba(255,255,255,0.08); }
.cms-avatar { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg,#3b82f6,#2563eb);
  color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.95rem;
  flex-shrink: 0; }
.cms-user-meta { flex: 1; min-width: 0; }
.cms-user-name { color: #fff; font-size: 0.85rem; font-weight: 600; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; }
.cms-user-sub { color: #94a3b8; font-size: 0.72rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cms-logout { background: rgba(255,255,255,0.08); border: none; color: #cbd5e1; width: 30px; height: 30px;
  border-radius: 8px; cursor: pointer; font-size: 1rem; line-height: 1; transition: background .15s, color .15s; }
.cms-logout:hover { background: rgba(239,68,68,0.85); color: #fff; }
`;
