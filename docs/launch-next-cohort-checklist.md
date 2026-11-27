# Launch Your Next Impact Lab Cohort

Status as of 2026-11-27, checked against production (read-only) and the local test stack.
**Legend:** ✅ done · ⬜ to do · ◻️ optional · 🔑 needs owner (Tramaine) approval

## 1. Plan the cohort
- 🔑 Choose the pathway (Emerging $97 / New $149 / Practicing $197)
- 🔑 Approve name, start/end dates, session day/time, seat limit
- ⬜ Create the cohort in Cohorts (stays **Draft**) — not created; waiting on the details above
- ⬜ Generate the session schedule
- ⬜ Add the meeting link (Zoom)

## 2. Prepare the content
- ⬜ Weekly reps for each week
- ⬜ Journal prompts (pathway prompts exist for some pathways; review)
- ⬜ Learning resources scoped to the cohort or pathway
- ◻️ Reading (book), if any
- ⬜ Welcome announcement

## 3. Configure pricing and registration
- ✅ Pathway prices set in production: $97 / $149 / $197 (public price = charged price = admin price)
- ✅ Historical programs unchanged and not purchasable
- ✅ Checkout tested end to end in test mode (amounts, signed webhook, pending → confirm → invite → sign in, complimentary without Stripe, capacity limit)
- 🔑 Decide: open online registration, or keep inquiry-only for this cohort
- ⬜ If opening: verify in the Stripe dashboard that the live webhook endpoint exists and is subscribed to the required events, and that email receipts are on
- 🔑 Set `CHECKOUT_ENABLED=true` in Vercel and redeploy — **not done; payments remain disabled**
- ⬜ Turn on "Open for enrollment" for the pathway; set cohort status to Upcoming

## 4. Review participant communications
- ✅ Invitation, enrollment, payment-received and inquiry acknowledgement emails exist and are logged
- ✅ Failed emails surface on the dashboard with Resend / Mark handled
- ⬜ Read each email template once with Tramaine's eye for tone and dates
- 🔑 Refund / cancellation policy wording

## 5. Test the participant experience
- ✅ Invite → set password → sign in → correct cohort (local test)
- ⬜ One internal test participant in production (a team member's own address) after the cohort exists
- ⬜ Check portal on a phone: sessions, reps, journal, resources

## 6. Open enrollment
- 🔑 Approve opening
- ⬜ Cohort status → Upcoming; pathway → Open for enrollment
- ⬜ Invite people from inquiries (Morgan-style individual and organization flows)
- ⬜ Organizations: record offline payments, or Stripe invoices once payments are on

## 7. Prepare for the first session
- ⬜ Setup checklist shows all essential items done
- ⬜ Everyone enrolled has signed in (dashboard flags those who haven't)
- ⬜ Resend any failed invitations
- ⬜ Attendance ready for session 1

### Housekeeping before launch
- 🔑 Deploy the completion-review update, then close the Fall 2026 review (no certificates; nobody's records change)
- ⬜ Close the old "TEST - TLC deployment verification" inquiry
- ◻️ Admin MFA: both admins enroll, test recovery, then make it required
- 🔑 Certificate signature approval (off until Tramaine approves)
