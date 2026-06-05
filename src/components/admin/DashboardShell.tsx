'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';

export function DashboardShell({
  userName,
  userUsername,
  children,
}: {
  userName: string;
  userUsername: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="cms-shell">
      <style>{CSS}</style>

      <div className={`cms-overlay${open ? ' cms-open' : ''}`} onClick={close} />

      <Sidebar userName={userName} userUsername={userUsername} open={open} onNavigate={close} />

      <div className="cms-main">
        <div className="cms-topbar">
          <button className="cms-hamburger" onClick={() => setOpen(true)} aria-label="Buka menu">☰</button>
          <span className="cms-topbar-title">Leads Report</span>
        </div>
        {children}
      </div>
    </div>
  );
}

const CSS = `
.cms-shell { display: flex; min-height: 100vh; background: #f1f5f9; font-family: system-ui, sans-serif; }
.cms-main { flex: 1; min-width: 0; }
.cms-topbar { display: none; }
.cms-overlay { display: none; }

/* Sidebar */
.cms-sidebar { width: 232px; min-height: 100vh; background: linear-gradient(180deg,#1e293b 0%,#0f172a 100%);
  color: #cbd5e1; display: flex; flex-direction: column; flex-shrink: 0; }
.cms-brand { display: flex; align-items: center; gap: 10px; padding: 1.25rem 1.1rem; font-weight: 700;
  font-size: 1rem; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.08); }
.cms-brand-logo { width: 30px; height: 30px; border-radius: 8px; background: #2563eb; display: inline-flex;
  align-items: center; justify-content: center; font-size: 0.95rem; }
.cms-nav { flex: 1; padding: 0.75rem 0.6rem; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
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

/* Mobile: collapse the sidebar into an off-canvas drawer + top bar */
@media (max-width: 768px) {
  .cms-topbar { display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 40;
    background: #1e293b; color: #fff; padding: 0.55rem 0.85rem; }
  .cms-topbar-title { font-weight: 700; font-size: 0.95rem; }
  .cms-hamburger { background: rgba(255,255,255,0.1); border: none; color: #fff; width: 38px; height: 38px;
    border-radius: 8px; font-size: 1.15rem; cursor: pointer; flex-shrink: 0; }
  .cms-sidebar { position: fixed; top: 0; left: 0; height: 100vh; transform: translateX(-100%);
    transition: transform .2s ease; z-index: 50; box-shadow: 2px 0 16px rgba(0,0,0,0.3); }
  .cms-sidebar.cms-open { transform: translateX(0); }
  .cms-overlay.cms-open { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 45; }
}
`;
