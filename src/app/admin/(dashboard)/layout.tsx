import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validateSession, COOKIE_NAME } from '@/lib/session';
import { DashboardShell } from '@/components/admin/DashboardShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect('/admin/login');

  const user = await validateSession(token);
  if (!user) redirect('/admin/login');

  return (
    <DashboardShell userName={user.name} userUsername={user.username}>
      {children}
    </DashboardShell>
  );
}
