import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, LifeBuoy, Mail, Wrench } from 'lucide-react';

import { Card, SectionHeading } from '@/components/ui/primitives';
import { ContactForm } from '@/app/(marketing)/contact/contact-form';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact the RankInAI team about sales, support, billing, agency pricing or a question about an audit result.',
  alternates: { canonical: '/contact' },
};

export default async function ContactPage() {
  const settings = await getSettings();

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="rk-hero-wash absolute inset-0" aria-hidden="true" />
        <div className="rk-container relative py-16 lg:py-20">
          <SectionHeading
            eyebrow="Contact"
            title="Talk to us"
            description="Sales questions, support, billing, agency pricing, or a finding you think the audit engine got wrong — this form reaches a real inbox."
          />
        </div>
      </section>

      <section className="rk-container py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
          <Card className="bg-ink-900/60 border-white/12 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white">Send a message</h2>
            <p className="mt-2 text-sm text-slate-400">
              Required fields are marked with an asterisk.
            </p>
            <div className="mt-7">
              <ContactForm />
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="bg-ink-900/60 border-white/12 p-6">
              <span className="flex size-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                <Mail className="size-4.5" aria-hidden="true" />
              </span>
              <h3 className="mt-3.5 text-sm font-semibold text-white">Email us directly</h3>
              <p className="mt-1.5 text-sm text-slate-400">
                <a
                  href={`mailto:${settings.supportEmail}`}
                  className="text-cyan-300 underline underline-offset-4 hover:text-cyan-200"
                >
                  {settings.supportEmail}
                </a>
              </p>
            </Card>

            <Card className="bg-ink-900/60 border-white/12 p-6">
              <span className="flex size-9 items-center justify-center rounded-lg bg-cyan-500/12 text-cyan-300">
                <Clock className="size-4.5" aria-hidden="true" />
              </span>
              <h3 className="mt-3.5 text-sm font-semibold text-white">Response times</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                Most enquiries are answered within one business day, Monday to Friday. Growth and
                Agency plans are handled first.
              </p>
            </Card>

            <Card className="bg-ink-900/60 border-white/12 p-6">
              <span className="flex size-9 items-center justify-center rounded-lg bg-amber-500/12 text-amber-300">
                <Wrench className="size-4.5" aria-hidden="true" />
              </span>
              <h3 className="mt-3.5 text-sm font-semibold text-white">Reporting a wrong finding</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                Include the audit URL, the check ID shown under the finding title, and what you
                expected. Audit-engine corrections are prioritized above everything else.
              </p>
            </Card>

            <Card className="bg-ink-900/60 border-white/12 p-6">
              <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-300">
                <LifeBuoy className="size-4.5" aria-hidden="true" />
              </span>
              <h3 className="mt-3.5 text-sm font-semibold text-white">Before you write</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                Many questions are answered on the{' '}
                <Link href="/pricing#faq" className="text-cyan-300 underline underline-offset-4">
                  pricing FAQ
                </Link>{' '}
                and in the{' '}
                <Link
                  href="/how-it-works#methodology"
                  className="text-cyan-300 underline underline-offset-4"
                >
                  scoring methodology
                </Link>
                .
              </p>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
