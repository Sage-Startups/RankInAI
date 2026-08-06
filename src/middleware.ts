import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { authBaseConfig } from '@/lib/auth/config';

/**
 * Edge middleware — a fast first gate only.
 *
 * Authoritative authorization lives in server components and route handlers
 * (`requireUser` / `requireAdmin` / `requireApiAdmin`), which re-read the user
 * row so a suspension or role change takes effect immediately. This middleware
 * exists to avoid rendering protected shells for obviously-unauthenticated
 * requests, not to be the security boundary.
 */

const PROTECTED_PREFIXES = ['/dashboard', '/onboarding', '/admin', '/checkout'];
const ADMIN_PREFIX = '/admin';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!needsAuth) return NextResponse.next();

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? 'rankinai-development-only-secret-do-not-use-in-production',
    secureCookie: process.env.NODE_ENV === 'production',
    salt:
      process.env.NODE_ENV === 'production'
        ? '__Secure-authjs.session-token'
        : 'authjs.session-token',
  });

  if (!token) {
    const signInUrl = new URL(authBaseConfig.pages.signIn, request.url);
    signInUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  // Admin routes get a cheap role pre-check; `requireAdmin` re-verifies from
  // the database on every admin page and API handler.
  if (pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`)) {
    if (token.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/dashboard?denied=admin', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding/:path*', '/admin/:path*', '/checkout/:path*'],
};
