# The Impact Lab — Admin quick-start guide

Matches the chapters of the admin training video (`impact-lab-admin-training.mp4`). Sign in at **tramainecrawford.com/login → The Impact Lab**.

| # | Task | Where | Steps |
|---|------|-------|-------|
| 1 | Sign in and read the dashboard | Dashboard | Needs your attention → upcoming sessions → cohorts → key numbers → *How do I…?* |
| 2 | Needs your attention | Dashboard | Urgent = today, To do = next steps, For your information = worth a look. Each item has one button that opens the exact record. |
| 3 | Pathways | Programs → Pathways | *Edit pathway*: public wording, "Show on the Impact Lab page", "Open for enrollment", price. The price shown publicly is the price Stripe charges. Historical programs are kept at the bottom and never offered. |
| 4 | Create a cohort | Programs → Cohorts → *+ New cohort* | Name, pathway, start/end dates → *Create cohort*. It starts as **Draft** (not public). |
| 5 | Readiness checklist | The cohort's *Setup checklist* | Essential: dates, seat limit, schedule, meeting link. Recommended: weekly reps, prompts, resources, reading, welcome announcement. The checklist never changes status or opens enrollment. |
| 6 | Sessions and meeting link | Cohort → Details, Schedule | Set day, time, seat limit, meeting link (saves as you type) → Schedule → *Generate schedule*. |
| 7 | Resources and assignments | Cohort → Weekly reps / Journal prompts; Resources; Announcements | Add reps (week, due date, title, instructions). Journal answers stay private. Resources: choose cohort, pathway or everyone. |
| 8 | Review an inquiry | People → Inquiries | Open it → set status (New → Contacted → Qualified → Converted), follow-up date, notes. |
| 9 | Inquiry → enrollment | The inquiry → *Invite to a cohort* | Choose the cohort, check the "What will happen" table → *Send invitation* → confirm. Result is saved as a note. |
| 10 | Invite a participant | People → Participants → *+ Invite someone* | Email, name, cohort → *Send invitation*. *Send sign-in email* gives a fresh link. |
| 11 | Organizational enrollment | The organization's inquiry | Paste "Name, email" one per line → *Invite N people* → confirm. Payments: offline only (check, transfer) while online payments are off. |
| 12 | Payment and registration statuses | People → Registration history | Payment, your decision and enrollment are separate. A paid registration waits for *Confirm*; payment never enrolls by itself. |
| 13 | Participant progress | Cohort → Participation, Attendance | Who submitted each rep (never the contents). Attendance is a record only. |
| 14 | Completion and certificates | Cohort → Completion & certificates; Certificates | *Mark complete* records your decision; certificates only after that. *Close completion review* stops reminders for a cohort that won't get certificates.¹ Certificate signature: preview; turn on only after Tramaine approves. |
| 15 | Failed emails | Dashboard → *Open person* | *Resend with a new link* or *Mark as handled*. All emails: Security & activity → Email delivery. |
| 16 | Reports | Insights → Reports | Enrollment, completion, registrations, payments, inquiries; *Export CSV*. |
| 17 | Security and MFA | Security & activity | *Turn on two-step verification* (authenticator app). Make it required only after both admins enroll and test recovery. Activity log lists every change. |
| 18 | Getting help | Dashboard → *How do I…?* | Short steps with a link to the right page. |

¹ *Close completion review* is in the pending update on branch `feature/next-cohort-launch` (not yet in production).

**Never needed for day-to-day work:** Stripe dashboard, Vercel, Supabase. Online payments stay off until the owner approves turning them on.
