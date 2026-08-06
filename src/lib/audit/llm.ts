import { z } from 'zod';

import { getEnv } from '@/lib/env';
import { CATEGORY_LABELS, type CategoryScore, type CheckResult } from '@/lib/audit/types';

/**
 * Optional narrative enhancement via the OpenAI Responses API.
 *
 * Hard rules enforced here:
 *  - the model NEVER sees or alters directly observed evidence values; it
 *    receives a compact, already-computed summary
 *  - scores, statuses and evidence are computed before this runs and are not
 *    passed back through it
 *  - output is validated with Zod and retried once on a schema violation
 *  - any failure leaves the deterministic report completely intact
 *  - no user email, password, payment or personal data is ever included
 */

const enhancementSchema = z.object({
  executiveSummary: z
    .string()
    .min(120)
    .max(2400)
    .describe('Three to five sentences summarizing the audit for a business owner.'),
  categoryNarratives: z
    .array(
      z.object({
        category: z.string(),
        narrative: z.string().min(40).max(900),
      }),
    )
    .max(7),
  recommendationNarratives: z
    .array(
      z.object({
        checkId: z.string(),
        whyItMatters: z.string().min(40).max(900),
      }),
    )
    .max(12),
});

export type LlmEnhancement = z.infer<typeof enhancementSchema>;

export interface LlmEnhancementResult {
  ok: boolean;
  enhancement: LlmEnhancement | null;
  model: string | null;
  generatedAt: Date | null;
  error: string | null;
}

const SYSTEM_PROMPT = `You write the narrative sections of an AI-visibility (Generative Engine Optimization) audit report for US businesses.

Absolute rules:
- Write in US English, plain and direct. No hype, no filler, no emoji.
- You are given already-computed scores and check outcomes. Treat them as fact. Never change, dispute, recompute or invent a score, status or piece of evidence.
- Never claim that any action guarantees the business will be mentioned, cited or recommended by ChatGPT, Perplexity, Gemini, Copilot or any other AI system. Use "may improve discoverability" style wording.
- Never invent facts about the business that were not supplied to you.
- Address the reader as "your website" / "you".
- Be specific about what to change and why it affects how AI systems read the site.
- Return only JSON matching the requested schema.`;

interface EnhancementInput {
  businessName: string;
  websiteUrl: string;
  industry: string | null;
  overallScore: number;
  categories: CategoryScore[];
  topFailures: CheckResult[];
  topPasses: CheckResult[];
  pagesCrawled: number;
}

function buildUserPrompt(input: EnhancementInput): string {
  const lines: string[] = [];
  lines.push(`Business: ${input.businessName}`);
  lines.push(`Website: ${input.websiteUrl}`);
  if (input.industry) lines.push(`Industry: ${input.industry}`);
  lines.push(`Pages crawled: ${input.pagesCrawled}`);
  lines.push(`Overall AI Visibility Score: ${input.overallScore}/100`);
  lines.push('');
  lines.push('Category scores:');
  for (const category of input.categories) {
    if (!category.available) {
      lines.push(`- ${CATEGORY_LABELS[category.category]}: not measured`);
      continue;
    }
    lines.push(`- ${CATEGORY_LABELS[category.category]}: ${category.score}/100`);
  }
  lines.push('');
  lines.push('Checks that passed (strengths):');
  for (const check of input.topPasses) {
    lines.push(`- [${check.checkId}] ${check.title}`);
  }
  lines.push('');
  lines.push('Checks that failed or partially failed (weaknesses), most severe first:');
  for (const check of input.topFailures) {
    lines.push(
      `- [${check.checkId}] ${check.title} — severity ${check.severity}, category ${CATEGORY_LABELS[check.category]}`,
    );
  }
  lines.push('');
  lines.push(
    'Write: (1) executiveSummary — 3-5 sentences a business owner can act on; (2) categoryNarratives — one short paragraph per measured category, using the exact category label as the "category" value; (3) recommendationNarratives — for up to 12 of the failing checks above, an improved "why it matters" paragraph keyed by the exact checkId.',
  );

  return lines.join('\n');
}

const RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  name: 'audit_enhancement',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['executiveSummary', 'categoryNarratives', 'recommendationNarratives'],
    properties: {
      executiveSummary: { type: 'string' },
      categoryNarratives: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['category', 'narrative'],
          properties: {
            category: { type: 'string' },
            narrative: { type: 'string' },
          },
        },
      },
      recommendationNarratives: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['checkId', 'whyItMatters'],
          properties: {
            checkId: { type: 'string' },
            whyItMatters: { type: 'string' },
          },
        },
      },
    },
  },
};

async function callResponsesApi(prompt: string): Promise<string> {
  const env = getEnv();

  const response = await fetch(`${env.OPENAI_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      instructions: SYSTEM_PROMPT,
      input: prompt,
      max_output_tokens: 3000,
      text: { format: RESPONSE_FORMAT },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenAI returned HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }

  // Fall back to walking the structured output array.
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.text) return content.text;
    }
  }

  throw new Error('OpenAI response contained no text output.');
}

/**
 * Enhance the report narrative. Returns ok:false (never throws) so the caller
 * can proceed with deterministic templates.
 */
export async function enhanceWithLlm(input: EnhancementInput): Promise<LlmEnhancementResult> {
  const env = getEnv();

  if (!env.llmEnabled) {
    return {
      ok: false,
      enhancement: null,
      model: null,
      generatedAt: null,
      error: 'OPENAI_API_KEY is not configured. Deterministic report templates were used.',
    };
  }

  const prompt = buildUserPrompt(input);
  let lastError = 'Unknown error';

  // One retry: a schema violation is usually transient.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await callResponsesApi(
        attempt === 0
          ? prompt
          : `${prompt}\n\nYour previous response did not match the required JSON schema. Return only valid JSON matching it exactly.`,
      );

      const parsedJson = JSON.parse(raw) as unknown;
      const validated = enhancementSchema.safeParse(parsedJson);

      if (!validated.success) {
        lastError = `Model output failed validation: ${validated.error.issues[0]?.message ?? 'schema mismatch'}`;
        continue;
      }

      return {
        ok: true,
        enhancement: validated.data,
        model: env.OPENAI_MODEL,
        generatedAt: new Date(),
        error: null,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Request failed';
    }
  }

  return { ok: false, enhancement: null, model: null, generatedAt: null, error: lastError };
}

/**
 * Deterministic executive summary used whenever the LLM is unavailable.
 * This is the default path and must always produce a complete, useful report.
 */
export function buildDeterministicSummary(input: {
  businessName: string;
  websiteUrl: string;
  overallScore: number;
  categories: CategoryScore[];
  strengths: string[];
  weaknesses: string[];
  pagesCrawled: number;
  criticalCount: number;
  highCount: number;
}): string {
  const available = input.categories.filter((c) => c.available);
  const sorted = [...available].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const parts: string[] = [];

  parts.push(
    `${input.businessName} scores ${input.overallScore} out of 100 for AI visibility readiness, based on ${input.pagesCrawled} ${input.pagesCrawled === 1 ? 'page' : 'pages'} crawled from ${input.websiteUrl}.`,
  );

  if (best && worst && best.category !== worst.category) {
    parts.push(
      `The strongest area is ${CATEGORY_LABELS[best.category]} at ${best.score}/100, while ${CATEGORY_LABELS[worst.category]} is the weakest at ${worst.score}/100.`,
    );
  }

  if (input.criticalCount > 0) {
    parts.push(
      `${input.criticalCount} critical ${input.criticalCount === 1 ? 'issue' : 'issues'} and ${input.highCount} high-severity ${input.highCount === 1 ? 'item' : 'items'} were found; the critical items block AI systems from reading or attributing the site correctly and should be handled first.`,
    );
  } else if (input.highCount > 0) {
    parts.push(
      `No critical blockers were found, but ${input.highCount} high-severity ${input.highCount === 1 ? 'item' : 'items'} are limiting how confidently an answer engine could describe or cite this business.`,
    );
  } else {
    parts.push(
      'No critical or high-severity blockers were found. The remaining opportunities are refinements rather than fixes.',
    );
  }

  if (input.strengths.length > 0) {
    parts.push(`Working well today: ${input.strengths.join('; ')}.`);
  }
  if (input.weaknesses.length > 0) {
    parts.push(`Highest-priority gaps: ${input.weaknesses.join('; ')}.`);
  }

  parts.push(
    'The prioritized action plan below groups every recommendation by how soon it should be tackled. Addressing the "Do first" items may improve how well AI systems can discover, understand and attribute this website — no tool can guarantee a mention in any specific AI assistant.',
  );

  return parts.join(' ');
}
