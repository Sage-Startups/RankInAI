import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { AccountStatus } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { authBaseConfig } from '@/lib/auth/config';
import { normalizeEmail, verifyPassword } from '@/lib/auth/password';
import { RATE_LIMITS, clearRateLimit, consumeRateLimit } from '@/lib/rate-limit';

/**
 * Thrown for every credentials failure. The message is deliberately identical
 * for "no such user", "wrong password" and "no password set" so sign-in cannot
 * be used to enumerate registered email addresses.
 */
export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';
export const SUSPENDED_MESSAGE =
  'This account has been suspended. Contact support if you believe this is a mistake.';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authBaseConfig,
  adapter: PrismaAdapter(prisma),
  secret: getEnv().authSecret,
  providers: [
    Credentials({
      id: 'credentials',
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = normalizeEmail(parsed.data.email);

        // Throttle by email address. IP-level throttling happens in the
        // sign-in server action before this provider is reached.
        const limit = await consumeRateLimit(RATE_LIMITS.signIn, email);
        if (!limit.allowed) {
          throw new Error('RATE_LIMITED');
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            status: true,
            passwordHash: true,
            deletedAt: true,
          },
        });

        // Always run the (dummy) hash comparison so response timing does not
        // reveal whether the address exists.
        const passwordOk = await verifyPassword(parsed.data.password, user?.passwordHash ?? null);

        if (!user || user.deletedAt || !passwordOk) return null;

        if (user.status === AccountStatus.SUSPENDED) {
          throw new Error('ACCOUNT_SUSPENDED');
        }

        await Promise.all([
          prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          }),
          clearRateLimit(RATE_LIMITS.signIn, email),
        ]);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          status: user.status,
        };
      },
    }),
  ],
});
