import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(11,16,32,0.04)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 p-5 sm:p-6', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold leading-tight', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-[var(--muted-foreground)]', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-3 border-t border-[var(--border)] p-5 sm:p-6', className)}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted-foreground)]',
        accent: 'border-violet-300/50 bg-violet-500/10 text-violet-700 dark:text-violet-300',
        success: 'border-emerald-300/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        warning: 'border-amber-300/50 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        danger: 'border-red-300/50 bg-red-500/10 text-red-700 dark:text-red-300',
        info: 'border-cyan-300/50 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
        demo: 'border-amber-400/60 bg-amber-400/15 text-amber-800 dark:text-amber-200 font-semibold',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                               */
/* -------------------------------------------------------------------------- */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] transition-colors',
        'placeholder:text-[var(--muted-foreground)] placeholder:opacity-70',
        'focus-visible:border-[var(--ring)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'aria-[invalid=true]:border-red-500',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] transition-colors',
      'placeholder:text-[var(--muted-foreground)] placeholder:opacity-70',
      'focus-visible:border-[var(--ring)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
      'disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-red-500',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-10 w-full appearance-none rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 pr-9 text-sm text-[var(--foreground)] transition-colors',
      "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235a6480' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:16px] bg-[position:right_0.75rem_center] bg-no-repeat",
      'focus-visible:border-[var(--ring)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
      'disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  />
));
Select.displayName = 'Select';

export function Label({
  className,
  required,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn('block text-sm font-medium text-[var(--foreground)]', className)} {...props}>
      {children}
      {required ? (
        <span className="ml-0.5 text-red-500" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}

export function FieldHint({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-xs text-[var(--muted-foreground)]">
      {children}
    </p>
  );
}

export function Checkbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'mt-0.5 size-4 shrink-0 cursor-pointer rounded border-[var(--border-strong)] text-violet-600 accent-violet-600',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                    */
/* -------------------------------------------------------------------------- */

const alertVariants = cva('rounded-lg border p-4 text-sm', {
  variants: {
    tone: {
      info: 'border-cyan-500/30 bg-cyan-500/8 text-[var(--foreground)]',
      success: 'border-emerald-500/30 bg-emerald-500/8 text-[var(--foreground)]',
      warning: 'border-amber-500/35 bg-amber-500/10 text-[var(--foreground)]',
      danger: 'border-red-500/35 bg-red-500/8 text-[var(--foreground)]',
      neutral: 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)]',
    },
  },
  defaultVariants: { tone: 'info' },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

export function Alert({ className, tone, title, children, ...props }: AlertProps) {
  return (
    <div className={cn(alertVariants({ tone }), className)} role="status" {...props}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <div className="text-[var(--muted-foreground)]">{children}</div>
    </div>
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rk-skeleton rounded-md', className)} aria-hidden="true" {...props} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-300">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-[var(--muted-foreground)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout helpers                                                              */
/* -------------------------------------------------------------------------- */

export function Separator({ className, ...props }: React.HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn('border-0 border-t border-[var(--border)]', className)} {...props} />;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'max-w-3xl',
        align === 'center' ? 'mx-auto text-center' : 'text-left',
        className,
      )}
    >
      {eyebrow ? (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-2xl font-semibold sm:text-3xl lg:text-[2rem]">{title}</h2>
      {description ? (
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--muted-foreground)] sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function Progress({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]', className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-[width] duration-500 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
