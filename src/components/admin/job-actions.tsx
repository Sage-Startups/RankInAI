'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, Ban, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  archiveAuditAdminAction,
  cancelAuditAction,
  retryAuditAction,
} from '@/app/(admin)/admin/actions';

export function JobActions({
  auditId,
  jobStatus,
  archived,
  compact = false,
}: {
  auditId: string;
  jobStatus: string | null;
  archived: boolean;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (action: () => Promise<{ ok: boolean; message?: string }>) => {
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

  const size = compact ? 'sm' : 'md';

  return (
    <div className="flex flex-wrap gap-2">
      {jobStatus === 'FAILED' || jobStatus === 'CANCELED' ? (
        <Button
          type="button"
          variant="secondary"
          size={size}
          loading={pending}
          onClick={() => run(() => retryAuditAction(auditId))}
        >
          <RotateCcw aria-hidden="true" />
          Retry
        </Button>
      ) : null}

      {jobStatus === 'QUEUED' ? (
        <Button
          type="button"
          variant="danger"
          size={size}
          loading={pending}
          onClick={() => {
            if (window.confirm('Cancel this queued audit? The credit will be returned.')) {
              run(() => cancelAuditAction(auditId));
            }
          }}
        >
          <Ban aria-hidden="true" />
          Cancel
        </Button>
      ) : null}

      {!compact ? (
        <Button
          type="button"
          variant="ghost"
          size={size}
          loading={pending}
          onClick={() => run(() => archiveAuditAdminAction(auditId))}
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
      ) : null}
    </div>
  );
}
