'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CreditCard,
  FilePlus2,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Settings,
  Shield,
  X,
} from 'lucide-react';

import { Logo } from '@/components/brand/logo';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/audits/new', label: 'New audit', icon: FilePlus2, exact: true },
  { href: '/dashboard/audits', label: 'Audits', icon: ListChecks, exact: false },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard, exact: true },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, exact: true },
];

export function AppShell({
  children,
  user,
  isAdmin,
  billingTestMode,
  billingModeMessage,
}: {
  children: React.ReactNode;
  user: { name: string | null; email: string };
  isAdmin: boolean;
  billingTestMode: boolean;
  billingModeMessage: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const initials = (user.name ?? user.email)
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="min-h-dvh bg-[var(--surface-muted)]">
      {billingTestMode ? (
        <div
          role="status"
          className="bg-amber-500 px-4 py-2 text-center text-[0.8125rem] font-semibold text-amber-950"
        >
          BILLING TEST MODE — {billingModeMessage}
        </div>
      ) : null}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] lg:flex">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <Logo />
          </div>
          <SidebarNav pathname={pathname} isAdmin={isAdmin} />
          <UserFooter initials={initials} user={user} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile header */}
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:hidden">
            <Logo size={26} />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-[var(--surface-muted)]"
              aria-expanded={open}
              aria-controls="app-mobile-nav"
              aria-label={open ? 'Close menu' : 'Open menu'}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </header>

          {open ? (
            <div
              id="app-mobile-nav"
              className="border-b border-[var(--border)] bg-[var(--surface)] lg:hidden"
            >
              <SidebarNav pathname={pathname} isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
              <UserFooter initials={initials} user={user} />
            </div>
          ) : null}

          <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarNav({
  pathname,
  isAdmin,
  onNavigate,
}: {
  pathname: string;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 p-3" aria-label="Dashboard">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]',
            )}
          >
            <Icon className="size-4.5 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}

      {isAdmin ? (
        <>
          <hr className="my-3 border-[var(--border)]" />
          <Link
            href="/admin"
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              pathname.startsWith('/admin')
                ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]',
            )}
          >
            <Shield className="size-4.5 shrink-0" aria-hidden="true" />
            Admin area
            <Badge tone="info" className="ml-auto">
              Admin
            </Badge>
          </Link>
        </>
      ) : null}
    </nav>
  );
}

function UserFooter({
  initials,
  user,
}: {
  initials: string;
  user: { name: string | null; email: string };
}) {
  return (
    <div className="border-t border-[var(--border)] p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-700 dark:text-violet-300"
          aria-hidden="true"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name ?? 'Your account'}</p>
          <p className="truncate text-xs text-[var(--muted-foreground)]">{user.email}</p>
        </div>
      </div>
      <Button asChild variant="ghost" size="sm" className="mt-1 w-full justify-start">
        <Link href="/signout">
          <LogOut aria-hidden="true" />
          Sign out
        </Link>
      </Button>
    </div>
  );
}
