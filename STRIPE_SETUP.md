# Stripe Setup

RankInAI never handles card data. Stripe Checkout and the Customer Portal are hosted
by Stripe; the application stores a customer ID and payment metadata only.

Price IDs are **never hard-coded**. `src/lib/plans.ts` reads them from the
environment, so the same build works against test and live modes.

## 1. Create the products and prices

```bash
STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup
```

The script creates four products with a `rankinaiProductKey` metadata tag and one
price each, then prints the environment variables to set. Re-running it is safe:
existing products are matched by that tag and reused rather than duplicated.

| Product             | Price   | Type               |
| ------------------- | ------- | ------------------ |
| One-Time Full Audit | $49.00  | one-time payment   |
| Starter             | $29.00  | recurring, monthly |
| Growth              | $79.00  | recurring, monthly |
| Agency              | $199.00 | recurring, monthly |

Output looks like:

```
STRIPE_PRICE_ONE_TIME_AUDIT=price_1AbC...
STRIPE_PRICE_STARTER_MONTHLY=price_1DeF...
STRIPE_PRICE_GROWTH_MONTHLY=price_1GhI...
STRIPE_PRICE_AGENCY_MONTHLY=price_1JkL...
```

For live mode, re-run with a live key and the explicit acknowledgement:

```bash
STRIPE_SECRET_KEY=sk_live_... npm run stripe:setup -- --live
```

Test-mode and live-mode price IDs are different. Set the ones that match the key the
deployment is using.

## 2. Configure the webhook

Webhooks are the source of truth for entitlements. Nothing is granted by the browser.

1. **Dashboard → Developers → Webhooks → Add endpoint**
2. URL: `https://<your-domain>/api/webhooks/stripe`
3. Select exactly these events:

   | Event                           | Effect                                                |
   | ------------------------------- | ----------------------------------------------------- |
   | `checkout.session.completed`    | Grants the audit credit or activates the subscription |
   | `customer.subscription.created` | Records a new subscription and its period             |
   | `customer.subscription.updated` | Plan changes, renewals, cancel-at-period-end          |
   | `customer.subscription.deleted` | Ends access at the period boundary                    |
   | `invoice.payment_failed`        | Marks the subscription past due and flags it in admin |

4. Copy the signing secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.

### How the endpoint behaves

- The signature is verified against the **raw** body before anything is parsed.
  Unsigned or badly signed requests are rejected outright.
- Each event ID is claimed by inserting a `StripeWebhookEvent` row with a unique
  constraint. A replay hits the constraint and returns early, so processing is
  idempotent. The purchase row is a second guard against double-granting a credit.
- Stored payloads are sanitized — customer names, addresses and card details are
  stripped before anything is written.
- Processed events are visible at `/admin/payments` under "Stripe webhook history".

## 3. Customer Portal

**Dashboard → Settings → Billing → Customer portal.** Enable plan switching,
cancellation and invoice history. The "Open billing portal" button on
`/dashboard/billing` creates a portal session and returns the customer to the billing
page.

The portal is unavailable while `BILLING_TEST_MODE` is on, and the button says so
rather than presenting a control that cannot work.

## 4. Local testing

With `BILLING_TEST_MODE=true` and no Stripe keys, checkout is simulated: the
application runs `fulfillSimulatedCheckout`, which is the **same fulfillment code the
webhook calls**. The entitlement path being exercised is the production one; only the
payment is skipped. A prominent banner appears wherever billing is shown.

To test the real integration, use test-mode keys and the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# copy the printed whsec_... into STRIPE_WEBHOOK_SECRET, then unset BILLING_TEST_MODE
stripe trigger checkout.session.completed
```

Test card `4242 4242 4242 4242`, any future expiry, any CVC.

## 5. Going live

- [ ] `npm run stripe:setup -- --live` has been run and the live price IDs are set
- [ ] A live webhook endpoint exists with the five events above
- [ ] `STRIPE_SECRET_KEY` is the live key
- [ ] `STRIPE_WEBHOOK_SECRET` is the **live** endpoint's secret, not the test one
- [ ] `BILLING_TEST_MODE` is unset — `npm run verify` will flag it if not
- [ ] One real purchase has been made and refunded, and the credit appeared
- [ ] The Customer Portal opens and can cancel a subscription
- [ ] Business details, statement descriptor and tax settings are configured in Stripe

## Troubleshooting

**"No Stripe price configured for …"** — the product's `STRIPE_PRICE_*` variable is
missing. Run `npm run stripe:setup` and set the printed value.

**Webhook returns 400** — the signature did not verify. Almost always a test secret
against a live endpoint or vice versa, or a proxy that modified the request body.

**Webhook returns 503** — `STRIPE_SECRET_KEY` is not configured, so signatures cannot
be verified. This is the correct response; it is not an outage.

**Payment succeeded but no credit** — check "Stripe webhook history" on
`/admin/payments`. If the event is absent, Stripe could not reach the endpoint; if it
is present and marked duplicate, the credit was granted on an earlier delivery.
