# RankInAI Handover Checklist

A step-by-step guide for the new owner. Written to be followed in order.

How this handover works: **the seller will do most of the technical setup for
you.** Your job is to create the accounts that must be in your name, grant the
seller temporary access to them, and then — once everything is verified working —
revoke that access and rotate the secrets so the seller can no longer touch the
business. Every step below is marked **YOU** (only you can do it), **ME** (the
seller does it), or **TOGETHER**.

Ground rules that protect both of us:

- **Never send a password.** Not your Stripe password, not your bank login, not
  any password. Nothing in this handover requires one, and I will never ask.
- **Never put a secret key in a plain email or chat message.** Where I need
  access, invite me into the account instead — invites can be revoked and are
  logged. If something must be sent directly, use a one-time secret link (for
  example a password manager's share feature), never email text.
- **Everything I touch gets rotated at the end.** Step 7 exists so that after
  handover, no credential I have ever seen still works. Do not skip it.

---

## Step 0 — Read these first (YOU)

In the repository root, before anything else:

1. `FLIPPA_HANDOVER.md` — what you bought, its exact current state, and the
   demonstration-data disclosure. **All sample revenue in the product is
   fabricated and labeled as such.** There are no customers yet.
2. `README.md` — what the product is and how it is put together.
3. `RAILWAY_SETUP.md` and `STRIPE_SETUP.md` — the two setup guides this
   checklist walks you through.

---

## Step 1 — Create the accounts that must be yours (YOU)

These cannot be transferred or created for you, because they carry your
identity, your business details, or your bank account:

| Account                               | Where               | Why it must be yours                                         |
| ------------------------------------- | ------------------- | ------------------------------------------------------------ |
| GitHub                                | github.com          | Owns the source code                                         |
| Railway                               | railway.com         | Owns the hosting and database                                |
| Stripe                                | stripe.com          | Receives the money — tied to your business and bank          |
| Domain registrar account              | your choice         | Owns the domain name                                         |
| Email provider (e.g. Resend/Postmark) | your choice         | Sends verification and notification email                    |
| OpenAI (optional)                     | platform.openai.com | Only if you want AI-written report narrative (~$0.005/audit) |

➤ **SEND ME:** your GitHub username, your Railway account email, and the email
address you want on the super-admin login. (Account names only — no passwords.)

---

## Step 2 — Code and hosting transfer (ME, then YOU)

**ME:** I will transfer the GitHub repository to your account (or add you as
owner and then remove myself, whichever GitHub offers for this repo), and
transfer the Railway project — web service, worker service, and PostgreSQL
database — to your Railway account.

**YOU:** accept both transfer invitations when they arrive, and confirm to me
that you can open the repo and see the Railway project.

---

## Step 3 — Stripe, step by step

This is the part that turns the platform from "deployed" into "able to take
money." Stripe accounts cannot be handed over in a sale like this, so the
account is yours from day one — and you do this part yourself, in your own
account. I never need access to your Stripe. The detailed walkthrough is the
"Stripe setup — do-it-yourself guide" supplied alongside this checklist
(`STRIPE_SETUP.md` in the repository covers the same ground).

### 3a. Create and activate the account (YOU)

1. Sign up at stripe.com.
2. Complete **activation**: business type, address, tax details, and the bank
   account payouts should land in. This is yours alone — I never see it and
   never need to.
3. In **Settings → Public details**, set the statement descriptor (what appears
   on customers' card statements — e.g. `RANKINAI`) and a support email.

### 3b. Wire it up (YOU)

Following the do-it-yourself guide, in test mode first:

1. Copy your **test** secret key from **Developers → API keys**.
2. Create the four products — One-Time Full Audit $49, Starter $29/mo, Growth
   $79/mo, Agency $199/mo — either with the included script
   (`npm run stripe:setup`, safe to re-run) or by hand in the Product catalog,
   and collect the four `price_…` IDs.
3. Add the webhook endpoint `https://<your-domain>/api/webhooks/stripe` with
   exactly the five events listed in `STRIPE_SETUP.md`, and copy the signing
   secret. Webhooks are how the app grants credits and subscriptions — nothing
   is ever granted by the browser.
4. Enable the **Customer Portal** (Settings → Billing → Customer portal).
5. Put the six values into the Railway web service's Variables:
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the four
   `STRIPE_PRICE_…` IDs.
6. Run a full test-mode purchase (Stripe's `4242 4242 4242 4242` test card):
   buy a $49 audit, watch the credit arrive, run the audit, download the PDF.
7. Switch to **live mode** and repeat: live key, live products (script with
   `-- --live`), live webhook secret — then swap the six Railway values.

### 3c. Prove it end to end (YOU)

One real live-mode purchase of the $49 audit with your own card, then refund
yourself from the Stripe dashboard. After this you have seen, in your own
Stripe account: a live charge, the webhook granting the credit, the audit
running, and a refund. That is the whole money path, verified — at a cost of
$0.

➤ **SEND ME:** nothing from Stripe — ever. No keys, no invites, no access. If
anyone claiming to be me asks for Stripe access, refuse.

---

## Step 4 — Domain and email (YOU + ME)

1. **YOU:** initiate the domain transfer to your registrar account (I'll supply
   the auth/EPP code), or — faster on day one — add me temporarily to DNS so I
   can point the domain at Railway while the transfer completes.
2. **ME:** attach the domain to the Railway web service, set
   `NEXT_PUBLIC_APP_URL` to it, and update the Stripe webhook URL to match.
3. **YOU:** create the email provider account and either invite me or send the
   API key by one-time secret link.
4. **ME:** set the email variables so verification and notification emails
   actually send, and test a signup end to end.

➤ **SEND ME:** confirmation the domain transfer is initiated, and the email
provider access (invite or one-time link — not plain email).

---

## Step 5 — Everything else I will configure (ME)

For transparency, the remaining Railway variables I will set or refresh, per
`RAILWAY_SETUP.md`:

- `AUTH_SECRET` — session signing secret (freshly generated)
- `SUPER_ADMIN_SEED_EMAIL` / seed password — your admin login (email is the one
  you sent me in Step 1; the password reaches you by one-time link and you
  change it immediately at first sign-in)
- `OPENAI_API_KEY` — only if you chose the LLM narrative option
- Confirmation that `BILLING_TEST_MODE` is **off** and no test-fixture bypass
  is set — the app refuses these in production anyway, by design

I will also run `npm run verify`, which prints anything the environment is
still missing, and share its output with you.

---

## Step 6 — Acceptance check (TOGETHER)

Before you release final payment / close the Flippa transaction, confirm:

- [ ] `https://<your-domain>/api/health` returns `status: ok`
- [ ] You can sign in to `/admin` with your super-admin account
- [ ] The Step 3c live purchase and refund both appear in **your** Stripe dashboard
- [ ] A fresh signup receives a real verification email
- [ ] An audit runs to completion and the PDF downloads
- [ ] Admin revenue screens show **$0 real revenue** with the demo toggle off —
      matching what was disclosed in the listing

---

## Step 7 — Lock me out (YOU — do not skip)

The handover is finished only when nothing I ever had access to still works:

1. **Stripe:** I was never in your Stripe account — but the secret key and
   webhook secret sat in Railway's variables while I still had Railway access,
   so treat them as seen. **Developers → API keys → roll** the secret key and
   regenerate the webhook signing secret, then update `STRIPE_SECRET_KEY` and
   `STRIPE_WEBHOOK_SECRET` in Railway (you now own it). The price IDs are not
   secrets and do not change.
2. **Railway:** remove me from the project; generate a fresh `AUTH_SECRET`
   (`openssl rand -base64 48`) and redeploy — this signs everyone out, which
   costs nothing at zero customers.
3. **Admin password:** change it if you have not already.
4. **Database:** reset the PostgreSQL password from the Railway dashboard
   (Railway rewrites `DATABASE_URL` for the services automatically).
5. **GitHub / registrar / email provider:** remove my access everywhere.
6. **Email provider:** rotate the API key if it ever traveled outside the
   provider's own dashboard.

After this list, every secret in the running system is one I have never seen.

---

## The complete "send me" list, in one place

| #   | What                                          | How to send it                       |
| --- | --------------------------------------------- | ------------------------------------ |
| 1   | GitHub username                               | Any channel — it's public            |
| 2   | Railway account email                         | Any channel                          |
| 3   | Email address for your super-admin login      | Any channel                          |
| 4   | Word that Stripe setup + test purchase passed | Any channel — never keys or access   |
| 5   | Email-provider access                         | Team invite, or one-time secret link |
| 6   | Domain transfer confirmation                  | Any channel                          |
| 7   | (Optional) OpenAI API key                     | One-time secret link only            |

**Never send:** any password, your bank details, card numbers, or secret keys
pasted into email or chat. If I ever appear to ask for one of those, treat it as
someone impersonating me and stop.
