# Two-step verification for administrators: enforcement and recovery

## How it is enforced
1. **Admin pages** (`src/app/(portal)/admin/layout.tsx`): an admin with an authenticator must have
   entered a code this session. When the site setting is `required`, an admin without one is
   sent to `/admin-setup` and can do nothing else until it is set up.
2. **Server routes** (`requireAdmin()`): the same rule.
3. **The database** (`is_admin()`, migration 2d): every admin read and write is checked against the
   signed-in session's verified assurance level (the `aal` claim Supabase puts in the session
   token), not a profile flag. A stolen password alone cannot read or change admin data through
   the API once enforcement is on.

The site setting (database: `app_private.settings`, key `admin_mfa_mode`):

| Mode | Effect |
|---|---|
| `off` | current behaviour; no database check (shipped value) |
| `enrolled` | an admin who has an authenticator must use it; admins without one still work |
| `required` | every admin must sign in with a code; admins without one must set one up first |

## Activation checklist (do not skip steps)
1. Both administrators turn on two-step verification (Security & activity → Turn on two-step
   verification) and add the account to a second device or a syncing password manager.
2. Recovery is tested: admin A (signed in with a code) uses "Reset their two-step verification" for
   admin B; B signs in with password, is sent to set up a new authenticator, and completes it.
   Repeat in the other direction. (Each reset appears in the activity log.)
3. Security & activity shows both admins as "Two-step on".
4. The developer runs, in the Supabase SQL editor:
   ```sql
   update app_private.settings set value = '"required"', updated_at = now() where key = 'admin_mfa_mode';
   ```
5. Both admins sign out and back in (with their code) and confirm the admin portal works.

**Undo** (immediate, no deploy): set the value back to `"off"`.

## Recovery
- **One admin lost their phone:** the other admin signs in (with their code) → Security & activity
  → "Reset their two-step verification". The first admin signs in with their password and sets up
  a new authenticator. If the password is also lost, use "Send password email" on their record.
- **Both admins locked out:** the developer, in the Supabase dashboard, removes the factor
  (Authentication → Users → user → MFA factors) or temporarily sets the mode to `"off"`.
- Never send codes or setup keys by email or text.
