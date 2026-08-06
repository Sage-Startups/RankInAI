import Link from 'next/link';

import { AdminNav } from '@/components/admin/admin-nav';
import { Logo } from '@/components/brand/logo';
import { Badge } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/guards';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-dvh bg-[var(--surface-muted)]">
      <div className="bg-ink-950 px-4 py-2 text-center text-xs font-semibold tracking-[0.12em] text-cyan-300 uppercase">
        Super-admin area — signed in as {admin.email}
      </div>

      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="rk-container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo href="/admin" />
            <Badge tone="info">Admin</Badge>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-[var(--muted-foreground)] underline-offset-4 hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
        <AdminNav />
      </header>

      <main id="main" className="rk-container py-8">
        {children}
      </main>
    </div>
  );
}
