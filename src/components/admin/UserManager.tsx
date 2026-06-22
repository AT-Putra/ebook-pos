'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Card } from './Card';

type AdminUser = {
  id: string;
  username: string;
  name: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const btn = (bg: string): React.CSSProperties => ({
  padding: '6px 12px', background: bg, color: '#fff', border: 'none', borderRadius: 6,
  fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
});
const ghostBtn: React.CSSProperties = {
  padding: '6px 12px', background: '#fff', color: '#334155', border: '1px solid #cbd5e1',
  borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
};
const input: React.CSSProperties = {
  border: '1px solid #cbd5e1', borderRadius: 6, padding: '7px 10px', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  });
}

export function UserManager() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ username: '', name: '', password: '' });
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/admin/users');
    if (!res.ok) return;
    const d = await res.json();
    setUsers(d.users);
    setCurrentUserId(d.currentUserId);
  }
  useEffect(() => { load(); }, []);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setAdding(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ username: '', name: '', password: '' });
        await load();
      } else {
        setError((await res.json()).error ?? 'Gagal menambah akun.');
      }
    } finally {
      setAdding(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setError('');
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) await load();
      else setError((await res.json()).error ?? 'Gagal menyimpan.');
    } finally {
      setBusyId(null);
    }
  }

  function rename(u: AdminUser) {
    const name = window.prompt('Nama baru:', u.name);
    if (name && name.trim() && name.trim() !== u.name) patch(u.id, { name: name.trim() });
  }
  function resetPw(u: AdminUser) {
    const password = window.prompt(`Kata sandi baru untuk @${u.username} (min. 8 karakter):`);
    if (password) patch(u.id, { password });
  }
  function toggleActive(u: AdminUser) {
    if (u.isActive && !window.confirm(`Nonaktifkan @${u.username}? Sesi loginnya akan dicabut.`)) return;
    patch(u.id, { isActive: !u.isActive });
  }

  const activeCount = users?.filter(u => u.isActive).length ?? 0;

  return (
    <Card
      title="Pengguna (Admin)"
      description="Kelola akun yang bisa masuk ke dashboard. Tambah, ganti nama, atur ulang kata sandi, atau nonaktifkan."
    >
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <div style={{ flex: '1 1 140px' }}>
          <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 }}>Username</label>
          <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} style={input} placeholder="cth: operator2" required />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 }}>Nama</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} placeholder="Nama lengkap" required />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3 }}>Kata sandi</label>
          <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={input} placeholder="min. 8 karakter" required />
        </div>
        <button type="submit" disabled={adding} style={{ ...btn('#2563eb'), padding: '8px 16px', opacity: adding ? 0.7 : 1 }}>
          {adding ? 'Menambah…' : 'Tambah'}
        </button>
      </form>

      {error && <p style={{ fontSize: '0.8rem', color: '#dc2626', margin: '0 0 0.75rem' }}>{error}</p>}

      {users === null ? (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>Memuat…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map(u => {
            const isSelf = u.id === currentUserId;
            const lastActive = u.isActive && activeCount <= 1;
            const cannotDeactivate = u.isActive && (isSelf || lastActive);
            return (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                border: '1px solid #f1f5f9', borderRadius: 8, padding: '10px 12px',
                opacity: u.isActive ? 1 : 0.6,
              }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                    {u.name}{isSelf && <span style={{ color: '#94a3b8', fontWeight: 400 }}> (Anda)</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>@{u.username} · Masuk terakhir: {fmtDate(u.lastLoginAt)}</div>
                </div>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, padding: '2px 9px', borderRadius: 999,
                  background: u.isActive ? '#dcfce7' : '#f1f5f9', color: u.isActive ? '#16a34a' : '#64748b',
                }}>
                  {u.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => rename(u)} disabled={busyId === u.id} style={ghostBtn}>Ganti nama</button>
                  <button onClick={() => resetPw(u)} disabled={busyId === u.id} style={ghostBtn}>Reset sandi</button>
                  <button
                    onClick={() => toggleActive(u)}
                    disabled={busyId === u.id || cannotDeactivate}
                    title={cannotDeactivate ? (isSelf ? 'Tidak bisa menonaktifkan akun sendiri' : 'Admin aktif terakhir') : ''}
                    style={cannotDeactivate ? { ...ghostBtn, opacity: 0.4, cursor: 'not-allowed' } : btn(u.isActive ? '#dc2626' : '#16a34a')}
                  >
                    {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
