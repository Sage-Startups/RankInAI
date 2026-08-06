import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Search } from 'lucide-react';

import { Badge, Card, EmptyState, Input, Skeleton } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { DemoToggle } from '@/components/admin/demo-toggle';
import { requireAdmin } from '@/lib/auth/guards';
import { searchUsers } from '@/lib/admin/metrics';
import { formatDate, relativeTime } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin — users',
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 25;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; demo?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const includeDemo = params.demo === '1';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);

  const { users, total } = await searchUsers({
    query: params.q,
    includeDemo,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {total} {total === 1 ? 'account' : 'accounts'}
            {params.q ? ` matching “${params.q}”` : ''}.
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-10 w-56" />}>
          <DemoToggle includeDemo={includeDemo} />
        </Suspense>
      </header>

      <Card className="p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          {includeDemo ? <input type="hidden" name="demo" value="1" /> : null}
          <div className="min-w-64 flex-1">
            <label htmlFor="user-search" className="sr-only">
              Search users
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                aria-hidden="true"
              />
              <Input
                id="user-search"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder="Search by email or name"
                className="pl-9"
              />
            </div>
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {params.q ? (
            <Button asChild variant="ghost">
              <Link href={`/admin/users${includeDemo ? '?demo=1' : ''}`}>Clear</Link>
            </Button>
          ) : null}
        </form>
      </Card>

      {users.length === 0 ? (
        <Card>
          <EmptyState
            title="No users found"
            description={
              params.q
                ? 'No account matches that search. Try a different email address or name.'
                : 'No accounts exist yet. They will appear here as people register.'
            }
            className="border-0"
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-4xl border-collapse text-left text-sm">
            <caption className="sr-only">Registered users</caption>
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <th scope="col" className="px-5 py-3 font-semibold">User</th>
                <th scope="col" className="px-5 py-3 font-semibold">Role</th>
                <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                <th scope="col" className="px-5 py-3 font-semibold">Credits</th>
                <th scope="col" className="px-5 py-3 font-semibold">Audits</th>
                <th scope="col" className="px-5 py-3 font-semibold">Joined</th>
                <th scope="col" className="px-5 py-3 font-semibold">Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-[var(--border)] last:border-0">
                  <th scope="row" className="px-5 py-3.5 font-normal">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                    >
                      {user.name ?? user.email}
                    </Link>
                    <span className="block text-xs text-[var(--muted-foreground)]">{user.email}</span>
                    {user.isDemo ? (
                      <Badge tone="demo" className="mt-1">
                        Demo account
                      </Badge>
                    ) : null}
                  </th>
                  <td className="px-5 py-3.5">
                    <Badge tone={user.role === 'SUPER_ADMIN' ? 'info' : 'neutral'}>
                      {user.role === 'SUPER_ADMIN' ? 'Super admin' : 'User'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      tone={
                        user.status === 'ACTIVE'
                          ? 'success'
                          : user.status === 'SUSPENDED'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {user.status.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 tabular-nums">{user.oneTimeCredits}</td>
                  <td className="px-5 py-3.5 tabular-nums">{user._count.audits}</td>
                  <td className="px-5 py-3.5 text-[var(--muted-foreground)]">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-5 py-3.5 text-[var(--muted-foreground)]">
                    {user.lastLoginAt ? relativeTime(user.lastLoginAt) : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-4" aria-label="Pagination">
          <p className="text-sm text-[var(--muted-foreground)]">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm" disabled={page <= 1}>
              <Link href={pageHref(params, page - 1)}>Previous</Link>
            </Button>
            <Button asChild variant="secondary" size="sm" disabled={page >= totalPages}>
              <Link href={pageHref(params, page + 1)}>Next</Link>
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function pageHref(params: { q?: string; demo?: string }, page: number): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.demo) search.set('demo', params.demo);
  search.set('page', String(Math.max(1, page)));
  return `/admin/users?${search.toString()}`;
}
