'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.get('username'),
          password: form.get('password'),
        }),
      });
      if (res.ok) {
        router.push('/admin');
      } else {
        const data = await res.json();
        setError(data.error ?? 'Login gagal.');
      }
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 16, boxSizing: 'border-box' }}>
      <div style={{ background: '#fff', padding: '2rem', borderRadius: 8, width: '100%', maxWidth: 360, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
        <h1 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 700 }}>Masuk — Dashboard</h1>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Username</label>
            <input
              name="username"
              type="text"
              autoComplete="username"
              required
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Password</label>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          {error && (
            <p style={{ color: '#c0392b', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '0.625rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}
