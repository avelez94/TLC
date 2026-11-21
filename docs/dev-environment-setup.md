# Development Environment Setup

Goal: a separate Supabase project, Stripe **test mode**, a controlled test inbox, and Vercel
**Preview** variables that never point at production. No production data is copied.

Steps marked **(owner)** need your accounts. Never paste keys or passwords into chat;
enter them only in the Supabase, Stripe and Vercel dashboards or in local files.

---

## 1. Create the Supabase development project (owner, about 5 minutes)

1. Go to **supabase.com/dashboard** and select the organization **TLC Leadership Consulting & Coaching**.
2. Click **New project**.
   - **Name:** `TLC Leadership – Dev`
   - **Database password:** click **Generate a password** and save it in your password manager. Do not share it.
   - **Region:** East US (Ohio) — same as production.
   - **Plan / compute:** Free (Nano). The form should show **$0/month**. If it shows any charge, stop and tell me.
3. Click **Create new project** and wait until the status is **Healthy** (1–2 minutes).
4. Tell me in chat: "dev project created". Nothing else is needed; I can see projects in this organization.

### What I do next (no owner action)
- Load the **structure only** (no data) from `supabase/tests/rls/01_live_replica.sql`, then the
  emergency lockdown, 2a and 2b migrations, in production order.
- Create synthetic people and records (invented names, `@example.test` addresses): an admin,
  a coaching client, participants in two cohorts, a returning participant, an outsider.
- Run the database access matrix against it and the advisors.

## 2. Supabase Auth settings for the dev project (owner, dashboard)

**Authentication → Sign In / Providers**
- Email provider: on. **Allow new users to sign up: off** (accounts are created by invitation, as in production).
- **Confirm email: on.** **Secure email change: on.**

**Authentication → URL Configuration**
- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/**` and `https://*-cutrated-mile.vercel.app/**`

**Authentication → Policies / Passwords**
- Minimum length **12**; require lowercase, uppercase, digits and symbols.

**Authentication → Multi-Factor**
- TOTP (authenticator app): **enabled** (free on all plans).

## 3. Stripe — the correct TLC account, test mode (owner)

The Stripe connection currently attached to Claude is for **Beyond the Horizon**, a different
business. Do not use it for TLC.

### 3a. Keys for the app (test mode only)
1. Sign in to **dashboard.stripe.com** and confirm the account name at top left is the **TLC** business.
2. Turn on **Test mode** (toggle at top right). Everything below must show the orange "Test mode" banner.
3. **Developers → API keys:** copy the **Publishable key** (`pk_test_…`) and **reveal** the **Secret key** (`sk_test_…`).
4. Paste them **only** into:
   - Vercel → Project **tlc** → Settings → Environment Variables (see section 5), target **Preview** only, type **Sensitive**.
   - Your local file `.env.development.local` (section 6).
5. Webhooks for testing use the **Stripe CLI** on this Mac (Vercel previews are behind Vercel sign-in, so Stripe can't reach them):
   ```bash
   brew install stripe/stripe-cli/stripe
   ```
   ```bash
   stripe login
   ```
   `stripe login` opens the browser; pick the **TLC** account. No key is shown or pasted. During
   testing I run `stripe listen --forward-to localhost:3000/api/webhook`, which prints a temporary
   `whsec_…` that stays on this machine.

### 3b. Read-only access for the payment reconciliation
Option A (preferred): in Claude, open **Settings → Connectors → Stripe**, disconnect or add an
account, sign in with Stripe, and choose the **TLC** account. When Stripe asks for permissions,
read access is enough. Tell me when it shows up; I will only use read operations, in live mode,
for the 8 Checkout sessions.

Option B: in the Stripe dashboard (live mode), **Payments**, filter by date Aug 1 – Oct 1, 2026,
and export to CSV. Keep the file in the git-ignored `confidential/` folder and tell me its name.

## 4. Test email (owner)

- Resend: **API Keys → Create API key**, name `tlc-dev`, permission **Sending access**, domain
  `contact.tramainecrawford.com`. Put it in Vercel Preview + local only.
- `EMAIL_TEST_RECIPIENT`: an inbox you control (for example a Gmail alias). Outside production
  every email goes there instead of to the real recipient.

## 5. Vercel Preview variables (owner enters secrets; I handle the rest)

Vercel → **tlc** → Settings → **Environment Variables** → **Add new**, Environment = **Preview**
only, type **Sensitive**:

| Name | Value from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | dev project → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dev project → Settings → API → `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | dev project → Settings → API → `service_role` key |
| `STRIPE_SECRET_KEY` | `sk_test_…` (3a) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` (3a) |
| `RESEND_API_KEY` | `tlc-dev` key (4) |
| `EMAIL_TEST_RECIPIENT` | your test inbox (4) |
| `CRON_SECRET` | any long random string |

Then tell me, and I will remove **Preview** from the existing production-valued variables (leaving
**Production** untouched) and confirm with a listing that no Preview variable points at production.

## 6. Local development

```bash
cp .env.example .env.development.local
```
Fill it with the dev/test values above. The current `.env.local` still contains production
Supabase keys; once `.env.development.local` works, rename `.env.local` to
`confidential/.env.local.production` (or delete it; the values live in Vercel and Supabase).
`npm run dev` refuses to start against production or a live Stripe key.
