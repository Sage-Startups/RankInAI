import { AlertTriangle } from 'lucide-react';

export function MaintenanceBanner({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="border-b border-amber-500/40 bg-amber-500/12 px-4 py-2.5 text-center text-sm text-amber-900 dark:text-amber-200"
    >
      <span className="inline-flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        {text}
      </span>
    </div>
  );
}
