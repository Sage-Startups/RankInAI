'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  Alert,
  Checkbox,
  FieldError,
  FieldHint,
  Input,
  Label,
  Textarea,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { createBlogPostAction, updateBlogPostAction } from '@/app/(admin)/admin/blog/actions';
import { slugify } from '@/lib/blog/content';
import { firstError, type ActionResult } from '@/lib/validation';

export interface PostFormValues {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  publish: boolean;
}

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" loading={pending} loadingText="Saving…">
      {label}
    </Button>
  );
}

const BODY_HELP =
  'Supported: ## and ### headings, - or 1. lists, > quotes, **bold**, `code`, and [text](https://example.com) links. HTML is not rendered — it is shown as plain text.';

export function PostForm({ initial }: { initial: PostFormValues }) {
  const isEdit = Boolean(initial.id);
  const [state, action] = useActionState<ActionResult | null, FormData>(
    isEdit ? updateBlogPostAction : createBlogPostAction,
    null,
  );

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  // On a new post the slug tracks the title until the author edits it by hand.
  // On an existing post it never auto-changes: the URL is already published.
  const [slugTouched, setSlugTouched] = useState(isEdit);

  return (
    <form action={action} className="space-y-6" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      {state?.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'} role="status">
          {state.message}
        </Alert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="title" required>
            Title
          </Label>
          <Input
            id="title"
            name="title"
            value={title}
            maxLength={160}
            required
            onChange={(event) => {
              setTitle(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
          />
          <FieldError message={firstError(state?.fieldErrors, 'title')} />
        </div>

        <div>
          <Label htmlFor="slug" required>
            Slug
          </Label>
          <Input
            id="slug"
            name="slug"
            value={slug}
            maxLength={80}
            required
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
          />
          <FieldHint id="slug-hint">The post will live at /blog/{slug || 'your-slug'}</FieldHint>
          <FieldError message={firstError(state?.fieldErrors, 'slug')} />
        </div>
      </div>

      <div>
        <Label htmlFor="excerpt" required>
          Excerpt
        </Label>
        <Textarea id="excerpt" name="excerpt" rows={3} defaultValue={initial.excerpt} required />
        <FieldHint>Shown on the blog index and used as the meta description fallback.</FieldHint>
        <FieldError message={firstError(state?.fieldErrors, 'excerpt')} />
      </div>

      <div>
        <Label htmlFor="body" required>
          Body
        </Label>
        <Textarea
          id="body"
          name="body"
          rows={22}
          defaultValue={initial.body}
          required
          className="font-mono text-[0.8125rem]"
        />
        <FieldHint>{BODY_HELP}</FieldHint>
        <FieldError message={firstError(state?.fieldErrors, 'body')} />
      </div>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold">Search appearance (optional)</legend>
        <div>
          <Label htmlFor="metaTitle">Meta title</Label>
          <Input id="metaTitle" name="metaTitle" maxLength={70} defaultValue={initial.metaTitle} />
          <FieldHint>Defaults to the post title.</FieldHint>
          <FieldError message={firstError(state?.fieldErrors, 'metaTitle')} />
        </div>
        <div>
          <Label htmlFor="metaDescription">Meta description</Label>
          <Input
            id="metaDescription"
            name="metaDescription"
            maxLength={180}
            defaultValue={initial.metaDescription}
          />
          <FieldHint>Defaults to the excerpt.</FieldHint>
          <FieldError message={firstError(state?.fieldErrors, 'metaDescription')} />
        </div>
      </fieldset>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <label className="flex items-start gap-3">
          <Checkbox name="publish" defaultChecked={initial.publish} className="mt-0.5" />
          <span className="text-sm">
            <span className="font-semibold">Publish this post</span>
            <span className="mt-0.5 block text-[var(--muted-foreground)]">
              Published posts are public and appear in the sitemap. Leave this off to keep the post
              as a draft — drafts are visible only to signed-in administrators.
            </span>
          </span>
        </label>
      </div>

      <Save label={isEdit ? 'Save post' : 'Create post'} />
    </form>
  );
}
