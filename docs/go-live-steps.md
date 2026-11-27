# Going live with online payments — steps for Tramaine

Everything below is done in the admin portal (tramainecrawford.com/login → The Impact Lab). No code changes are needed.
**Admin → Launch readiness** always shows what is still missing, with a link to fix each item. Payments open by themselves for a cohort the moment every item is done.

## 1. Publish the three policies (Admin → Policies & legal)
For each of **Privacy Policy**, **Terms & Conditions** and **Refund & Cancellation Policy**:
1. Enter the page title and an optional introduction.
2. Add a section for each topic (heading + wording). Use ↑ ↓ to reorder; Delete to remove. Drafts save automatically; **Save draft** also keeps a version.
3. **Preview** to read it as visitors will.
4. Tick “I have reviewed this wording and approve it as the official …” and press **Publish**.
The page goes live at /privacy, /terms or /refund-policy with today’s date, and appears in the site footer.
To change it later: edit, then **Publish changes**. Earlier versions stay in **Version history** (View / Restore into draft).
**Unpublish** takes it down — online payments stop until it is published again.

## 2. Set up the cohort (Admin → Cohorts)
1. **+ New cohort**: name, pathway, start and end dates → Create cohort (it starts as a Draft).
2. In the cohort: **Details** → session day and time, **seat limit**, **meeting link**; **Schedule** → Generate schedule.
3. Add weekly reps, prompts, resources and a welcome announcement (recommended).
4. Set the status to **Upcoming** when everything is ready.

## 3. Open the pathway (Admin → Pathways)
Edit the cohort’s pathway: keep the price ($97 / $149 / $197; the price shown and the price charged must match), tick **Open for enrollment**, Save.

## 4. Check Launch readiness
Every row should say Done. When it does, the Impact Lab page shows the price and a Register button for that pathway, and people can pay. Each registration records which policy versions the person accepted and when.

## Already done for you
- Stripe: account checked; required webhook events added to the TLC webhook only (the Rising Sons Academy webhook on the shared account is untouched); signing secret verified with a no-charge test. Re-run from Launch readiness → Stripe if anything changes in Stripe.
- Live payments switched on by the site owner (2026-11-27). Launch readiness shows **Stripe payments: Enabled**. **Public paid registration** becomes available by itself once steps 1–3 are done; no developer or redeploy is needed.
- Organisation Stripe payment links and invoices become available at the same moment the policies are published (until then, record organisation payments as offline).
