'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { Alert, FieldError, FieldHint, Input, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { uploadBlogImageAction } from '@/app/(admin)/admin/blog/actions';
import { IMAGE_ACCEPT, MAX_IMAGE_BYTES, formatImageBytes } from '@/lib/blog/images';
import { firstError, type ActionResult } from '@/lib/validation';

function Upload() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} loadingText="Uploading…">
      Upload image
    </Button>
  );
}

/**
 * Copy to clipboard with a visible fallback.
 *
 * `navigator.clipboard` needs a secure context and a permission that can be
 * refused, so the markup is always present in a readonly field the author can
 * select by hand. The button is the convenience, not the only way out.
 */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        aria-label={label}
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        className="h-9 w-full min-w-0 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-muted)] px-2.5 font-mono text-xs text-[var(--foreground)]"
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="shrink-0"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            // Clipboard refused — the field above is still selectable.
            setCopied(false);
          }
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

export function ImageUploadForm() {
  const [state, action] = useActionState<ActionResult<{ markup: string }> | null, FormData>(
    uploadBlogImageAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const markup = state?.ok ? state.data?.markup : undefined;

  // Clear the file and description after a success so the next upload starts
  // clean; a failure keeps what was typed.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      {state?.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'} role="status">
          {state.message}
        </Alert>
      ) : null}

      {markup ? (
        <div>
          <Label htmlFor="markup-result">Paste this into the post body</Label>
          <CopyField value={markup} label="Image markup" />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="file" required>
            Image file
          </Label>
          <input
            id="file"
            name="file"
            type="file"
            accept={IMAGE_ACCEPT}
            required
            className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-muted)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--foreground)]"
          />
          <FieldHint>
            PNG, JPEG, WebP or GIF, up to {formatImageBytes(MAX_IMAGE_BYTES)}. SVG is not accepted —
            an SVG can carry script.
          </FieldHint>
        </div>

        <div>
          <Label htmlFor="altText" required>
            Describe the image
          </Label>
          <Input id="altText" name="altText" maxLength={200} required />
          <FieldHint>
            Read aloud by screen readers and shown if the image fails to load. Describe what it
            shows, not that it is an image.
          </FieldHint>
          <FieldError message={firstError(state?.fieldErrors, 'altText')} />
        </div>
      </div>

      <Upload />
    </form>
  );
}
