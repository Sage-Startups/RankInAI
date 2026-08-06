import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Alert, Card } from '@/components/ui/primitives';
import { LEGAL_DOCUMENTS, LEGAL_SLUGS, LEGAL_TEMPLATE_NOTICE } from '@/lib/legal-content';
import { getSettings } from '@/lib/settings';

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const document = LEGAL_DOCUMENTS[slug];
  if (!document) return { title: 'Not found' };
  return {
    title: document.title,
    description: document.description,
    alternates: { canonical: `/legal/${slug}` },
  };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const document = LEGAL_DOCUMENTS[slug];
  if (!document) notFound();

  const settings = await getSettings();

  return (
    <>
      <section className="border-b border-white/10">
        <div className="rk-container py-14">
          <nav aria-label="Breadcrumb" className="mb-5 text-sm text-slate-400">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="hover:text-slate-300">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-slate-300">{document.title}</li>
            </ol>
          </nav>
          <h1 className="text-3xl font-bold text-white">{document.title}</h1>
          <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-slate-400">
            {document.intro}
          </p>
          <p className="mt-4 text-sm text-slate-400">Last updated: {document.lastUpdated}</p>
        </div>
      </section>

      <div className="bg-[var(--background)]">
        <div className="rk-container py-12 lg:py-16">
          {settings.legalTemplateWarningEnabled ? (
            <Alert tone="warning" title="Template document" className="mx-auto mb-8 max-w-3xl">
              {LEGAL_TEMPLATE_NOTICE}
            </Alert>
          ) : null}

          <Card className="mx-auto max-w-3xl p-6 sm:p-9">
            <div className="rk-prose max-w-none">
              {document.sections.map((section) => (
                <section key={section.heading}>
                  <h2>{section.heading}</h2>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.bullets ? (
                    <ul>
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
          </Card>

          <div className="mx-auto mt-8 max-w-3xl">
            <Card className="p-5">
              <h2 className="text-sm font-semibold">Other legal documents</h2>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {LEGAL_SLUGS.filter((s) => s !== slug).map((other) => (
                  <li key={other}>
                    <Link
                      href={`/legal/${other}`}
                      className="text-[var(--accent)] underline underline-offset-4"
                    >
                      {LEGAL_DOCUMENTS[other]?.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
