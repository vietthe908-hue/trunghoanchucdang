---
name: profile-auth-recovery
description: Use whenever a Supabase email/password app creates user profiles, approval workflows, or reports that sign-in succeeds but the profile cannot be found. Enforces durable profile creation, auth-to-profile ID matching, RLS-safe recovery, and clear user-facing errors.
---

# Profile Auth Recovery

Keep authentication and the application profile linked by the exact same `auth.users.id`. Never depend on a browser-side profile insert that can run before a session exists.

## Workflow

1. Create the profile from a trusted database trigger on `auth.users` using the new user ID and immutable authentication email. Read the display name from signup metadata and provide a safe fallback.
2. Add a security-definer recovery function that can create a missing profile for the currently authenticated user and return that profile. Require `auth.uid()` and never accept an arbitrary profile ID from the browser.
3. After sign-in, call the recovery function, then load the profile using the same authenticated user ID. Treat a missing row and a database error as different cases and show a useful message.
4. Keep profile RLS owner-scoped with `auth.uid() = id`. Do not weaken profile reads to public access just to hide an auth-flow bug.
5. Keep approval separate from authentication: a pending profile may sign in and view its profile, but protected actions must check `approval_status` server-side.
6. When an administrator approves or changes a role, update all related authorization fields consistently and verify the target row by ID.

## Done right

A new signup creates a profile even when email confirmation means no browser session exists yet. A returning user whose profile row is missing is repaired safely at sign-in, while another user's profile remains inaccessible.

Avoid silently converting every failed profile query into “not found”; preserve the database error so the user can distinguish an unavailable service, a missing profile, and invalid credentials.