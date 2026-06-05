import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validateSession, COOKIE_NAME } from '@/lib/session';
import { Sidebar } from '@/components/admin/Sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect('/admin/login');

  const user = await validateSession(token);
  if (!user) redirect('/admin/login');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <Sidebar userName={user.name} />
      <main style={{ flex: 1, overflow: 'auto' }}>{children}</main>
    </div>
  );
}
