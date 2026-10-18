# Admin setup — IndiumVault Earn

The review backend is installed in the **Indiumvault-earn** Supabase project. The admin panel stays hidden unless the signed-in account is explicitly allowlisted in the private `private.admin_users` table. A normal user cannot add themselves or approve submissions.

## Give your own account administrator access

1. Open the site and create/sign in to the account you want to use as administrator: https://indiumvault.github.io/Indiumvault-earn/
2. Open the correct Supabase project: https://supabase.com/dashboard/project/hprbcntedjrdowreqmak/sql/new
3. Run the following SQL, replacing `YOUR_SIGNUP_EMAIL@example.com` with the exact email used for your site account:

```sql
insert into private.admin_users (user_id)
select id
from auth.users
where lower(email) = lower('YOUR_SIGNUP_EMAIL@example.com')
on conflict (user_id) do nothing;
```

4. If it reports `INSERT 0 0`, confirm that you created the account and that the email matches. Do not share your password or verification code.
5. Refresh the website and sign in again. The **Task review** panel should appear. If your session is old, sign out and back in.

## Security model

- The private admin allowlist is not granted to browser roles.
- Review RPCs check the authenticated user ID against the allowlist on every call.
- A review locks the submission row and only accepts `pending` submissions.
- Approval, status update, and point ledger insert occur in one database transaction.
- A unique index prevents a second ledger award for the same submission.
- The browser uses only the publishable key; no service-role or secret key is stored in GitHub.
- This setup tracks points only. It does **not** enable cash withdrawals, gift-card fulfillment, or guarantee that tasks have monetary value.

Only grant admin access to accounts you control. Remove access by deleting that user's row from `private.admin_users` in the Supabase SQL editor.
