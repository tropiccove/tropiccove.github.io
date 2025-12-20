(() => {
  const createClient = globalThis.supabase?.createClient;
  const supabaseUrl = globalThis.TC_SUPABASE_URL;
  const supabaseAnonKey = globalThis.TC_SUPABASE_ANON_KEY;

  const authModalEl = document.getElementById("authModal");
  const authForm = document.getElementById("authForm");
  const authAlert = document.getElementById("authAlert");
  const authEmail = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");

  if (!authModalEl || !authForm || !authAlert || !authEmail || !authPassword) return;

  const showAlert = (message) => {
    authAlert.textContent = message;
    authAlert.classList.remove("d-none");
  };

  const hideAlert = () => {
    authAlert.textContent = "";
    authAlert.classList.add("d-none");
  };

  const params = new URLSearchParams(window.location.search);
  const shouldShow = params.get("signin") === "1";
  const next = params.get("next");

  if (!createClient || !supabaseUrl || !supabaseAnonKey) {
    if (shouldShow) {
      showAlert("Supabase is not configured.");
      const Modal = window.bootstrap?.Modal;
      if (Modal) Modal.getOrCreateInstance(authModalEl).show();
    }
    return;
  }

  const supabase = createClient(String(supabaseUrl), String(supabaseAnonKey));

  const isEmailAllowed = (email) => {
    const allowed = globalThis.TC_SUPABASE_ALLOWED_EMAILS;
    if (!allowed) return true;
    if (!Array.isArray(allowed)) return true;
    if (!email) return false;
    return allowed.map((e) => String(e).toLowerCase()).includes(String(email).toLowerCase());
  };

  const redirectToNext = () => {
    if (next === "booking") window.location.href = "booking.html";
  };

  const Modal = window.bootstrap?.Modal;
  const showModal = () => {
    if (!Modal) return;
    hideAlert();
    authForm.classList.remove("was-validated");
    Modal.getOrCreateInstance(authModalEl).show();
    authEmail.focus();
  };

  if (shouldShow) showModal();

  authModalEl.addEventListener("hidden.bs.modal", () => {
    hideAlert();
    authForm.classList.remove("was-validated");
    authForm.reset();
  });

  (async () => {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user && isEmailAllowed(data.session.user.email)) redirectToNext();
  })().catch(() => {});

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert();
    authForm.classList.add("was-validated");

    const email = String(authEmail.value ?? "").trim();
    const password = String(authPassword.value ?? "");
    if (!email || !password) return;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!isEmailAllowed(data?.user?.email)) {
        await supabase.auth.signOut();
        throw new Error("Not authorized.");
      }
      redirectToNext();
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Sign-in failed.");
    }
  });
})();

