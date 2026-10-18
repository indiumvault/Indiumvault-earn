# Account identity upgrade — implementation notes

This change adds a protected account profile table and numeric support UIDs for IndiumVault Earn.

## Important status
This migration is prepared on the `feature/username-numeric-uid` branch. It is **not live** until reviewed, merged, and applied to the Supabase project `hprbcntedjrdowreqmak`.

## UID policy
- Existing administrator auth UUID `8205d1e2-ffa9-4a26-8708-b625d96ec7b4` is assigned support UID `55555` by the migration.
- Other accounts receive a random 6-digit numeric UID (100000–999999).
- If every 6-digit UID is occupied, generation switches to 7-digit UIDs. The database unique constraint prevents duplicates.
- The internal Supabase Auth UUID remains the canonical foreign key for account ownership, balances, submissions, and permissions.
- A UID is only a support reference; it must never grant access or authenticate a user.

## Username policy
- Username is optional for existing accounts and can be set after the migration.
- Usernames are 2–24 characters: letters, numbers, dot, underscore, hyphen.
- Username uniqueness is case-insensitive.
- `set_my_username` validates the current signed-in account and reports duplicate usernames safely.

## Apply and test
1. Review the migration file in this branch.
2. Apply it using the SQL Editor for the correct Supabase project only.
3. Confirm the administrator profile row has support UID `55555`.
4. Test that a new account gets a unique 6-digit UID, duplicate usernames are rejected, and one user cannot update another user's profile.
5. Keep the existing account's auth UUID unchanged.

## Not included yet
This migration alone does not enable username/password sign-in, Google OAuth, or Discord OAuth. Username sign-in must be implemented with a secure server-side lookup that does not expose email addresses to anonymous visitors. Google/Discord require provider application credentials in Supabase Auth settings. Do not put OAuth client secrets or service-role keys in GitHub Pages.
