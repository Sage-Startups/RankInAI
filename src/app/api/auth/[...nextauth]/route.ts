import { handlers } from '@/lib/auth';

/** Auth.js route handler. Node runtime — Prisma and bcrypt are not edge-safe. */
export const runtime = 'nodejs';

export const { GET, POST } = handlers;
