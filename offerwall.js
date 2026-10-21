(() => {
  const button = document.getElementById("openOfferwall");
  const message = document.getElementById("offerwallMessage");
  const status = document.getElementById("offerwallStatus");
  const frame = document.getElementById("offerwallFrame");
  const placeholder = document.getElementById("offerwallPlaceholder");
  if (!button || !message || !frame || !placeholder) return;
  const config = window.INDIUMVAULT_SUPABASE;
  if (!config || !window.supabase) {
    message.textContent = "Offer feed could not initialize. Please refresh the page.";
    return;
  }
  const client = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "indiumvault-earn-auth-v1" }
  });
  let loading = false;
  let lastUserId = null;
  let fallbackTimer = null;
  function setStatus(text, state = "pending") {
    if (!status) return;
    const dot = status.querySelector(".status-dot");
    status.textContent = "";
    if (dot) status.appendChild(dot);
    status.appendChild(document.createTextNode(" " + text));
    status.classList.toggle("is-ready", state === "ready");
    status.classList.toggle("is-error", state === "error");
  }
  function showSignedOut() {
    lastUserId = null;
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
    frame.hidden = true;
    frame.removeAttribute("src");
    placeholder.hidden = false;
    placeholder.querySelector("b").textContent = "Your offers will appear here";
    placeholder.querySelector("p").textContent = "Sign in to securely load the partner feed for your account.";
    button.hidden = true;
    delete button.dataset.signedUrl;
    setStatus("Sign in to load your offers");
    message.classList.remove("error");
    message.textContent = "Your available offers depend on your country and provider eligibility.";
  }
  async function loadFeed(session) {
    if (!session?.user) { showSignedOut(); return; }
    if (loading || lastUserId === session.user.id) return;
    loading = true;
    lastUserId = session.user.id;
    frame.hidden = true;
    frame.removeAttribute("src");
    placeholder.hidden = false;
    placeholder.querySelector("b").textContent = "Loading your partner feed…";
    placeholder.querySelector("p").textContent = "Preparing a secure, account-linked offerwall.";
    button.hidden = true;
    setStatus("Loading offers");
    message.classList.remove("error");
    message.textContent = "Creating a secure one-hour link for your account…";
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error("Please sign in again to view offers.");
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
      if (!response.ok || !result.url) throw new Error(result.error || "The partner feed is not available right now.");
      const target = new URL(result.url);
      if (target.hostname !== "offerwall.me" || !target.pathname.startsWith("/offerwall/")) {
        throw new Error("The partner returned an unexpected offerwall address.");
      }
      frame.onload = () => {
        if (lastUserId !== session.user.id) return;
        placeholder.hidden = true;
        frame.hidden = false;
        button.hidden = false;
        setStatus("Partner offers loaded", "ready");
        message.classList.remove("error");
        message.textContent = "Browse the live partner feed below. The secure link expires after one hour.";
      };
      frame.src = target.toString();
      button.dataset.signedUrl = target.toString();
      fallbackTimer = window.setTimeout(() => {
        if (lastUserId === session.user.id && !placeholder.hidden) {
          button.hidden = false;
          placeholder.querySelector("b").textContent = "Having trouble loading offers?";
          placeholder.querySelector("p").textContent = "Open the partner feed in a full-screen page instead.";
          message.textContent = "If the embedded feed does not appear, use the full-screen option.";
        }
      }, 12000);
    } catch (error) {
      lastUserId = null;
      setStatus("Offer feed unavailable", "error");
      message.classList.add("error");
      message.textContent = error?.message || "Could not load offers. Please refresh and try again.";
      placeholder.hidden = false;
      placeholder.querySelector("b").textContent = "We couldn't load the offer feed";
      placeholder.querySelector("p").textContent = "Your account is safe. Try again in a moment.";
      button.hidden = true;
    } finally {
      loading = false;
    }
  }
  button.addEventListener("click", async () => {
    const signedUrl = button.dataset.signedUrl;
    if (signedUrl) window.open(signedUrl, "_blank", "noopener,noreferrer");
    else {
      const { data } = await client.auth.getSession();
      if (data.session) await loadFeed(data.session);
    }
  });
  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      setStatus("Could not check sign-in", "error");
      message.textContent = "Could not check your sign-in. Please refresh.";
      return;
    }
    loadFeed(data.session);
  });
  client.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) showSignedOut();
    else if (session.user.id !== lastUserId) loadFeed(session);
  });
})();