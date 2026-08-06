'use server';

import { headers } from 'next/headers';

import { prisma } from '@/lib/db';
import { clientIp, clientIpHash } from '@/lib/crypto';
import { RATE_LIMITS, consumeRateLimit, rateLimitMessage } from '@/lib/rate-limit';
import { trackEvent } from '@/lib/analytics';
import {
  contactSchema,
  formValue,
  optionalFormValue,
  zodFieldErrors,
  type ActionResult,
} from '@/lib/validation';

/**
 * Contact form submission.
 *
 * Protections: honeypot field, per-IP rate limit, strict validation, and only a
 * hashed IP is persisted.
 */
export async function submitContactForm(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = contactSchema.safeParse({
    name: formValue(formData, 'name'),
    email: formValue(formData, 'email'),
    company: optionalFormValue(formData, 'company') ?? '',
    subject: formValue(formData, 'subject'),
    message: formValue(formData, 'message'),
    website: formValue(formData, 'website'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please correct the highlighted fields.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  // Honeypot: report success without storing anything so bots get no signal.
  if (parsed.data.website && parsed.data.website.trim().length > 0) {
    return { ok: true, message: 'Thanks — your message has been received.' };
  }

  const headerList = await headers();
  const limit = await consumeRateLimit(RATE_LIMITS.contactForm, clientIp(headerList));
  if (!limit.allowed) {
    return { ok: false, message: rateLimitMessage(limit) };
  }

  await prisma.contactSubmission.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      company: parsed.data.company || null,
      subject: parsed.data.subject,
      message: parsed.data.message,
      ipHash: clientIpHash(headerList),
      userAgent: headerList.get('user-agent')?.slice(0, 300) ?? null,
      isDemo: false,
    },
  });

  await trackEvent({ name: 'contact_submitted', properties: { source: 'contact_page' } });

  return {
    ok: true,
    message:
      'Thanks — your message has been received. We reply to most enquiries within one business day.',
  };
}
