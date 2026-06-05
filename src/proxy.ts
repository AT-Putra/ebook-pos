import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '@/lib/cookie-names';

// Auth endpoints handle their own auth — never gate them here.
const PUBLIC_PATHS = ['/admin/login', '/api/admin/auth/'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin/')) {
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/admin/login';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
