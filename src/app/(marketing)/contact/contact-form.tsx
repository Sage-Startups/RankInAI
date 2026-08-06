'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';

import {
  Alert,
  FieldError,
  FieldHint,
  Input,
  Label,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { CONTACT_SUBJECTS, firstError, type ActionResult } from '@/lib/validation';
import { submitContactForm } from '@/app/(marketing)/contact/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" loading={pending} loadingText="Sending…" className="w-full sm:w-auto">
      Send message
    </Button>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    submitContactForm,
    null,
  );

  if (state?.ok) {
    return (
      <Alert tone="success" className="border-emerald-500/35 bg-emerald-500/10">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden="true" />
          <div>
            <p className="font-semibold text-white">Message sent</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">{state.message}</p>
          </div>
        </div>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state?.message && !state.ok ? (
        <Alert tone="danger" role="alert">
          {state.message}
        </Alert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="contact-name" required className="text-slate-200">
            Name
          </Label>
          <Input
            id="contact-name"
            name="name"
            autoComplete="name"
            required
            maxLength={120}
            aria-invalid={firstError(state?.fieldErrors, 'name') ? true : undefined}
            aria-describedby={firstError(state?.fieldErrors, 'name') ? 'contact-name-error' : undefined}
            className="mt-2 border-white/20 bg-white/[0.06] text-white"
          />
          <FieldError id="contact-name-error" message={firstError(state?.fieldErrors, 'name')} />
        </div>

        <div>
          <Label htmlFor="contact-email" required className="text-slate-200">
            Email
          </Label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={200}
            aria-invalid={firstError(state?.fieldErrors, 'email') ? true : undefined}
            aria-describedby={firstError(state?.fieldErrors, 'email') ? 'contact-email-error' : undefined}
            className="mt-2 border-white/20 bg-white/[0.06] text-white"
          />
          <FieldError id="contact-email-error" message={firstError(state?.fieldErrors, 'email')} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="contact-company" className="text-slate-200">
            Company
          </Label>
          <Input
            id="contact-company"
            name="company"
            autoComplete="organization"
            maxLength={160}
            className="mt-2 border-white/20 bg-white/[0.06] text-white"
          />
        </div>

        <div>
          <Label htmlFor="contact-subject" required className="text-slate-200">
            Subject
          </Label>
          <Select
            id="contact-subject"
            name="subject"
            required
            defaultValue={CONTACT_SUBJECTS[0]}
            className="mt-2 border-white/20 bg-white/[0.06] text-white"
          >
            {CONTACT_SUBJECTS.map((subject) => (
              <option key={subject} value={subject} className="bg-ink-900">
                {subject}
              </option>
            ))}
          </Select>
          <FieldError id="contact-subject-error" message={firstError(state?.fieldErrors, 'subject')} />
        </div>
      </div>

      <div>
        <Label htmlFor="contact-message" required className="text-slate-200">
          Message
        </Label>
        <Textarea
          id="contact-message"
          name="message"
          rows={6}
          required
          minLength={20}
          maxLength={4000}
          aria-invalid={firstError(state?.fieldErrors, 'message') ? true : undefined}
          aria-describedby="contact-message-hint"
          className="mt-2 border-white/20 bg-white/[0.06] text-white"
        />
        <FieldHint id="contact-message-hint">
          Include the website URL if you are asking about a specific audit result.
        </FieldHint>
        <FieldError message={firstError(state?.fieldErrors, 'message')} />
      </div>

      {/* Honeypot — hidden from real users. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website (leave blank)</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <SubmitButton />

      <p className="text-xs leading-relaxed text-slate-400">
        We use your details only to reply to this enquiry. See the Privacy Policy for how contact
        submissions are stored and retained.
      </p>
    </form>
  );
}
