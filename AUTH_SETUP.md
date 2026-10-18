# IndiumVault Earn — account setup

The website is hosted as a static GitHub Pages site. Supabase Auth provides email/password accounts; GitHub Pages itself does not provide authentication.

## 1. Create or choose a Supabase project
1. Sign in to [Supabase](https://supabase.com/) and create a project on the free plan, or use a project you control.
2. Open the project's **Connect** or **API Keys** settings.
3. Copy the **Project URL** and the **publishable key** (or legacy `anon` public key). Never use a `service_role` key or any secret key in this website.

## 2. Configure the website
1. In this repository, open `config.js` and tap the edit/pencil icon.
2. Replace `https://YOUR_PROJECT_ID.supabase.co` with your Project URL.
3. Replace `PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE` with the publishable/anon key.
4. Commit the change to the **Indiumvault-earn** repository only.
5. In Supabase, open **Authentication → URL Configuration**. Set the Site URL to:
   `https://indiumvault.github.io`
6. Add this Redirect URL:
   `https://indiumvault.github.io/Indiumvault-earn/**`
7. In **Authentication → Sign In / Providers**, ensure Email is enabled. Keep email verification enabled if available.

## 3. Test
Open https://indiumvault.github.io/Indiumvault-earn/, tap the round profile button, create an account using an email you can access, and follow the verification email if requested. Then sign in.

## Security and current limitations
- The publishable/anon key is intended for browser use; it is not a password. Never publish a service-role or secret key.
- Do not add user balances, private profile information, or payout data to a public database until appropriate database tables and Row Level Security (RLS) policies are designed and tested.
- This version only authenticates users. Demo points and sample tasks remain fictional and reset on refresh; they are not tied to accounts and have no cash value.
- Never ask users to send you their passwords or email verification codes.
- Keep changes inside this repository. The main IndiumVault website is separate.
