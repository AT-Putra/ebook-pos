// Kept in a separate file so middleware (Edge Runtime) can import the constant
// without pulling in node:crypto via session.ts.
export const ADMIN_SESSION_COOKIE = 'admin_session';
