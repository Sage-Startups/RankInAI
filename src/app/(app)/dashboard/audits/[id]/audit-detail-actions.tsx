'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { archiveAuditAction, rerunAuditAction } from '@/app/(app)/dashboard/audits/actions';

export function AuditDetailActions({
  auditId,
  archived,
  canRerun,
}: {
  auditId: string;
  archived: boolean;
  canRerun: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-2.5">
      {canRerun ? (
        <Button
          type="button"
          variant="secondary"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await rerunAuditAction(auditId);
              // A successful re-run redirects, so only a failure returns here.
              if (result && !result.ok) {
                toast.error(result.message ?? 'The audit could not be re-run.');
              }
            })
          }
        >
          <RotateCcw aria-hidden="true" />
          Re-run audit
        </Button>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await archiveAuditAction(auditId);
            if (result.ok) {
              toast.success(result.message ?? 'Done');
              router.refresh();
            } else {
              toast.error(result.message ?? 'That action could not be completed.');
            }
          })
        }
      >
        {archived ? (
          <>
            <ArchiveRestore aria-hidden="true" />
            Restore
          </>
        ) : (
          <>
            <Archive aria-hidden="true" />
            Archive
          </>
        )}
      </Button>
    </div>
  );
}
