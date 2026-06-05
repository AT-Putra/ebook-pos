import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/session';
import { COOKIE_NAME } from '@/lib/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect('/admin/login');

  const user = await validateSession(token);
  if (!user) redirect('/admin/login');

  return <>{children}</>;
}
