import { getEnv } from '@/lib/env';
import type { SearchObservation } from '@/lib/audit/types';

/**
 * Optional public-web search observations.
 *
 * These are *observations about the public web*, not evidence about any
 * specific AI model's behavior. Nothing here may be presented as proof that a
 * brand appears inside ChatGPT, Perplexity, Gemini or any other system.
 *
 * When no provider is configured the audit simply omits the section.
 */

export interface SearchProvider {
  name: string;
  search(
    query: string,
  ): Promise<{ results: Array<{ title: string; link: string; snippet: string }> }>;
}

class SerperProvider implements SearchProvider {
  readonly name = 'serper';

  constructor(private readonly apiKey: string) {}

  async search(query: string) {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 10, gl: 'us', hl: 'en' }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      throw new Error(`Search provider returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string }>;
    };

    return {
      results: (data.organic ?? []).map((r) => ({
        title: r.title ?? '',
        link: r.link ?? '',
        snippet: r.snippet ?? '',
      })),
    };
  }
}

export function getSearchProvider(): SearchProvider | null {
  const env = getEnv();
  if (env.SEARCH_PROVIDER === 'serper' && env.SERPER_API_KEY) {
    return new SerperProvider(env.SERPER_API_KEY);
  }
  return null;
}

export interface SearchObservationInput {
  businessName: string;
  domain: string;
  primaryServices: string | null;
  businessLocation: string | null;
}

/**
 * Run a small, fixed set of public-web queries.
 *
 * Failures are swallowed deliberately: a search-provider outage must never
 * invalidate an otherwise complete audit.
 */
export async function collectSearchObservations(
  input: SearchObservationInput,
): Promise<{ observations: SearchObservation[]; provider: string | null; error: string | null }> {
  const provider = getSearchProvider();
  if (!provider) {
    return { observations: [], provider: null, error: null };
  }

  const service = (input.primaryServices ?? '').split(/[,;]/)[0]?.trim();
  const queries = [
    service ? `${input.businessName} ${service}` : `${input.businessName} services`,
    input.businessLocation
      ? `${input.businessName} ${input.businessLocation}`
      : `${input.businessName} reviews`,
    `${input.businessName} reviews`,
    service
      ? `best ${service} ${input.businessLocation ?? ''}`.trim()
      : `${input.businessName} expertise`,
  ].filter((q, i, arr) => q.length > 0 && arr.indexOf(q) === i);

  const observations: SearchObservation[] = [];
  let error: string | null = null;

  for (const query of queries.slice(0, 4)) {
    try {
      const { results } = await provider.search(query);
      const brandAppears = results.some(
        (r) =>
          r.link.toLowerCase().includes(input.domain.toLowerCase()) ||
          r.title.toLowerCase().includes(input.businessName.toLowerCase()),
      );
      const topDomains = [
        ...new Set(
          results
            .map((r) => {
              try {
                return new URL(r.link).hostname.replace(/^www\./, '');
              } catch {
                return '';
              }
            })
            .filter(Boolean),
        ),
      ].slice(0, 8);

      observations.push({
        query,
        resultCount: results.length,
        brandAppears,
        topDomains,
        note: brandAppears
          ? 'The brand or domain appeared in the public results for this query.'
          : 'The brand did not appear in the first page of public results for this query.',
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Search provider unavailable.';
      break;
    }
  }

  return { observations, provider: provider.name, error };
}

export const SEARCH_DISCLAIMER =
  'These are observations of publicly visible search results at the time of the audit. They describe general web visibility only. They are not evidence of whether any particular AI assistant will mention or recommend the brand.';
