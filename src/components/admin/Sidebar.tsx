'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { label: 'Leads Report', href: '/admin', icon: '📊', ready: true },
  { label: 'Leads', href: '/admin/leads', icon: '👥' },
  { label: 'Purchase', href: '/admin/purchases', icon: '🛒' },
  { label: 'Users / Active', href: '/admin/active', icon: '🔥', ready: true },
  { label: 'WA Logs', href: '/admin/wa-logs', icon: '💬' },
  { label: 'Program', href: '/admin/program', icon: '🎯', ready: true },
  { label: 'Challenge', href: '/admin/challenge', icon: '🏆', ready: true },
  { label: 'Laporan', href: '/admin/reports', icon: '📄' },
  { label: 'Pengaturan', href: '/admin/settings', icon: '⚙️', ready: true },
];

type Props = {
  userName: string;
  userUsername: string;
  open: boolean;
  onNavigate: () => void;
};

export function Sidebar({ userName, userUsername, open, onNavigate }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const initials = (userName.trim()[0] ?? 'A').toUpperCase();

  async function logout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    onNavigate();
    router.push('/admin/login');
  }

  return (
    <aside className={`cms-sidebar${open ? ' cms-open' : ''}`}>
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
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`cms-nav-item${active ? ' cms-nav-active' : ''}`}
            >
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
