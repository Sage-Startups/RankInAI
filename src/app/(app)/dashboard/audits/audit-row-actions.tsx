'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, Download, MoreHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { archiveAuditAction, deleteAuditAction } from '@/app/(app)/dashboard/audits/actions';
import { cn } from '@/lib/utils';

export function AuditRowActions({
  auditId,
  archived,
  completed,
}: {
  auditId: string;
  archived: boolean;
  completed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const runAction = (action: () => Promise<{ ok: boolean; message?: string }>) => {
    setOpen(false);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? 'Done');
        router.refresh();
      } else {
        toast.error(result.message ?? 'That action could not be completed.');
      }
    });
  };

  return (
    <div className="relative inline-block text-left">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Audit actions"
        disabled={pending}
      >
        <MoreHorizontal aria-hidden="true" />
      </Button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            tabIndex={-1}
          />
          <div
            role="menu"
            className={cn(
              'absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg',
            )}
          >
            <Link
              href={`/dashboard/audits/${auditId}`}
              role="menuitem"
              className="block px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-muted)]"
              onClick={() => setOpen(false)}
            >
              Open report
            </Link>

            {completed ? (
              <a
                href={`/api/reports/${auditId}/pdf`}
                role="menuitem"
                className="flex items-center gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-muted)]"
                onClick={() => setOpen(false)}
              >
                <Download className="size-4" aria-hidden="true" />
                Download PDF
              </a>
            ) : null}

            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-muted)]"
              onClick={() => runAction(() => archiveAuditAction(auditId))}
            >
              {archived ? (
                <>
                  <ArchiveRestore className="size-4" aria-hidden="true" />
                  Restore audit
                </>
              ) : (
                <>
                  <Archive className="size-4" aria-hidden="true" />
                  Archive audit
                </>
              )}
            </button>

            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
              onClick={() => {
                if (
                  window.confirm(
                    'Delete this audit? It will be removed from your account. This cannot be undone.',
                  )
                ) {
                  runAction(() => deleteAuditAction(auditId));
                }
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete audit
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
