import { Badge, Card } from '@/components/ui/primitives';

/**
 * A headline figure on a demonstration page.
 *
 * The "Demo" badge is positioned absolutely so it sits in the same place on
 * every card regardless of how long the label runs. The label therefore
 * reserves room for it — without that padding a long label such as
 * "Demonstration gross revenue" wraps underneath the badge and the two overlap.
 */
export function DemoMetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="relative overflow-hidden p-5">
      <span className="absolute top-3 right-3">
        <Badge tone="demo">Demo</Badge>
      </span>
      <div className="flex items-start gap-2.5 pr-16">
        <Icon className="mt-0.5 size-4 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
        <p className="text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
          {label}
        </p>
      </div>
      <p className="mt-2.5 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{detail}</p>
    </Card>
  );
}
