import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe portion of the Auth.js configuration.
 *
 * This file must not import Prisma, bcrypt or any Node-only module: it is
 * loaded by `middleware.ts`, which runs on the edge runtime. The credentials
 * provider and Prisma adapter live in `./index.ts`.
 */
export const authBaseConfig = {
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 14, // 14 days
    updateAge: 60 * 60 * 24, // refresh at most once a day
  },
  pages: {
    signIn: '/signin',
    signOut: '/signout',
    error: '/auth-error',
    newUser: '/onboarding',
  },
  trustHost: true,
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: 'USER' | 'SUPER_ADMIN' }).role ?? 'USER';
        token.status = (user as { status?: string }).status ?? 'ACTIVE';
      }
      // Allow the app to push fresh role/status into the token after an
      // admin-side change without forcing a full re-login.
      if (trigger === 'update' && session) {
        const patch = session as { role?: 'USER' | 'SUPER_ADMIN'; status?: string };
        if (patch.role) token.role = patch.role;
        if (patch.status) token.status = patch.status;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? '';
        session.user.role = (token.role as 'USER' | 'SUPER_ADMIN') ?? 'USER';
        session.user.status = (token.status as string) ?? 'ACTIVE';
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
