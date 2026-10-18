# IndiumVault Earn — Admin tasks and rewards

Site: https://indiumvault.github.io/Indiumvault-earn/  
Repository: `indiumvault/Indiumvault-earn`  
Supabase project: `Indiumvault-earn` (`hprbcntedjrdowreqmak`)

## Create a task
1. Sign in to the website with the account that has admin access.
2. Open **Admin workspace → Create a task**.
3. Enter a clear title, step-by-step instructions, category, points and (optionally) an HTTP(S) task link.
4. Leave **Publish task** unchecked to save it as a draft, or check it to show it to users immediately.
5. Use **Edit**, **Pause**, or **Publish** in the task list to manage it later.

Only publish tasks that are legitimate, safe, clearly explained, and possible to verify. Do not ask users for passwords, verification codes, private documents, payment, or sensitive personal information.

## Create and manage a reward
1. In **Admin workspace → Create a reward**, enter the title, full description/fulfilment terms, point cost and reward type.
2. Keep **Make available for redemption** unchecked until you are sure you can fulfil it.
3. Use **Edit**, **Disable**, or **Enable** in the reward list.

**Important:** points are internal platform points, not money. A reward entry does not create a funded payout or a gift card. Do not advertise a reward you cannot supply. Cash withdrawals and automatic gift-card delivery are not enabled.

## Redemption workflow
1. A signed-in user requests an enabled reward.
2. The database checks the user's current ledger balance under a per-account lock, creates a pending request, and deducts the points in the same transaction.
3. A user cannot have two pending requests for the same reward. A rejected request is refunded automatically through the points ledger.
4. In **Admin workspace → Reward requests**, choose **Approve** or **Reject + refund** for a pending request.
5. After manually delivering a reward you can genuinely supply, use **Mark fulfilled** for an approved request. Approval alone does not mean delivery occurred.

Users can see their latest redemption statuses in **Your redemption history**. A reward request can remain pending until reviewed.

## Task submissions
Review the notes and proof in **Task review**. Approve only valid completions; the configured points are added once. Rejected task submissions do not receive points.

## Security and deployment notes
- Admin actions are database RPCs that verify the signed-in user against the private admin allowlist.
- The browser uses only the Supabase publishable key; never add a service-role key or secret to this repository.
- The main IndiumVault website repository is separate and must not be changed for this project.
- Database changes are tracked under `supabase/migrations/`.
- After commits, allow GitHub Pages to finish deploying, then refresh or reopen the site. The deploy status is available at [GitHub Actions](https://github.com/indiumvault/Indiumvault-earn/actions).
