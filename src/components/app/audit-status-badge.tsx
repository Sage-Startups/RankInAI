import { type AuditStatus } from '@prisma/client';

import { Badge } from '@/components/ui/primitives';

const CONFIG: Record<
  AuditStatus,
  { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' | 'warning' }
> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  QUEUED: { label: 'Queued', tone: 'info' },
  RUNNING: { label: 'Running', tone: 'info' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  CANCELED: { label: 'Canceled', tone: 'warning' },
};

export function AuditStatusBadge({ status }: { status: AuditStatus }) {
  const config = CONFIG[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
