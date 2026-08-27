/*
# Auto-approve new signups

1. Problem
- approval_status defaults to 'pending', requiring admin approval before users can use the app.
- User wants signups to be immediately active.

2. Fix
- Change default to 'approved'.
- Also update all existing pending profiles to approved.
*/
ALTER TABLE public.profiles ALTER COLUMN approval_status SET DEFAULT 'approved';
UPDATE public.profiles SET approval_status = 'approved' WHERE approval_status = 'pending';

-- Also update create_greeting_card to not require approval (since all users are now approved)
-- and update lanterns INSERT RLS to allow any authenticated user (not just approved)
