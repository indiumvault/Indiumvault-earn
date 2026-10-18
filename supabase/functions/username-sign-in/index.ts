import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "https://indiumvault.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });
  try {
    const { identifier, password, captchaToken } = await req.json();
    if (typeof identifier !== "string" || typeof password !== "string" || identifier.trim().length < 2 || identifier.trim().length > 254 || password.length < 1 || password.length > 1024) {
      return new Response(JSON.stringify({ error: "Enter a valid username/email and password." }), { status: 400, headers: cors });
    }
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return new Response(JSON.stringify({ error: "Username login is not configured yet." }), { status: 503, headers: cors });
    const value = identifier.trim();
    let email = value;
    if (!value.includes("@")) {
      if (!/^[A-Za-z0-9_.-]{2,24}$/.test(value)) return new Response(JSON.stringify({ error: "Invalid username/email or password." }), { status: 401, headers: cors });
      const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: profile, error: profileError } = await admin.from("account_profiles").select("user_id").ilike("username", value).maybeSingle();
      if (profileError || !profile) return new Response(JSON.stringify({ error: "Invalid username/email or password." }), { status: 401, headers: cors });
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.user_id);
      if (userError || !userData.user?.email) return new Response(JSON.stringify({ error: "Invalid username/email or password." }), { status: 401, headers: cors });
      email = userData.user.email;
    }
    const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email, password, options: { captchaToken } });
    if (error || !data.session || !data.user) return new Response(JSON.stringify({ error: "Invalid username/email or password." }), { status: 401, headers: cors });
    return new Response(JSON.stringify({ session: data.session, user: data.user }), { status: 200, headers: cors });
  } catch {
    return new Response(JSON.stringify({ error: "Could not sign in. Please try again." }), { status: 400, headers: cors });
  }
});