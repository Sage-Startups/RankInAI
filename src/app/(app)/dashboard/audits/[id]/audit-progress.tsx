'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { Card, Progress } from '@/components/ui/primitives';

/**
 * Live audit progress.
 *
 * Polls a lightweight status endpoint. When the audit reaches a terminal state
 * the page is refreshed so the server component renders the finished report.
 */

interface StatusResponse {
  status: string;
  progress: number;
  message: string | null;
  step: string | null;
  finished: boolean;
}

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 480; // ~20 minutes, well beyond any real audit

export function AuditProgress({
  auditId,
  initialProgress,
  initialMessage,
  initialStatus,
  pageLimit,
}: {
  auditId: string;
  initialProgress: number;
  initialMessage: string;
  initialStatus: string;
  pageLimit: number;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState(initialProgress);
  const [message, setMessage] = useState(initialMessage);
  const [status, setStatus] = useState(initialStatus);
  const [stalled, setStalled] = useState(false);
  const polls = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      polls.current += 1;

      if (polls.current > MAX_POLLS) {
        setStalled(true);
        return;
      }

      try {
        const response = await fetch(`/api/audits/${auditId}/status`, { cache: 'no-store' });
        if (!response.ok) throw new Error('status request failed');
        const data = (await response.json()) as StatusResponse;

        if (cancelled) return;

        setProgress(data.progress);
        setStatus(data.status);
        if (data.message) setMessage(data.message);

        if (data.finished) {
          router.refresh();
          return;
        }
      } catch {
        // Transient network problems should not break the page; keep polling.
      }

      if (!cancelled) {
        window.setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    const timer = window.setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [auditId, router]);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <Loader2 className="size-5 animate-spin text-violet-500" aria-hidden="true" />
        <h2 className="text-base font-semibold">
          {status === 'QUEUED' ? 'Waiting in the queue' : 'Audit in progress'}
        </h2>
        <span className="ml-auto text-sm font-semibold tabular-nums">{progress}%</span>
      </div>

      <Progress value={progress} label="Audit progress" className="mt-4" />

      <p className="mt-3 text-sm text-[var(--muted-foreground)]" aria-live="polite">
        {message}
      </p>

      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        Crawling up to {pageLimit} pages. Most audits complete in one to four minutes.
      </p>

      {stalled ? (
        <p className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-sm">
          This audit is taking longer than expected. It is still queued and will be processed — you
          can safely leave this page and check back later. If it has not completed within an hour,
          contact support quoting audit ID <code className="font-mono">{auditId}</code>.
        </p>
      ) : null}
    </Card>
  );
}
