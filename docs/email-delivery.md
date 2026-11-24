# Email delivery: what the statuses mean (release 2e)

Every email the site sends is recorded in `email_log` with its real outcome. Links, passwords and
message text are never stored — only the template, recipient, subject, status and any error.

| Status | Meaning | Shown to admins as |
|---|---|---|
| `queued` | Being handed to Resend (a few seconds at most). | Sending |
| `accepted` (`sent` on older rows) | Resend accepted the message for delivery. This is **not** proof of delivery. | Accepted |
| `delivered` | Resend reports it reached the recipient's mail server (only with delivery events on). | Delivered |
| `delayed` | The receiving server is deferring it; Resend keeps trying. | Delayed |
| `bounced` | The address rejected it. | Bounced (needs attention) |
| `complained` | The recipient marked it as spam. | Marked as spam (needs attention) |
| `failed` | It was not sent (Resend refused it, or the link could not be created). | Failed (needs attention) |
| `skipped` | Deliberately not sent: preview/local environment without a test recipient. | Not sent (test) |

Failed, bounced and spam rows that nobody has handled appear in **Needs your attention** on the
dashboard, on the person's record, and under **Security & activity → Email delivery**.

## Resending safely
- Invitations, account set-up links, password resets and "you're enrolled" notices can be resent.
  A resend always creates a **fresh** one-time link (Supabase invite/recovery links work once and
  expire); the person never gets "sign in" if they have not set a password yet.
- Each button press carries an idempotency key, also passed to Resend, so a double-click or a
  retried request is never sent twice. "Send sign-in email" asks before sending again within two
  minutes of the last one.
- The original failed row is marked handled only when the resend is accepted. "Mark as handled"
  is for cases resolved another way (phone call, corrected address).
- Other emails (owner notifications, inquiry acknowledgements, payment emails) are not resent from
  the portal; mark them handled after following up.

## Optional: delivery tracking (Delivered / Bounced)
Off until configured; nothing else depends on it.
1. In Resend → Webhooks, add `https://tramainecrawford.com/api/email-events` for the events
   `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`.
2. Copy the signing secret and add it in Vercel (Production) as `RESEND_WEBHOOK_SECRET`; redeploy.
3. Statuses then move from Accepted to Delivered/Bounced automatically. The route verifies the
   Svix signature and only updates the status of an existing row.

## Local testing
With `EMAIL_SINK_DIR` set (non-production only; ignored in production), emails are written as JSON
files to that folder instead of being sent. Addresses containing `+fail@`, or listed in
`<EMAIL_SINK_DIR>/fail-addresses.txt`, simulate a failed send.
