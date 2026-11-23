# Admin numbers: what each one means

Every number on the Dashboard and in Reports is counted from database records at the moment
the page loads. Nothing is estimated or typed in by hand. Code: `src/lib/admin-metrics.ts`
(tested in `tests/unit/admin.test.ts`).

## Enrollments
Enrollment records are never rewritten when a cohort ends; their outcome is worked out from the
enrollment status and the cohort status:

| Outcome | Rule |
|---|---|
| **In progress** | enrollment Active, cohort **Active** (running now) |
| **Starting soon** | enrollment Active, cohort **Upcoming** or **Draft** |
| **Completed** | enrollment Completed, **or** enrollment Active in a cohort that is **Completed** or **Archived** |
| **Withdrew** | enrollment Withdrawn (any cohort) |
| **Cohort cancelled** | enrollment Active in a **Cancelled** cohort |

**Seats taken** in a cohort = enrollments with status Active. This is what capacity is checked
against, in the database, so two people can never take the last seat at the same time.

## Dashboard
| Tile | Counts |
|---|---|
| Cohorts in progress | cohorts with status Active (subtext: Upcoming cohorts) |
| Active participants | distinct people, excluding administrators, enrolled (Active) in a cohort that is running now |
| Starting soon | distinct people, excluding administrators, enrolled in an Upcoming cohort |
| Open inquiries | inquiries not Converted or Closed |
| Follow-ups due | open inquiries whose follow-up date is today or earlier (New York date) |
| Registrations to review | registrations with status Pending (shown only when there are some, or when online registration is on) |

## Cohort availability (what visitors can do)
| Label | Meaning |
|---|---|
| Draft | not public; prepare sessions, reps and prompts |
| Enrollment closed | Upcoming, but online registration is off for the site or the pathway is closed; visitors are sent to the inquiry form |
| Open for registration | Upcoming, pathway open, online registration on, and a seat free |
| Full | every seat taken |
| In progress / Completed / Archived / Cancelled | the cohort's status |

## Dates and times
- Times (received, signed in, activity) are shown in **New York time (ET)**.
- Calendar dates (start, end, due, follow-up) are shown exactly as entered.
- "Today" means today's date in New York.
- CSV exports use the same rules; time columns say "(ET)".

## Public pathways
- A pathway unticked "Show on the Impact Lab page" disappears from the Impact Lab page, the
  registration page and the inquiry form. Its record, cohorts and history are kept.
- Prices are shown publicly only while the pathway is open for enrollment **and** online
  registration is switched on for the site.
- If the database cannot be reached, the Impact Lab page shows the approved default copy of all
  three pathways rather than an empty page (a hidden pathway could briefly reappear during such
  an outage).
