import { safeFetch } from '@/lib/audit/fetcher';

/**
 * robots.txt parsing.
 *
 * RankInAI identifies itself as `RankInAI-Auditor` and honors:
 *   - a group matching that agent exactly
 *   - otherwise the `*` group
 * The most specific matching group wins, per the de-facto standard, and the
 * longest matching path rule decides Allow vs Disallow.
 */

export const CRAWLER_TOKEN = 'rankinai-auditor';

export interface RobotsRule {
  type: 'allow' | 'disallow';
  path: string;
}

export interface RobotsTxt {
  found: boolean;
  statusCode: number | null;
  /** Rules that apply to the RankInAI crawler. */
  rules: RobotsRule[];
  sitemaps: string[];
  crawlDelaySeconds: number | null;
  /** True when a group explicitly names our agent rather than falling back to *. */
  hasAgentSpecificGroup: boolean;
  /** True when the site blocks all crawling for our agent. */
  blocksEverything: boolean;
  /** Which well-known AI crawlers are explicitly disallowed site-wide. */
  blockedAiAgents: string[];
  raw: string | null;
  error: string | null;
}

/** Agents whose treatment is worth reporting on a GEO audit. */
const AI_AGENTS = [
  'gptbot',
  'oai-searchbot',
  'chatgpt-user',
  'perplexitybot',
  'perplexity-user',
  'claudebot',
  'anthropic-ai',
  'claude-web',
  'google-extended',
  'applebot-extended',
  'bingbot',
  'ccbot',
  'meta-externalagent',
  'amazonbot',
  'youbot',
];

interface ParsedGroup {
  agents: string[];
  rules: RobotsRule[];
  crawlDelay: number | null;
}

export function parseRobotsTxt(text: string): {
  groups: ParsedGroup[];
  sitemaps: string[];
} {
  const groups: ParsedGroup[] = [];
  const sitemaps: string[] = [];
  let current: ParsedGroup | null = null;
  let lastLineWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (!line) continue;

    const colon = line.indexOf(':');
    if (colon === -1) continue;

    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastLineWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastLineWasAgent = true;
      continue;
    }

    lastLineWasAgent = false;

    if (field === 'sitemap') {
      if (value) sitemaps.push(value);
      continue;
    }

    if (!current) continue;

    if (field === 'disallow') {
      current.rules.push({ type: 'disallow', path: value });
    } else if (field === 'allow') {
      current.rules.push({ type: 'allow', path: value });
    } else if (field === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }

  return { groups, sitemaps };
}

/** Select the group that applies to a given agent token. */
function selectGroup(groups: ParsedGroup[], agentToken: string): ParsedGroup | null {
  const specific = groups.filter((g) =>
    g.agents.some((a) => a === agentToken || agentToken.startsWith(a)),
  );
  if (specific.length > 0) {
    return specific.reduce<ParsedGroup>(
      (acc, g) => ({
        agents: [...acc.agents, ...g.agents],
        rules: [...acc.rules, ...g.rules],
        crawlDelay: g.crawlDelay ?? acc.crawlDelay,
      }),
      { agents: [], rules: [], crawlDelay: null },
    );
  }
  const wildcard = groups.filter((g) => g.agents.includes('*'));
  if (wildcard.length === 0) return null;
  return wildcard.reduce<ParsedGroup>(
    (acc, g) => ({
      agents: ['*'],
      rules: [...acc.rules, ...g.rules],
      crawlDelay: g.crawlDelay ?? acc.crawlDelay,
    }),
    { agents: ['*'], rules: [], crawlDelay: null },
  );
}

function agentBlockedEverywhere(groups: ParsedGroup[], agent: string): boolean {
  const group = selectGroup(groups, agent);
  if (!group) return false;
  const explicitGroup = groups.some((g) => g.agents.includes(agent));
  if (!explicitGroup) return false;
  return group.rules.some((r) => r.type === 'disallow' && r.path === '/');
}

export async function fetchRobotsTxt(origin: string): Promise<RobotsTxt> {
  const url = new URL('/robots.txt', origin).toString();
  const result = await safeFetch(url, {
    allowPlainText: true,
    acceptErrorStatus: true,
    maxBytes: 512_000,
  });

  if (!result.ok) {
    return {
      found: false,
      statusCode: null,
      rules: [],
      sitemaps: [],
      crawlDelaySeconds: null,
      hasAgentSpecificGroup: false,
      blocksEverything: false,
      blockedAiAgents: [],
      raw: null,
      error: result.message,
    };
  }

  // A 404 is a perfectly valid "everything is allowed" answer.
  if (result.statusCode >= 400) {
    return {
      found: false,
      statusCode: result.statusCode,
      rules: [],
      sitemaps: [],
      crawlDelaySeconds: null,
      hasAgentSpecificGroup: false,
      blocksEverything: false,
      blockedAiAgents: [],
      raw: null,
      error: null,
    };
  }

  const { groups, sitemaps } = parseRobotsTxt(result.body);
  const group = selectGroup(groups, CRAWLER_TOKEN);
  const hasAgentSpecificGroup = groups.some((g) =>
    g.agents.some((a) => a !== '*' && CRAWLER_TOKEN.startsWith(a)),
  );

  const blockedAiAgents = AI_AGENTS.filter((agent) => agentBlockedEverywhere(groups, agent));

  return {
    found: true,
    statusCode: result.statusCode,
    rules: group?.rules ?? [],
    sitemaps,
    crawlDelaySeconds: group?.crawlDelay ?? null,
    hasAgentSpecificGroup,
    blocksEverything: (group?.rules ?? []).some((r) => r.type === 'disallow' && r.path === '/'),
    blockedAiAgents,
    // Keep a bounded excerpt only — we never store an entire remote file.
    raw: result.body.slice(0, 8000),
    error: null,
  };
}

/**
 * Decide whether a path may be crawled.
 * Longest matching rule wins; Allow beats Disallow at equal specificity.
 */
export function isPathAllowed(robots: RobotsTxt, pathname: string): boolean {
  if (!robots.found || robots.rules.length === 0) return true;

  let bestAllow = -1;
  let bestDisallow = -1;

  for (const rule of robots.rules) {
    if (rule.path === '') {
      // "Disallow:" with an empty value means allow everything.
      if (rule.type === 'disallow') continue;
    }
    if (!matchesRobotsPattern(rule.path, pathname)) continue;
    const specificity = rule.path.length;
    if (rule.type === 'allow') {
      bestAllow = Math.max(bestAllow, specificity);
    } else {
      bestDisallow = Math.max(bestDisallow, specificity);
    }
  }

  if (bestDisallow === -1) return true;
  return bestAllow >= bestDisallow;
}

/** Supports the `*` wildcard and the `$` end-anchor. */
export function matchesRobotsPattern(pattern: string, pathname: string): boolean {
  if (pattern === '') return false;
  if (pattern === '/') return true;

  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;

  if (!body.includes('*')) {
    return anchored ? pathname === body : pathname.startsWith(body);
  }

  const escaped = body
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  const regex = new RegExp(`^${escaped}${anchored ? '$' : ''}`);
  return regex.test(pathname);
}
