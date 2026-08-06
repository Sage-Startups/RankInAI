'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/users', label: 'Users', exact: false },
  { href: '/admin/audits', label: 'Audits', exact: false },
  { href: '/admin/jobs', label: 'Jobs', exact: false },
  { href: '/admin/payments', label: 'Payments', exact: false },
  { href: '/admin/subscriptions', label: 'Subscriptions', exact: false },
  { href: '/admin/contacts', label: 'Contacts', exact: false },
  { href: '/admin/analytics', label: 'Analytics', exact: false },
  { href: '/admin/demo-data', label: 'Demo data', exact: false },
  { href: '/admin/settings', label: 'Settings', exact: false },
  { href: '/admin/system', label: 'System', exact: false },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="border-t border-[var(--border)]">
      <div className="rk-container">
        <ul className="-mb-px flex gap-1 overflow-x-auto">
          {LINKS.map((link) => {
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-block whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-medium transition-colors',
                    active
                      ? 'border-cyan-500 text-[var(--foreground)]'
                      : 'border-transparent text-[var(--muted-foreground)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
