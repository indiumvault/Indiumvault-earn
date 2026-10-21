(() => {
  const button = document.getElementById("openOfferwall");
  const message = document.getElementById("offerwallMessage");
  if (!button || !message) return;
  const config = window.INDIUMVAULT_SUPABASE;
  if (!config || !window.supabase) return;

  const client = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "indiumvault-earn-auth-v1" }
  });

  function showSignedIn(session) {
    button.hidden = !session?.user;
    if (!session?.user) message.textContent = "Sign in to open verified offers.";
    else if (!message.classList.contains("error")) message.textContent = "Each offerwall link is signed for your account and expires after one hour.";
  }
  client.auth.getSession().then(({data, error}) => {
    if (error) {
      message.textContent = "Could not check your sign-in. Please refresh.";
      message.classList.add("error");
      return;
    }
    showSignedIn(data.session);
  });
  client.auth.onAuthStateChange((_event, session) => showSignedIn(session));

  button.addEventListener("click", async () => {
    const popup = window.open("about:blank", "_blank");
    if (popup) {
      try { popup.opener = null; } catch {}
      try { popup.document.title = "Opening IndiumVault offers…"; popup.document.body.textContent = "Preparing a secure, temporary offerwall link…"; } catch {}
    }
    button.disabled = true;
    button.textContent = "Preparing…";
    message.classList.remove("error");
    message.textContent = "Preparing a secure offerwall link…";
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error("Please sign in again before opening offers.");
      const response = await fetch(config.url + "/functions/v1/offerwall-signed-url", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + sessionData.session.access_token,
          "apikey": config.anonKey,
          "Content-Type": "application/json"
        },
        body: "{}"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) throw new Error(result.error || "Secure offerwall setup is not finished yet.");
      if (popup && !popup.closed) popup.location.replace(result.url);
      else window.location.assign(result.url);
      message.textContent = "Secure link created. It expires in one hour.";
    } catch (error) {
      if (popup && !popup.closed) popup.close();
      message.classList.add("error");
      message.textContent = error?.message || "Could not open offers. Please try again.";
    } finally {
      button.disabled = false;
      button.textContent = "Open verified offers";
    }
  });
})();