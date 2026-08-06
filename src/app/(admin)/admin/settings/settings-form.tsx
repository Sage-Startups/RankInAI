'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Alert, Checkbox, FieldError, FieldHint, Input, Label, Textarea } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { updateSettingsAction } from '@/app/(admin)/admin/actions';
import { SETTINGS_DESCRIPTIONS, type SystemSettings } from '@/lib/settings';
import { firstError, type ActionResult } from '@/lib/validation';

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" loading={pending} loadingText="Saving…">
      Save settings
    </Button>
  );
}

const TOGGLES: Array<keyof SystemSettings> = [
  'signupsEnabled',
  'demoModeEnabled',
  'freePreviewEnabled',
  'llmEnhancementEnabled',
  'searchObservationsEnabled',
  'legalTemplateWarningEnabled',
  'maintenanceBannerEnabled',
];

const TOGGLE_LABELS: Record<string, string> = {
  signupsEnabled: 'Allow new registrations',
  demoModeEnabled: 'Show the instant sample demo',
  freePreviewEnabled: 'Allow the anonymous homepage preview',
  llmEnhancementEnabled: 'Allow LLM narrative enhancement',
  searchObservationsEnabled: 'Allow public-web search observations',
  legalTemplateWarningEnabled: 'Show the legal template warning',
  maintenanceBannerEnabled: 'Show the maintenance banner',
};

export function SystemSettingsForm({ settings }: { settings: SystemSettings }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    updateSettingsAction,
    null,
  );

  return (
    <form action={action} className="space-y-6" noValidate>
      {state?.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'} role="status">
          {state.message}
        </Alert>
      ) : null}

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold">Identity</legend>

        <div>
          <Label htmlFor="applicationName" required>
            Application name
          </Label>
          <Input
            id="applicationName"
            name="applicationName"
            defaultValue={settings.applicationName}
            required
            maxLength={80}
            className="mt-2"
          />
          <FieldHint>{SETTINGS_DESCRIPTIONS.applicationName}</FieldHint>
          <FieldError message={firstError(state?.fieldErrors, 'applicationName')} />
        </div>

        <div>
          <Label htmlFor="supportEmail" required>
            Support email
          </Label>
          <Input
            id="supportEmail"
            name="supportEmail"
            type="email"
            defaultValue={settings.supportEmail}
            required
            maxLength={200}
            className="mt-2"
          />
          <FieldHint>{SETTINGS_DESCRIPTIONS.supportEmail}</FieldHint>
          <FieldError message={firstError(state?.fieldErrors, 'supportEmail')} />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Feature toggles</legend>
        <div className="space-y-4">
          {TOGGLES.map((key) => (
            <div key={String(key)} className="flex gap-3">
              <Checkbox
                id={String(key)}
                name={String(key)}
                defaultChecked={Boolean(settings[key])}
              />
              <div>
                <Label htmlFor={String(key)} className="font-medium">
                  {TOGGLE_LABELS[String(key)]}
                </Label>
                <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
                  {SETTINGS_DESCRIPTIONS[key]}
                </p>
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="mb-3 text-sm font-semibold">Content and limits</legend>

        <div>
          <Label htmlFor="maintenanceBannerText">Maintenance banner text</Label>
          <Textarea
            id="maintenanceBannerText"
            name="maintenanceBannerText"
            rows={2}
            defaultValue={settings.maintenanceBannerText}
            maxLength={300}
            className="mt-2"
          />
          <FieldHint>{SETTINGS_DESCRIPTIONS.maintenanceBannerText}</FieldHint>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="maxCrawlPagesHardLimit" required>
              Maximum crawl pages (hard limit)
            </Label>
            <Input
              id="maxCrawlPagesHardLimit"
              name="maxCrawlPagesHardLimit"
              type="number"
              min={1}
              max={50}
              defaultValue={settings.maxCrawlPagesHardLimit}
              required
              className="mt-2"
            />
            <FieldHint>{SETTINGS_DESCRIPTIONS.maxCrawlPagesHardLimit}</FieldHint>
            <FieldError message={firstError(state?.fieldErrors, 'maxCrawlPagesHardLimit')} />
          </div>

          <div>
            <Label htmlFor="defaultReportFooter">Default report footer</Label>
            <Input
              id="defaultReportFooter"
              name="defaultReportFooter"
              defaultValue={settings.defaultReportFooter}
              maxLength={200}
              className="mt-2"
            />
            <FieldHint>{SETTINGS_DESCRIPTIONS.defaultReportFooter}</FieldHint>
          </div>
        </div>
      </fieldset>

      <Alert tone="info" title="Secrets are not managed here">
        API keys, database credentials and webhook secrets live only in environment variables. They
        are never stored in the database and are never editable from this interface.
      </Alert>

      <Save />
    </form>
  );
}
