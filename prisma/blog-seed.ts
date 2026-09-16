import { BlogPostStatus, type PrismaClient } from '@prisma/client';

/**
 * Starter blog content.
 *
 * Unlike the April 2026 buyer dataset, these are NOT demonstration records:
 * they are real, accurate articles about how the audit engine works, written
 * so the blog is not empty on day one. They carry `isDemo: false` because
 * nothing about them is fabricated — a new owner can keep, rewrite or delete
 * them. They are upserted by slug, so re-seeding never duplicates them and
 * never overwrites an edit an owner has published over the top.
 */

const STARTER_POSTS = [
  {
    slug: 'what-generative-engine-optimization-actually-is',
    title: 'What Generative Engine Optimization actually is',
    excerpt:
      'GEO is not a rebrand of SEO, and it is not a way to make an AI mention you. It is the work of making a website legible to systems that answer questions instead of listing links.',
    body: `Search used to end with a list of links. Increasingly it ends with an answer, and the website that informed that answer may never be clicked. That changes what "being findable" means, and it is the whole reason Generative Engine Optimization exists as a separate discipline.

## The shift in one sentence

A ranking system decides which page to show you. An answer engine decides which passage to reuse. Those are different jobs, and they reward different things.

## What answer engines need from a page

An assistant assembling an answer has to do four things with your site, in order:

1. **Reach it.** If your robots.txt blocks AI crawlers, or the content only exists after JavaScript executes, the rest does not matter.
2. **Identify it.** It has to work out who you are, where you operate and what you sell, without guessing.
3. **Extract from it.** It needs self-contained passages that survive being lifted out of the page around them.
4. **Trust it.** Authorship, evidence, dates and corroboration all feed the decision to use your content rather than someone else's.

Most websites fail at step three. They are written as a continuous argument where each paragraph depends on the one before it. That reads beautifully to a person and extracts terribly.

## What this does not mean

It does not mean writing for machines instead of people. An answer-ready page is usually a clearer page: a direct first sentence, a heading that states the question, a fact stated once with its source attached.

> No tool can make an AI assistant recommend you, and anyone promising that is selling something they cannot deliver.

What a tool *can* do is tell you which of those four steps your site currently fails, and what specifically to change. That is what an audit is for.

## Where to start

If you do nothing else, check the first: can an AI crawler fetch your pages at all? It is the cheapest thing to fix and the most common thing to get wrong.`,
  },
  {
    slug: 'why-an-audit-score-should-be-deterministic',
    title: 'Why an audit score should be deterministic',
    excerpt:
      'If the same website scores 71 today and 68 tomorrow with nothing changed, the number is noise. Here is why RankClear scores are rule-based, and what that costs.',
    body: `A visibility score is only useful if it moves when your website moves and stays still when it does not. That sounds obvious. It rules out most of how these scores are built.

## The problem with asking a model for a number

If you hand a page to a language model and ask it to rate the content out of 100, you will get a plausible number. Ask again and you may get a different one. Nothing about the page changed — the model simply sampled differently.

That is fatal for the thing customers actually want, which is to fix something and watch the number improve. If the score wanders on its own, an improvement of three points means nothing, and so does a decline.

## How the engine works instead

Every check is a rule evaluated against something observed on the page: a header, a tag, a count, a status code. Each returns a status and the evidence behind it. Category scores are weighted sums; the overall score is a weighted sum of those.

The consequence is that **the same content always produces the same score**. The test suite asserts it: an audit run twice against unchanged content returns identical numbers, and that test failing blocks a release.

## What that costs

Determinism buys comparability and gives up nuance. A rule can tell you a page has no author attribution. It cannot tell you the writing is unconvincing.

So the optional AI layer does exactly one job: it rewrites the narrative sections into plainer language. It never changes a score, a status or a piece of evidence. Turn it off and every number is identical — you just get more mechanical prose.

## Why it matters for tracking

Month-over-month tracking only means something under determinism. When a score goes from 64 to 73, that difference is attributable to specific checks that changed state, and the report names them. That is a conversation you can have with a client. "The number went up" is not.`,
  },
] as const;

export async function seedBlogPosts(prisma: PrismaClient, authorId: string): Promise<number> {
  // Spread the publication dates so the index has a sensible order.
  const base = Date.now() - 1000 * 60 * 60 * 24 * 21;

  for (const [index, post] of STARTER_POSTS.entries()) {
    const publishedAt = new Date(base + index * 1000 * 60 * 60 * 24 * 7);
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {},
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        body: post.body,
        status: BlogPostStatus.PUBLISHED,
        publishedAt,
        authorId,
        isDemo: false,
      },
    });
  }

  return STARTER_POSTS.length;
}
