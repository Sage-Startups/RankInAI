import { z } from 'zod';

import { passwordField } from '@/lib/auth/password';
import { validateAuditUrl } from '@/lib/audit/url-safety';

/**
 * Shared Zod schemas. Every server action and route handler validates its
 * input through one of these — no exceptions.
 */

const trimmed = (max: number) => z.string().trim().max(max);

/** A website URL that passes the synchronous SSRF checks. */
export const auditUrlField = z
  .string()
  .trim()
  .min(1, 'Enter a website address')
  .max(2000, 'That address is too long')
  .superRefine((value, ctx) => {
    const result = validateAuditUrl(value);
    if (!result.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
    }
  })
  .transform((value) => {
    const result = validateAuditUrl(value);
    return result.ok ? result.normalized : value;
  });

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export const signUpSchema = z
  .object({
    name: trimmed(120).min(2, 'Enter your name'),
    email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
    password: passwordField,
    confirmPassword: z.string(),
    acceptTerms: z
      .union([z.boolean(), z.literal('on'), z.literal('true')])
      .transform((v) => v === true || v === 'on' || v === 'true')
      .refine((v) => v, 'You must accept the Terms of Service and Privacy Policy'),
    plan: z.string().trim().max(40).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
  callbackUrl: z.string().trim().max(500).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, 'This reset link is not valid'),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ---------------------------------------------------------------------------
// Onboarding & profile
// ---------------------------------------------------------------------------

export const USE_CASES = [
  'Improve my own website',
  'Audit client websites',
  'Win new agency business',
  'Benchmark against competitors',
  'Report to leadership',
  'Something else',
] as const;

export const BUSINESS_TYPES = [
  'Local service business',
  'Professional services',
  'E-commerce',
  'SaaS or software',
  'Marketing agency',
  'Consultant or freelancer',
  'Healthcare',
  'Real estate',
  'Manufacturing',
  'Nonprofit',
  'Other',
] as const;

export const onboardingSchema = z.object({
  fullName: trimmed(120).min(2, 'Enter your full name'),
  companyName: trimmed(160).optional().or(z.literal('')),
  companyWebsite: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(''))
    .superRefine((value, ctx) => {
      if (!value) return;
      const result = validateAuditUrl(value);
      if (!result.ok) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
      }
    }),
  primaryUseCase: z.enum(USE_CASES).optional(),
  businessType: z.enum(BUSINESS_TYPES).optional(),
  auditingOwnWebsite: z.enum(['own', 'client', 'both']).optional(),
});

export const profileSchema = z.object({
  name: trimmed(120).min(2, 'Enter your name'),
  companyName: trimmed(160).optional().or(z.literal('')),
  companyWebsite: trimmed(500).optional().or(z.literal('')),
  businessType: z.string().trim().max(60).optional().or(z.literal('')),
});

export const brandingSchema = z.object({
  brandingCompanyName: trimmed(120).optional().or(z.literal('')),
  brandingLogoUrl: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .or(z.literal(''))
    .superRefine((value, ctx) => {
      if (!value) return;
      if (!/^https:\/\//i.test(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Logo URL must start with https://' });
      }
    }),
  brandingAccentColor: z
    .string()
    .trim()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Enter a hex color such as #6D5EF0')
    .optional()
    .or(z.literal('')),
});

export const emailPreferencesSchema = z.object({
  emailProductUpdates: z.coerce.boolean(),
  emailAuditComplete: z.coerce.boolean(),
  emailMarketing: z.coerce.boolean(),
});

// ---------------------------------------------------------------------------
// Audits
// ---------------------------------------------------------------------------

export const INDUSTRIES = [
  'Home services',
  'Construction and trades',
  'Professional services',
  'Legal',
  'Accounting and finance',
  'Healthcare',
  'Dental',
  'Real estate',
  'E-commerce and retail',
  'SaaS and technology',
  'Marketing and advertising',
  'Education',
  'Hospitality and travel',
  'Automotive',
  'Manufacturing',
  'Nonprofit',
  'Other',
] as const;

export const createAuditSchema = z.object({
  websiteUrl: auditUrlField,
  businessName: trimmed(160).min(2, 'Enter the business name'),
  industry: z.enum(INDUSTRIES).optional(),
  targetCountry: trimmed(80).default('United States'),
  targetAudience: trimmed(300).optional().or(z.literal('')),
  primaryServices: trimmed(500).optional().or(z.literal('')),
  businessLocation: trimmed(200).optional().or(z.literal('')),
  competitorUrls: z.array(z.string().trim().max(500)).max(5).default([]),
  brandingName: trimmed(120).optional().or(z.literal('')),
  brandingLogoUrl: trimmed(1000).optional().or(z.literal('')),
  whiteLabel: z.coerce.boolean().default(false),
  consentConfirmed: z
    .union([z.boolean(), z.literal('on'), z.literal('true')])
    .transform((v) => v === true || v === 'on' || v === 'true')
    .refine((v) => v, 'You must confirm you are authorized to audit this website'),
});

export type CreateAuditInput = z.infer<typeof createAuditSchema>;

// ---------------------------------------------------------------------------
// Public site
// ---------------------------------------------------------------------------

export const CONTACT_SUBJECTS = [
  'Sales question',
  'Technical support',
  'Billing',
  'Agency or volume pricing',
  'Partnership',
  'Something else',
] as const;

export const contactSchema = z.object({
  name: trimmed(120).min(2, 'Enter your name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
  company: trimmed(160).optional().or(z.literal('')),
  subject: z.enum(CONTACT_SUBJECTS),
  message: trimmed(4000).min(20, 'Please include at least 20 characters so we can help'),
  // Honeypot: real users never see or fill this field.
  website: z.string().max(200).optional(),
});

export const freePreviewSchema = z.object({
  url: auditUrlField,
  // Honeypot
  company: z.string().max(200).optional(),
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const adminCreditSchema = z.object({
  userId: z.string().min(1),
  amount: z.coerce
    .number()
    .int()
    .min(-100)
    .max(100)
    .refine((n) => n !== 0, 'Enter a non-zero amount'),
  reason: trimmed(300).min(3, 'A reason is required for the audit trail'),
});

export const adminSuspendSchema = z.object({
  userId: z.string().min(1),
  suspend: z.coerce.boolean(),
  reason: trimmed(300).optional().or(z.literal('')),
});

export const adminRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['USER', 'SUPER_ADMIN']),
  confirm: z.literal('CONFIRM', {
    errorMap: () => ({ message: 'Type CONFIRM to change a user role' }),
  }),
});

export const adminSettingsSchema = z.object({
  applicationName: trimmed(80).min(1),
  supportEmail: z.string().trim().email().max(200),
  demoModeEnabled: z.coerce.boolean(),
  freePreviewEnabled: z.coerce.boolean(),
  maxCrawlPagesHardLimit: z.coerce.number().int().min(1).max(50),
  maintenanceBannerEnabled: z.coerce.boolean(),
  maintenanceBannerText: trimmed(300).optional().or(z.literal('')),
  llmEnhancementEnabled: z.coerce.boolean(),
  searchObservationsEnabled: z.coerce.boolean(),
  legalTemplateWarningEnabled: z.coerce.boolean(),
  defaultReportFooter: trimmed(200).optional().or(z.literal('')),
  signupsEnabled: z.coerce.boolean(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read a FormData field as `string | undefined`.
 *
 * `FormData.get` returns `null` for an absent field, and Zod's `.optional()`
 * rejects `null` — so passing the raw value straight into a schema makes every
 * optional field mandatory in practice. Always read form fields through this.
 */
export function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (value == null) return undefined;
  if (typeof value !== 'string') return undefined;
  return value;
}

/** Same as `formValue`, but collapses an empty string to undefined. */
export function optionalFormValue(formData: FormData, key: string): string | undefined {
  const value = formValue(formData, key);
  return value && value.trim().length > 0 ? value : undefined;
}

/** Read a checkbox as a boolean. */
export function formChecked(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on' || formData.get(key) === 'true';
}

export type FieldErrors = Record<string, string[]>;

export interface ActionResult<T = undefined> {
  ok: boolean;
  message?: string;
  fieldErrors?: FieldErrors;
  data?: T;
}

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const output: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    (output[key] ??= []).push(issue.message);
  }
  return output;
}

export function firstError(errors: FieldErrors | undefined, field: string): string | undefined {
  return errors?.[field]?.[0];
}
