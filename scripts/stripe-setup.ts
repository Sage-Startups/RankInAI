/**
 * Create (or find) the RankInAI products and prices in Stripe and print the
 * environment variables to set.
 *
 * Nothing is written to the database and no price ID is ever hard-coded in the
 * application — `src/lib/plans.ts` reads them from the environment. Re-running
 * this is safe: existing products are matched by their `rankinaiProductKey`
 * metadata and reused rather than duplicated.
 *
 *   STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup
 *
 * Add `--live` to acknowledge running against a live-mode key.
 */
import Stripe from 'stripe';

import { ALL_PRODUCTS, type PricedProduct } from '../src/lib/plans';

const CURRENCY = 'usd';

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

async function findProduct(stripe: Stripe, product: PricedProduct): Promise<Stripe.Product | null> {
  // Stripe's search index is eventually consistent, so fall back to a listing.
  const search = await stripe.products.search({
    query: `metadata['rankinaiProductKey']:'${product.key}'`,
    limit: 1,
  });
  if (search.data[0]) return search.data[0];

  for await (const candidate of stripe.products.list({ limit: 100, active: true })) {
    if (candidate.metadata?.rankinaiProductKey === product.key) return candidate;
  }
  return null;
}

async function findPrice(
  stripe: Stripe,
  product: PricedProduct,
  stripeProductId: string,
): Promise<Stripe.Price | null> {
  for await (const price of stripe.prices.list({ product: stripeProductId, limit: 100 })) {
    if (!price.active) continue;
    if (price.currency !== CURRENCY) continue;
    if (price.unit_amount !== product.priceCents) continue;

    const wantsRecurring = product.interval === 'month';
    if (wantsRecurring && price.recurring?.interval !== 'month') continue;
    if (!wantsRecurring && price.recurring) continue;

    return price;
  }
  return null;
}

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    fail(
      'STRIPE_SECRET_KEY is not set. Get a test-mode key from https://dashboard.stripe.com/test/apikeys and run:\n' +
        '    STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup',
    );
  }

  const isLive = secretKey.startsWith('sk_live_');
  if (isLive && !process.argv.includes('--live')) {
    fail(
      'That is a live-mode key. Re-run with --live if you really mean to create live products:\n' +
        '    STRIPE_SECRET_KEY=sk_live_... npm run stripe:setup -- --live',
    );
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2026-07-29.dahlia' });

  console.log(`\nRankInAI Stripe setup — ${isLive ? 'LIVE' : 'test'} mode\n`);

  const envLines: string[] = [];

  for (const product of ALL_PRODUCTS) {
    let stripeProduct = await findProduct(stripe, product);

    if (stripeProduct) {
      console.log(`  = ${product.name}: reusing product ${stripeProduct.id}`);
    } else {
      stripeProduct = await stripe.products.create({
        name: `RankInAI ${product.name}`,
        description: product.tagline,
        metadata: { rankinaiProductKey: product.key },
      });
      console.log(`  + ${product.name}: created product ${stripeProduct.id}`);
    }

    let price = await findPrice(stripe, product, stripeProduct.id);

    if (price) {
      console.log(`    = price ${price.id} (${(product.priceCents / 100).toFixed(2)} USD)`);
    } else {
      price = await stripe.prices.create({
        product: stripeProduct.id,
        currency: CURRENCY,
        unit_amount: product.priceCents,
        ...(product.interval === 'month' ? { recurring: { interval: 'month' } } : {}),
        metadata: { rankinaiProductKey: product.key },
      });
      console.log(`    + price ${price.id} (${(product.priceCents / 100).toFixed(2)} USD)`);
    }

    envLines.push(`${product.envVar}=${price.id}`);
  }

  console.log('\nSet these environment variables on your deployment:\n');
  console.log(envLines.map((line) => `  ${line}`).join('\n'));
  console.log(
    '\nThen configure the webhook endpoint:\n' +
      '  1. https://dashboard.stripe.com/' +
      (isLive ? '' : 'test/') +
      'webhooks → Add endpoint\n' +
      '  2. URL: https://<your-domain>/api/webhooks/stripe\n' +
      '  3. Events: checkout.session.completed, customer.subscription.created,\n' +
      '     customer.subscription.updated, customer.subscription.deleted,\n' +
      '     invoice.payment_failed\n' +
      '  4. Copy the signing secret into STRIPE_WEBHOOK_SECRET\n' +
      '  5. Unset BILLING_TEST_MODE so real checkout is used\n',
  );
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
