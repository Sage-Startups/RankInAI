'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';

import {
  Alert,
  Card,
  Checkbox,
  FieldError,
  FieldHint,
  Input,
  Label,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { createAuditAction } from '@/app/(app)/dashboard/audits/actions';
import { INDUSTRIES, firstError, type ActionResult } from '@/lib/validation';

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      loading={pending}
      loadingText="Queueing your audit…"
      disabled={disabled}
    >
      Start audit
    </Button>
  );
}

export function NewAuditForm({
  competitorLimit,
  pageLimit,
  whiteLabelAllowed,
  canCreate,
  defaultBranding,
}: {
  competitorLimit: number;
  pageLimit: number;
  whiteLabelAllowed: boolean;
  canCreate: boolean;
  defaultBranding: { name: string | null; logoUrl: string | null };
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createAuditAction,
    null,
  );
  const [competitors, setCompetitors] = useState<string[]>(competitorLimit > 0 ? [''] : []);
  const [whiteLabel, setWhiteLabel] = useState(false);

  const updateCompetitor = (index: number, value: string) => {
    setCompetitors((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state?.message && !state.ok ? (
        <Alert tone="danger" role="alert">
          {state.message}
        </Alert>
      ) : null}

      <Card className="p-6">
        <h2 className="text-base font-semibold">Website</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          We&apos;ll crawl up to {pageLimit} public pages from this site.
        </p>

        <div className="mt-5 space-y-5">
          <div>
            <Label htmlFor="websiteUrl" required>
              Website URL
            </Label>
            <Input
              id="websiteUrl"
              name="websiteUrl"
              type="text"
              inputMode="url"
              placeholder="https://yourcompany.com"
              required
              autoFocus
              className="mt-2"
              aria-invalid={firstError(state?.fieldErrors, 'websiteUrl') ? true : undefined}
              aria-describedby="websiteUrl-hint"
            />
            <FieldHint id="websiteUrl-hint">
              Public http or https addresses only. Private and internal addresses are rejected.
            </FieldHint>
            <FieldError message={firstError(state?.fieldErrors, 'websiteUrl')} />
          </div>

          <div>
            <Label htmlFor="businessName" required>
              Business name
            </Label>
            <Input
              id="businessName"
              name="businessName"
              required
              maxLength={160}
              className="mt-2"
              aria-describedby="businessName-hint"
            />
            <FieldHint id="businessName-hint">
              Spell it exactly as it appears on the site — we check whether the name is used
              consistently.
            </FieldHint>
            <FieldError message={firstError(state?.fieldErrors, 'businessName')} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold">Business context</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Optional, but it makes several checks far more useful — particularly terminology alignment
          and geographic clarity.
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="industry">Industry</Label>
            <Select id="industry" name="industry" className="mt-2" defaultValue="">
              <option value="">Select an industry</option>
              {INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="targetCountry">Target country</Label>
            <Input
              id="targetCountry"
              name="targetCountry"
              defaultValue="United States"
              maxLength={80}
              className="mt-2"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="targetAudience">Target audience</Label>
            <Input
              id="targetAudience"
              name="targetAudience"
              placeholder="Homeowners and property managers in the Denver metro area"
              maxLength={300}
              className="mt-2"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="primaryServices">Primary services or products</Label>
            <Textarea
              id="primaryServices"
              name="primaryServices"
              rows={3}
              placeholder="Roof replacement, storm damage repair, roof inspection, gutter installation"
              maxLength={500}
              className="mt-2"
              aria-describedby="primaryServices-hint"
            />
            <FieldHint id="primaryServices-hint">
              Comma-separated. We check whether these terms actually appear on the site.
            </FieldHint>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="businessLocation">Main business location</Label>
            <Input
              id="businessLocation"
              name="businessLocation"
              placeholder="Denver, Colorado"
              maxLength={200}
              className="mt-2"
            />
          </div>
        </div>
      </Card>

      {competitorLimit > 0 ? (
        <Card className="p-6">
          <h2 className="text-base font-semibold">Competitors</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Your plan allows up to {competitorLimit}{' '}
            {competitorLimit === 1 ? 'competitor' : 'competitors'}. We fetch one public homepage
            from each and compare the same signals. Leave blank to skip — Competitive Visibility
            will be marked unavailable and its weight redistributed.
          </p>

          <div className="mt-5 space-y-3">
            {competitors.map((value, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor={`competitor-${index}`} className="sr-only">
                    Competitor {index + 1} URL
                  </Label>
                  <Input
                    id={`competitor-${index}`}
                    name="competitorUrls"
                    type="text"
                    inputMode="url"
                    placeholder="https://competitor.com"
                    value={value}
                    onChange={(e) => updateCompetitor(index, e.target.value)}
                    maxLength={500}
                  />
                </div>
                {competitors.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setCompetitors((prev) => prev.filter((_, i) => i !== index))}
                    aria-label={`Remove competitor ${index + 1}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>

          <FieldError message={firstError(state?.fieldErrors, 'competitorUrls')} />

          {competitors.length < competitorLimit ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => setCompetitors((prev) => [...prev, ''])}
            >
              <Plus aria-hidden="true" />
              Add another competitor
            </Button>
          ) : null}
        </Card>
      ) : null}

      {whiteLabelAllowed ? (
        <Card className="p-6">
          <h2 className="text-base font-semibold">Report branding</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Agency plans can replace the RankInAI cover branding with your own. A small
            &ldquo;Powered by RankInAI&rdquo; line remains in the report footer.
          </p>

          <div className="mt-5 flex gap-3">
            <Checkbox
              id="whiteLabel"
              name="whiteLabel"
              checked={whiteLabel}
              onChange={(e) => setWhiteLabel(e.target.checked)}
            />
            <Label htmlFor="whiteLabel" className="text-sm font-normal">
              White-label this report
            </Label>
          </div>

          {whiteLabel ? (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="brandingName">Company name on the cover</Label>
                <Input
                  id="brandingName"
                  name="brandingName"
                  defaultValue={defaultBranding.name ?? ''}
                  maxLength={120}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="brandingLogoUrl">Logo URL</Label>
                <Input
                  id="brandingLogoUrl"
                  name="brandingLogoUrl"
                  type="url"
                  placeholder="https://youragency.com/logo.png"
                  defaultValue={defaultBranding.logoUrl ?? ''}
                  maxLength={1000}
                  className="mt-2"
                  aria-describedby="brandingLogoUrl-hint"
                />
                <FieldHint id="brandingLogoUrl-hint">Must be an https:// address.</FieldHint>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card className="p-6">
        <div className="flex gap-3">
          <Checkbox id="consentConfirmed" name="consentConfirmed" value="on" required />
          <Label htmlFor="consentConfirmed" className="text-sm leading-relaxed font-normal">
            I confirm I own this website, operate it, or am authorized to have it audited. RankInAI
            will request only public pages, honor robots.txt, and never submit a form or sign in.
          </Label>
        </div>
        <FieldError message={firstError(state?.fieldErrors, 'consentConfirmed')} />

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <SubmitButton disabled={!canCreate} />
          <p className="text-sm text-[var(--muted-foreground)]">
            This will use one audit from your balance.
          </p>
        </div>
      </Card>
    </form>
  );
}
