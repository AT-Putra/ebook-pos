import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '@/lib/cookie-names';

// Guards only the /admin/* UI pages: no session cookie → bounce to the login
// page. API routes under /api/admin/* are NOT gated here — they self-authenticate
// (session cookie OR ADMIN_TOKEN bearer) via requireAdmin(), so machine/curl
// callers keep working. Cookie presence is a cheap first check; the page layout
// fully validates the session server-side.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/admin')) return NextResponse.next();
  if (pathname.startsWith('/admin/login')) return NextResponse.next();

  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/admin/login';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
