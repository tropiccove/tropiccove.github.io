(() => {
  const STORAGE_KEY = "tropicCove.reservations.v1";
  const STATUS_VALUES = new Set(["reserved", "partial"]);
  const SOURCE_VALUES = new Set(["airbnb", "facebook", "agoda", "other", ""]);
  const CHECK_IN_TIME = "14:00";
  const CHECK_OUT_TIME = "12:00";
  const SUPABASE_TABLE = "reservations";

  const reservationTbody = document.getElementById("reservationTbody");
  const reservationForm = document.getElementById("reservationForm");
  const formAlert = document.getElementById("formAlert");
  const formTitle = document.getElementById("formTitle");
  const submitBtn = document.getElementById("submitBtn");
  const submitLabel = document.getElementById("submitLabel");
  const submitIcon = document.getElementById("submitIcon");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const reservationFormModalEl = document.getElementById("reservationFormModal");
  const addReservationBtn = document.getElementById("addReservationBtn");
  const exportBtn = document.getElementById("exportBtn");
  const searchInput = document.getElementById("search");
  const scheduleFilter = document.getElementById("scheduleFilter");
  const calendarGrid = document.getElementById("calendarGrid");
  const calendarMonthLabel = document.getElementById("calendarMonthLabel");
  const prevMonthBtn = document.getElementById("prevMonthBtn");
  const nextMonthBtn = document.getElementById("nextMonthBtn");
  const calendarDayModalEl = document.getElementById("calendarDayModal");
  const calendarDayTitle = document.getElementById("calendarDayTitle");
  const calendarDayList = document.getElementById("calendarDayList");
  const bookingApp = document.getElementById("bookingApp");
  const authGate = document.getElementById("authGate");
  const authUser = document.getElementById("authUser");
  const signInBtn = document.getElementById("signInBtn");
  const signInBtnGate = document.getElementById("signInBtnGate");
  const signOutBtn = document.getElementById("signOutBtn");
  const detailsDeleteBtn = document.getElementById("detailsDeleteBtn");
  const confirmModalEl = document.getElementById("confirmModal");
  const confirmModalTitle = document.getElementById("confirmModalTitle");
  const confirmModalBody = document.getElementById("confirmModalBody");
  const confirmModalConfirmBtn = document.getElementById("confirmModalConfirmBtn");
  const dateSummary = document.getElementById("dateSummary");
  const detailSummary = document.getElementById("detailSummary");

  if (
    !reservationTbody ||
    !reservationForm ||
    !formAlert ||
    !formTitle ||
    !submitBtn ||
    !submitLabel ||
    !submitIcon ||
    !cancelEditBtn ||
    !reservationFormModalEl ||
    !addReservationBtn ||
    !exportBtn ||
    !searchInput ||
    !scheduleFilter ||
    !calendarGrid ||
    !calendarMonthLabel ||
    !prevMonthBtn ||
    !nextMonthBtn ||
    !calendarDayModalEl ||
    !calendarDayTitle ||
    !calendarDayList ||
    !bookingApp ||
    !authGate ||
    !authUser ||
    !signInBtn ||
    !signInBtnGate ||
    !signOutBtn ||
    !detailsDeleteBtn ||
    !confirmModalEl ||
    !confirmModalTitle ||
    !confirmModalBody ||
    !confirmModalConfirmBtn ||
    !dateSummary ||
    !detailSummary
  ) {
    return;
  }

  const state = {
    reservations: [],
    query: "",
    scheduleFilter: "upcoming",
    editingId: null,
    calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    atlas: {
      enabled: false,
      app: null,
      user: null,
      collection: null,
      syncInFlight: false,
      pollTimer: null,
    },
    supabase: {
      client: null,
      user: null,
      pollTimer: null,
      syncInFlight: false,
    },
    ui: {
      detailsId: null,
      calendarDayIso: null,
    },
  };

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const normalizeDate = (date) => {
    const str = String(date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
    return str;
  };

  const parseLocalDateTimeToMs = (value) => {
    const str = String(value ?? "").trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(str);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    const date = new Date(year, month - 1, day, hour, minute, 0, 0);
    const ms = date.getTime();
    if (!Number.isFinite(ms)) return null;
    return ms;
  };

  const dateAndTimeToLocalMs = (date, time) => parseLocalDateTimeToMs(`${date}T${time}`);

  const parseCheckInOut = ({ checkInDate, checkOutDate }) => {
    const normalizedCheckInDate = normalizeDate(checkInDate);
    const normalizedCheckOutDate = normalizeDate(checkOutDate);
    if (!normalizedCheckInDate || !normalizedCheckOutDate) return null;
    const checkInMs = dateAndTimeToLocalMs(normalizedCheckInDate, CHECK_IN_TIME);
    const checkOutMs = dateAndTimeToLocalMs(normalizedCheckOutDate, CHECK_OUT_TIME);
    if (checkInMs == null || checkOutMs == null) return null;
    return {
      checkInDate: normalizedCheckInDate,
      checkOutDate: normalizedCheckOutDate,
      checkInMs,
      checkOutMs,
    };
  };

  const nightsBetween = (checkInDate, checkOutDate) => {
    const normalizedIn = normalizeDate(checkInDate);
    const normalizedOut = normalizeDate(checkOutDate);
    if (!normalizedIn || !normalizedOut) return null;
    const inMs = dateAndTimeToLocalMs(normalizedIn, "00:00");
    const outMs = dateAndTimeToLocalMs(normalizedOut, "00:00");
    if (inMs == null || outMs == null) return null;
    const diffDays = Math.round((outMs - inMs) / (24 * 60 * 60 * 1000));
    if (!Number.isFinite(diffDays) || diffDays < 0) return null;
    return diffDays;
  };

  const parseFee = (fee) => {
    const trimmed = String(fee ?? "").trim();
    if (!trimmed) return null;
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * 100) / 100;
  };

  const parseAmount = (amount) => {
    const trimmed = String(amount ?? "").trim();
    if (!trimmed) return null;
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * 100) / 100;
  };

  const formatFee = (fee) => {
    if (fee == null) return "-";
    if (!Number.isFinite(fee)) return "-";
    try {
      return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(fee);
    } catch {
      return `PHP ${fee.toFixed(2)}`;
    }
  };

  const formatAmount = (amount) => {
    if (amount == null) return "-";
    if (!Number.isFinite(amount)) return "-";
    try {
      return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
    } catch {
      return `PHP ${amount.toFixed(2)}`;
    }
  };

  const formatStatus = (status) => {
    if (status === "reserved") return "Reserved";
    if (status === "partial") return "Partial";
    return "Unknown";
  };

  const statusBadgeClass = (status) => {
    if (status === "reserved") return "text-bg-success";
    if (status === "partial") return "text-bg-warning";
    return "text-bg-secondary";
  };

  const formatDate = (date) => {
    const normalized = normalizeDate(date);
    if (!normalized) return "-";
    try {
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }).format(new Date(`${normalized}T00:00`));
    } catch {
      return normalized;
    }
  };

  const formatDateWithWeekday = (date) => {
    const normalized = normalizeDate(date);
    if (!normalized) return "-";
    try {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "2-digit",
      }).format(new Date(`${normalized}T00:00`));
    } catch {
      return normalized;
    }
  };

  const hideDateSummary = () => {
    dateSummary.textContent = "";
    dateSummary.classList.add("d-none");
  };

  const updateDateSummary = () => {
    const checkIn = document.getElementById("checkInDate");
    const checkOut = document.getElementById("checkOutDate");
    if (!(checkIn instanceof HTMLInputElement) || !(checkOut instanceof HTMLInputElement)) return;

    const parsedRange = parseCheckInOut({ checkInDate: checkIn.value, checkOutDate: checkOut.value });
    if (!parsedRange || parsedRange.checkOutMs <= parsedRange.checkInMs) {
      hideDateSummary();
      return;
    }

    const nights = nightsBetween(parsedRange.checkInDate, parsedRange.checkOutDate);
    const nightsLabel = nights === 1 ? "1 night" : `${nights ?? "-"} nights`;
    dateSummary.textContent = `${formatDateWithWeekday(parsedRange.checkInDate)} 2:00 PM \u2192 ${formatDateWithWeekday(parsedRange.checkOutDate)} 12:00 PM (${nightsLabel})`;
    dateSummary.classList.remove("d-none");
  };

  const getMinCheckInIso = () => {
    const todayIso = toIsoDateLocal(new Date());
    return addDaysIso(todayIso, 1);
  };

  const enforceDateMins = () => {
    const checkIn = document.getElementById("checkInDate");
    const checkOut = document.getElementById("checkOutDate");
    if (!(checkIn instanceof HTMLInputElement) || !(checkOut instanceof HTMLInputElement)) return;

    const minCheckIn = state.editingId ? null : getMinCheckInIso();
    if (minCheckIn) {
      checkIn.min = minCheckIn;
      if (normalizeDate(checkIn.value) && checkIn.value < minCheckIn) checkIn.value = minCheckIn;
    } else {
      checkIn.removeAttribute("min");
    }

    const normalizedCheckIn = normalizeDate(checkIn.value) ?? minCheckIn ?? null;
    const minCheckOut = normalizedCheckIn ? addDaysIso(normalizedCheckIn, 1) : null;
    if (minCheckOut) {
      checkOut.min = minCheckOut;
      if (normalizeDate(checkOut.value) && checkOut.value < minCheckOut) checkOut.value = minCheckOut;
    } else {
      checkOut.removeAttribute("min");
    }
  };

  const enforceNotReservedDates = () => {
    const checkIn = document.getElementById("checkInDate");
    const checkOut = document.getElementById("checkOutDate");
    if (!(checkIn instanceof HTMLInputElement) || !(checkOut instanceof HTMLInputElement)) return;

    const ignoreId = state.editingId;

    const normalizedCheckIn = normalizeDate(checkIn.value);
    if (normalizedCheckIn) {
      const nextFree = nextAvailableDate(normalizedCheckIn, ignoreId);
      if (nextFree && nextFree !== normalizedCheckIn) {
        checkIn.value = nextFree;
      }
    }

    const normalizedAfter = normalizeDate(checkIn.value);
    if (!normalizedAfter) return;

    const minCheckOut = addDaysIso(normalizedAfter, 1);
    if (minCheckOut && (!normalizeDate(checkOut.value) || checkOut.value < minCheckOut)) {
      checkOut.value = minCheckOut;
    }

    for (let guard = 0; guard < 50; guard += 1) {
      const parsedRange = parseCheckInOut({ checkInDate: checkIn.value, checkOutDate: checkOut.value });
      if (!parsedRange) return;
      if (parsedRange.checkOutMs <= parsedRange.checkInMs) return;

      const overlap = findOverlappingReservation({
        checkInMs: parsedRange.checkInMs,
        checkOutMs: parsedRange.checkOutMs,
        ignoreId,
      });
      if (!overlap) return;

      const overlapStart = normalizeDate(overlap.checkInDate);
      if (overlapStart && overlapStart > parsedRange.checkInDate) {
        if (checkOut.value !== overlapStart) checkOut.value = overlapStart;
        continue;
      }

      const nextStart = normalizeDate(overlap.checkOutDate);
      if (!nextStart) return;
      checkIn.value = nextStart;
      const nextMinOut = addDaysIso(nextStart, 1);
      checkOut.value = nextMinOut ?? "";
    }
  };

  const updateDateValidity = () => {
    const checkIn = document.getElementById("checkInDate");
    const checkOut = document.getElementById("checkOutDate");
    if (!(checkIn instanceof HTMLInputElement) || !(checkOut instanceof HTMLInputElement)) return;

    checkIn.setCustomValidity("");
    checkOut.setCustomValidity("");

    const ignoreId = state.editingId;
    const normalizedCheckIn = normalizeDate(checkIn.value);
    if (normalizedCheckIn && findReservationBlockingDate(normalizedCheckIn, ignoreId)) {
      checkIn.setCustomValidity("This date is already reserved.");
    }

    const parsedRange = parseCheckInOut({ checkInDate: checkIn.value, checkOutDate: checkOut.value });
    if (!parsedRange) return;

    if (
      overlapsExisting({
        checkInMs: parsedRange.checkInMs,
        checkOutMs: parsedRange.checkOutMs,
        ignoreId,
      })
    ) {
      checkOut.setCustomValidity("This date range overlaps an existing reservation.");
    }
  };

  const updateSubmitEnabled = () => {
    const statusChoice = reservationForm.querySelector('input[name="status"]:checked');
    const checkIn = document.getElementById("checkInDate");
    const checkOut = document.getElementById("checkOutDate");
    if (!(checkIn instanceof HTMLInputElement) || !(checkOut instanceof HTMLInputElement)) return;

    const status = String(statusChoice?.value ?? "").trim();
    const parsedRange = parseCheckInOut({ checkInDate: checkIn.value, checkOutDate: checkOut.value });

    let ok = Boolean(status && parsedRange && parsedRange.checkOutMs > parsedRange.checkInMs);

    if (ok && !state.editingId) {
      const minCheckIn = getMinCheckInIso();
      if (minCheckIn && parsedRange.checkInDate < minCheckIn) ok = false;
    }

    if (ok && parsedRange) {
      if (
        overlapsExisting({
          checkInMs: parsedRange.checkInMs,
          checkOutMs: parsedRange.checkOutMs,
          ignoreId: state.editingId,
        })
      ) {
        ok = false;
      }
    }

    submitBtn.disabled = !ok;
  };

  const formatSource = (source) => {
    switch (source) {
      case "airbnb":
        return "Airbnb";
      case "facebook":
        return "Facebook";
      case "agoda":
        return "Agoda";
      case "other":
        return "Other";
      default:
        return "-";
    }
  };

  const escapeCsv = (value) => {
    const text = String(value ?? "");
    if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
  };

  const makeUuidV4 = () => {
    const cryptoObj = globalThis.crypto;
    if (!cryptoObj?.getRandomValues) return null;
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const toHex = (n) => n.toString(16).padStart(2, "0");
    const hex = Array.from(bytes, toHex).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  const makeId = () => {
    const randomUUID = globalThis.crypto?.randomUUID?.();
    if (randomUUID) return randomUUID;
    const uuid = makeUuidV4();
    if (uuid) return uuid;
    // Last resort (may not match Supabase uuid columns).
    return `r_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  const toIsoDateLocal = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const addDaysIso = (isoDate, days) => {
    const normalized = normalizeDate(isoDate);
    if (!normalized) return null;
    const ms = dateAndTimeToLocalMs(normalized, "00:00");
    if (ms == null) return null;
    const date = new Date(ms);
    date.setDate(date.getDate() + days);
    return toIsoDateLocal(date);
  };

  const isDateInStay = (reservation, isoDate) => {
    const checkIn = normalizeDate(reservation.checkInDate);
    const checkOut = normalizeDate(reservation.checkOutDate);
    const day = normalizeDate(isoDate);
    if (!checkIn || !checkOut || !day) return false;
    return day >= checkIn && day < checkOut;
  };

  const reservationIntersectsMonth = (reservation, monthStartIso, monthEndIso) => {
    const checkIn = normalizeDate(reservation.checkInDate);
    const checkOut = normalizeDate(reservation.checkOutDate);
    if (!checkIn || !checkOut) return false;
    return checkIn < monthEndIso && checkOut > monthStartIso;
  };

  const buildMonthColorMap = (monthStartIso, monthEndIso) => {
    const ids = state.reservations
      .filter((r) => reservationIntersectsMonth(r, monthStartIso, monthEndIso))
      .slice()
      .sort((a, b) => {
        const aStart = String(a.checkInDate ?? "");
        const bStart = String(b.checkInDate ?? "");
        if (aStart !== bStart) return aStart.localeCompare(bStart);
        return String(a.id ?? "").localeCompare(String(b.id ?? ""));
      })
      .map((r) => String(r.id))
      .filter(Boolean);

    const uniqueIds = Array.from(new Set(ids));
    const map = new Map();

    // Golden-angle palette: ensures unique hues per month (no repeats).
    const goldenAngle = 137.508;
    for (let index = 0; index < uniqueIds.length; index += 1) {
      const hue = (index * goldenAngle) % 360;
      map.set(uniqueIds[index], `hsl(${hue.toFixed(1)} 75% 45%)`);
    }

    return map;
  };

  const showAlert = (message) => {
    formAlert.textContent = message;
    formAlert.classList.remove("d-none");
  };

  const hideAlert = () => {
    formAlert.textContent = "";
    formAlert.classList.add("d-none");
  };

  const setAppVisibility = (isAuthed) => {
    if (isAuthed) {
      authGate.classList.add("d-none");
      bookingApp.classList.remove("d-none");
      signInBtn.classList.add("d-none");
      signInBtnGate.classList.add("d-none");
      signOutBtn.classList.remove("d-none");
      authUser.classList.remove("d-none");
      addReservationBtn.classList.remove("d-none");
      exportBtn.classList.remove("d-none");
    } else {
      bookingApp.classList.add("d-none");
      authGate.classList.remove("d-none");
      signOutBtn.classList.add("d-none");
      signInBtn.classList.remove("d-none");
      signInBtnGate.classList.remove("d-none");
      authUser.classList.add("d-none");
      addReservationBtn.classList.add("d-none");
      exportBtn.classList.add("d-none");
    }
  };

  const isEmailAllowed = (email) => {
    const allowed = globalThis.TC_SUPABASE_ALLOWED_EMAILS;
    if (!allowed) return true;
    if (!Array.isArray(allowed)) return true;
    if (!email) return false;
    return allowed.map((e) => String(e).toLowerCase()).includes(String(email).toLowerCase());
  };

  const redirectToHomeForAuth = () => {
    const url = new URL("index.html", window.location.href);
    url.searchParams.set("signin", "1");
    url.searchParams.set("next", "booking");
    window.location.replace(url.toString());
  };

  const setEditingMode = (reservation) => {
    if (reservation) {
      state.editingId = String(reservation.id);
      formTitle.textContent = "Edit reservation";
      submitLabel.textContent = "Save";
      submitIcon.className = "bi bi-check-lg me-1";
      cancelEditBtn.classList.remove("d-none");
      return;
    }

    state.editingId = null;
    formTitle.textContent = "Add reservation";
    submitLabel.textContent = "Add";
    submitIcon.className = "bi bi-plus-lg me-1";
    cancelEditBtn.classList.add("d-none");
  };

  const setFormFromReservation = (reservation) => {
    const statusReserved = document.getElementById("statusReserved");
    const statusPartial = document.getElementById("statusPartial");
    const checkInDate = document.getElementById("checkInDate");
    const checkOutDate = document.getElementById("checkOutDate");
    const fee = document.getElementById("fee");
    const amount = document.getElementById("amount");
    const source = document.getElementById("source");
    const guest = document.getElementById("guest");
    const notes = document.getElementById("notes");

    if (
      !(statusReserved instanceof HTMLInputElement) ||
      !(statusPartial instanceof HTMLInputElement) ||
      !(checkInDate instanceof HTMLInputElement) ||
      !(checkOutDate instanceof HTMLInputElement) ||
      !(fee instanceof HTMLInputElement) ||
      !(amount instanceof HTMLInputElement) ||
      !(source instanceof HTMLSelectElement) ||
      !(guest instanceof HTMLInputElement) ||
      !(notes instanceof HTMLTextAreaElement)
    ) {
      return;
    }

    const normalizedStatus =
      reservation.status === "not_reserved" ? "partial" : String(reservation.status ?? "").trim();
    statusReserved.checked = normalizedStatus === "reserved";
    statusPartial.checked = normalizedStatus === "partial";
    checkInDate.value = reservation.checkInDate ?? "";
    checkOutDate.value = reservation.checkOutDate ?? "";
    fee.value = reservation.fee == null ? "" : String(reservation.fee);
    amount.value = reservation.amount == null ? "" : String(reservation.amount);
    source.value = reservation.source ?? "";
    guest.value = reservation.guest ?? "";
    notes.value = reservation.notes ?? "";
    enforceDateMins();
    enforceNotReservedDates();
    updateDateSummary();
    updateDateValidity();
    updateSubmitEnabled();
  };

  const saveLocal = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.reservations));
    } catch {
      // Ignore storage failures (private mode, quota, etc).
    }
  };

  const normalizeReservation = (raw) => {
    let status = String(raw?.status ?? "reserved").trim();
    if (status === "not_reserved") status = "partial";
    const source = String(raw?.source ?? "").trim();
    const fee = parseFee(raw?.fee);
    const amount = parseAmount(raw?.amount ?? raw?.bookingAmount);
    if (!STATUS_VALUES.has(status)) return null;
    if (!SOURCE_VALUES.has(source)) return null;

    const checkInDateRaw = String(raw?.checkInDate ?? "").trim();
    const checkOutDateRaw = String(raw?.checkOutDate ?? "").trim();

    const startDateTimeRaw = String(raw?.startDateTime ?? "").trim();
    const endDateTimeRaw = String(raw?.endDateTime ?? "").trim();

    const fallbackDate = String(raw?.date ?? "").trim();
    const fallbackStart = String(raw?.start ?? "").trim();
    const fallbackEnd = String(raw?.end ?? "").trim();

    const normalizedStartDateTime =
      startDateTimeRaw ||
      (fallbackDate && fallbackStart ? `${fallbackDate}T${fallbackStart}` : "");
    const normalizedEndDateTime =
      endDateTimeRaw ||
      (fallbackDate && fallbackEnd ? `${fallbackDate}T${fallbackEnd}` : "");

    const checkInDate =
      normalizeDate(checkInDateRaw) ??
      (normalizedStartDateTime ? normalizeDate(normalizedStartDateTime.split("T")[0]) : null);
    const checkOutDate =
      normalizeDate(checkOutDateRaw) ??
      (normalizedEndDateTime ? normalizeDate(normalizedEndDateTime.split("T")[0]) : null);

    const parsedRange = parseCheckInOut({ checkInDate, checkOutDate });
    if (!parsedRange) return null;
    if (parsedRange.checkOutMs <= parsedRange.checkInMs) return null;

    return {
      id: String(raw?.id ?? raw?._id ?? makeId()),
      status,
      checkInDate: parsedRange.checkInDate,
      checkOutDate: parsedRange.checkOutDate,
      fee,
      amount,
      source,
      guest: String(raw?.guest ?? "").trim(),
      notes: String(raw?.notes ?? "").trim(),
      createdAt: String(raw?.createdAt ?? new Date().toISOString()),
    };
  };

  const loadLocal = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      state.reservations = parsed.map(normalizeReservation).filter(Boolean);
    } catch {
      // Ignore.
    }
  };

  const initSupabase = () => {
    const createClient = globalThis.supabase?.createClient;
    const url = globalThis.TC_SUPABASE_URL;
    const key = globalThis.TC_SUPABASE_ANON_KEY;
    if (!createClient || !url || !key) return false;
    try {
      state.supabase.client = createClient(String(url), String(key));
      return true;
    } catch {
      return false;
    }
  };

  const refreshFromSupabase = async () => {
    if (!state.supabase.client) return;
    if (state.supabase.syncInFlight) return;
    state.supabase.syncInFlight = true;
    try {
      const { data, error } = await state.supabase.client
        .from(SUPABASE_TABLE)
        .select("*")
        .order("checkInDate", { ascending: true });
      if (error) throw error;
      state.reservations = (data ?? []).map((row) => normalizeReservation(row)).filter(Boolean);
      sortReservations(state.reservations);
      saveLocal();
      render();
      renderCalendar();
    } catch {
      // Keep local cache.
    } finally {
      state.supabase.syncInFlight = false;
    }
  };

  const upsertSupabaseReservation = async (reservation) => {
    if (!state.supabase.client) return;
    const payload = {
      id: String(reservation.id),
      status: reservation.status,
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      fee: reservation.fee ?? null,
      amount: reservation.amount ?? null,
      source: reservation.source ?? "",
      guest: reservation.guest ?? "",
      notes: reservation.notes ?? "",
      createdAt: reservation.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const { error } = await state.supabase.client.from(SUPABASE_TABLE).upsert(payload, { onConflict: "id" });
    if (error) throw error;
  };

  const deleteSupabaseReservation = async (id) => {
    if (!state.supabase.client) return;
    const { error } = await state.supabase.client.from(SUPABASE_TABLE).delete().eq("id", String(id));
    if (error) throw error;
  };

  const confirmWithModal = ({ title, message, confirmText = "Delete" }) => {
    return new Promise((resolve) => {
      const Modal = window.bootstrap?.Modal;
      if (!Modal) {
        resolve(false);
        return;
      }

      confirmModalTitle.textContent = title;
      confirmModalBody.textContent = message;
      confirmModalConfirmBtn.innerHTML = `<i class="bi bi-trash me-1" aria-hidden="true"></i>${escapeHtml(confirmText)}`;

      const instance = Modal.getOrCreateInstance(confirmModalEl);

      const cleanup = () => {
        confirmModalConfirmBtn.removeEventListener("click", onConfirm);
        confirmModalEl.removeEventListener("hidden.bs.modal", onHidden);
      };

      const onConfirm = () => {
        cleanup();
        resolve(true);
        instance.hide();
      };

      const onHidden = () => {
        cleanup();
        resolve(false);
      };

      confirmModalConfirmBtn.addEventListener("click", onConfirm);
      confirmModalEl.addEventListener("hidden.bs.modal", onHidden);
      instance.show();
    });
  };

  const showReservationDetails = (reservation) => {
    const modalEl = document.getElementById("reservationDetailsModal");
    if (!modalEl) return;

    state.ui.detailsId = String(reservation.id);
    detailsDeleteBtn.disabled = false;

    const nights = nightsBetween(reservation.checkInDate, reservation.checkOutDate);
    const nightsLabel = nights === 1 ? "1 night" : `${nights ?? "-"} nights`;
    const setText = (elementId, value) => {
      const el = document.getElementById(elementId);
      if (!el) return;
      el.textContent = value;
    };

    detailSummary.textContent = `${formatDateWithWeekday(reservation.checkInDate)} 2:00 PM \u2192 ${formatDateWithWeekday(reservation.checkOutDate)} 12:00 PM (${nightsLabel})`;
    setText("detailStatus", formatStatus(reservation.status));
    setText("detailCheckIn", `${formatDateWithWeekday(reservation.checkInDate)} 2:00 PM`);
    setText("detailCheckOut", `${formatDateWithWeekday(reservation.checkOutDate)} 12:00 PM`);
    setText("detailNights", nights == null ? "-" : String(nights));
    setText("detailFee", formatFee(reservation.fee));
    setText("detailAmount", formatAmount(reservation.amount));
    setText("detailSource", formatSource(reservation.source));
    setText("detailGuest", reservation.guest?.trim() ? reservation.guest : "-");
    setText("detailNotes", reservation.notes?.trim() ? reservation.notes : "-");
    setText(
      "detailCreatedAt",
      reservation.createdAt ? new Date(reservation.createdAt).toLocaleString() : "-",
    );

    const Modal = window.bootstrap?.Modal;
    if (!Modal) return;
    Modal.getOrCreateInstance(modalEl).show();
  };

  const renderCalendarDayList = (isoDate) => {
    state.ui.calendarDayIso = String(isoDate);
    const dateLabel = formatDate(isoDate);
    calendarDayTitle.textContent = `Bookings - ${dateLabel}`;

    const dayBookings = state.reservations.filter((r) => isDateInStay(r, isoDate));
    if (!dayBookings.length) {
      calendarDayList.innerHTML = `<div class="text-secondary">No bookings for this day.</div>`;
      return;
    }

    calendarDayList.innerHTML = dayBookings
      .map((r) => {
        const nights = nightsBetween(r.checkInDate, r.checkOutDate);
        const subtitle = `${formatDateWithWeekday(r.checkInDate)} 2:00 PM → ${formatDateWithWeekday(r.checkOutDate)} 12:00 PM (${nights ?? "-"} nights)`;
        const guest = r.guest?.trim() ? ` • ${escapeHtml(r.guest)}` : "";
        return `
          <div class="border rounded p-2" data-id="${escapeHtml(r.id)}">
            <div class="fw-semibold">
              <span class="badge ${statusBadgeClass(r.status)} me-2">${escapeHtml(formatStatus(r.status))}</span>
              ${escapeHtml(formatSource(r.source))}${guest}
            </div>
            <div class="text-secondary small">${escapeHtml(subtitle)}</div>
            <div class="d-flex justify-content-end gap-2 flex-wrap mt-2">
              <button type="button" class="btn btn-sm btn-outline-dark" data-action="view" data-id="${escapeHtml(r.id)}">
                <i class="bi bi-eye me-1" aria-hidden="true"></i>View
              </button>
              <button type="button" class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${escapeHtml(r.id)}">
                <i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit
              </button>
              <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${escapeHtml(r.id)}">
                <i class="bi bi-trash me-1" aria-hidden="true"></i>Delete
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  };

  const sortReservations = (reservations) => {
    reservations.sort((a, b) => {
      const aStart = dateAndTimeToLocalMs(a.checkInDate, CHECK_IN_TIME) ?? 0;
      const bStart = dateAndTimeToLocalMs(b.checkInDate, CHECK_IN_TIME) ?? 0;
      if (aStart !== bStart) return aStart - bStart;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });
  };

  const matchesQuery = (reservation, query) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      reservation.status,
      reservation.checkInDate,
      reservation.checkOutDate,
      reservation.fee,
      reservation.amount,
      reservation.source,
      reservation.guest,
      reservation.notes,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  };

  const matchesScheduleFilter = (reservation) => {
    const todayIso = toIsoDateLocal(new Date());
    if (state.scheduleFilter === "done") return String(reservation.checkOutDate) <= todayIso;
    return String(reservation.checkOutDate) > todayIso;
  };

  const render = () => {
    const rows = state.reservations
      .filter(matchesScheduleFilter)
      .filter((r) => matchesQuery(r, state.query))
      .map((r) => {
        const statusShort = r.status === "reserved" ? "R" : "P";
        return `
          <tr data-id="${escapeHtml(r.id)}">
            <td data-label="Status">
              <span class="badge ${statusBadgeClass(r.status)}">
                <span class="d-none d-sm-inline">${escapeHtml(formatStatus(r.status))}</span>
                <span class="d-inline d-sm-none">${escapeHtml(statusShort)}</span>
              </span>
            </td>
            <td data-label="Check-in" class="fw-semibold">${escapeHtml(formatDate(r.checkInDate))} <span class="text-secondary small">2:00 PM</span></td>
            <td data-label="Check-out">${escapeHtml(formatDate(r.checkOutDate))} <span class="text-secondary small">12:00 PM</span></td>
            <td data-label="Source">${escapeHtml(formatSource(r.source))}</td>
            <td data-label="Amount">${escapeHtml(formatAmount(r.amount))}</td>
            <td data-label="Actions" class="text-end">
              <div class="btn-group btn-group-sm" role="group" aria-label="Reservation actions">
                <button type="button" class="btn btn-outline-dark" data-action="view">
                  <i class="bi bi-eye me-1" aria-hidden="true"></i>View
                </button>
                <button type="button" class="btn btn-outline-primary" data-action="edit">
                  <i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit
                </button>
                <button type="button" class="btn btn-outline-danger" data-action="delete">
                  <i class="bi bi-x-lg me-1" aria-hidden="true"></i>Delete
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    reservationTbody.innerHTML =
      rows ||
      `<tr><td colspan="6" class="text-secondary">No reservations yet.</td></tr>`;
  };

  const overlapsExisting = ({ checkInMs, checkOutMs, ignoreId }) => {
    return state.reservations.some((r) => {
      if (ignoreId && String(r.id) === String(ignoreId)) return false;
      const parsedRange = parseCheckInOut({ checkInDate: r.checkInDate, checkOutDate: r.checkOutDate });
      const existingStart = parsedRange?.checkInMs ?? null;
      const existingEnd = parsedRange?.checkOutMs ?? null;
      if (existingStart == null || existingEnd == null) return false;
      return checkInMs < existingEnd && checkOutMs > existingStart;
    });
  };

  const findOverlappingReservation = ({ checkInMs, checkOutMs, ignoreId }) => {
    let best = null;
    for (const reservation of state.reservations) {
      if (ignoreId && String(reservation.id) === String(ignoreId)) continue;
      const parsedRange = parseCheckInOut({ checkInDate: reservation.checkInDate, checkOutDate: reservation.checkOutDate });
      const existingStart = parsedRange?.checkInMs ?? null;
      const existingEnd = parsedRange?.checkOutMs ?? null;
      if (existingStart == null || existingEnd == null) continue;
      if (!(checkInMs < existingEnd && checkOutMs > existingStart)) continue;
      if (!best) {
        best = reservation;
        continue;
      }
      const bestStart = dateAndTimeToLocalMs(best.checkInDate, CHECK_IN_TIME) ?? 0;
      if (existingStart < bestStart) best = reservation;
    }
    return best;
  };

  const findReservationBlockingDate = (isoDate, ignoreId) => {
    const normalized = normalizeDate(isoDate);
    if (!normalized) return null;
    let best = null;
    for (const reservation of state.reservations) {
      if (ignoreId && String(reservation.id) === String(ignoreId)) continue;
      if (!isDateInStay(reservation, normalized)) continue;
      if (!best) {
        best = reservation;
        continue;
      }
      if (String(reservation.checkOutDate) < String(best.checkOutDate)) best = reservation;
    }
    return best;
  };

  const nextAvailableDate = (isoDate, ignoreId) => {
    let candidate = normalizeDate(isoDate);
    if (!candidate) return null;
    for (let guard = 0; guard < 400; guard += 1) {
      const blocker = findReservationBlockingDate(candidate, ignoreId);
      if (!blocker) return candidate;
      candidate = normalizeDate(blocker.checkOutDate);
      if (!candidate) return null;
    }
    return candidate;
  };

  const exportCsv = () => {
    const header = [
      "status",
      "check_in_date",
      "check_out_date",
      "nights",
      "fee",
      "booking_amount",
      "source",
      "guest",
      "notes",
      "created_at",
    ];

    const lines = [header.join(",")];
    for (const r of state.reservations) {
      const nights = nightsBetween(r.checkInDate, r.checkOutDate);
      lines.push(
        [
          r.status,
          r.checkInDate,
          r.checkOutDate,
          nights == null ? "" : String(nights),
          r.fee == null ? "" : String(r.fee),
          r.amount == null ? "" : String(r.amount),
          r.source ?? "",
          r.guest ?? "",
          r.notes ?? "",
          r.createdAt ?? "",
        ].map(escapeCsv).join(","),
      );
    }

    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tropic-cove-bookings.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const setDefaultDates = () => {
    const checkIn = document.getElementById("checkInDate");
    const checkOut = document.getElementById("checkOutDate");
    if (!(checkIn instanceof HTMLInputElement) || !(checkOut instanceof HTMLInputElement)) return;

    if (checkIn.value && checkOut.value) {
      enforceDateMins();
      updateDateSummary();
      updateDateValidity();
      updateSubmitEnabled();
      return;
    }

    const todayIso = toIsoDateLocal(new Date());
    const minCheckIn = addDaysIso(todayIso, 1);
    const minCheckOut = minCheckIn ? addDaysIso(minCheckIn, 1) : null;

    if (!checkIn.value && minCheckIn) checkIn.value = minCheckIn;
    if (!checkOut.value) checkOut.value = minCheckOut ?? "";

    enforceDateMins();
    updateDateSummary();
    updateDateValidity();
    updateSubmitEnabled();
  };

  const showFormModal = () => {
    const Modal = window.bootstrap?.Modal;
    if (!Modal) return;
    Modal.getOrCreateInstance(reservationFormModalEl).show();
  };

  const hideFormModal = () => {
    const Modal = window.bootstrap?.Modal;
    if (!Modal) return;
    Modal.getOrCreateInstance(reservationFormModalEl).hide();
  };

  const openAddReservationWithDate = (checkInDate) => {
    hideAlert();
    reservationForm.reset();
    reservationForm.classList.remove("was-validated");
    setEditingMode(null);
    hideDateSummary();

    const statusReserved = document.getElementById("statusReserved");
    const checkIn = document.getElementById("checkInDate");
    const checkOut = document.getElementById("checkOutDate");

    if (statusReserved instanceof HTMLInputElement) statusReserved.checked = true;
    if (checkIn instanceof HTMLInputElement) checkIn.value = String(checkInDate);

    const nextDay = addDaysIso(String(checkInDate), 1);
    if (checkOut instanceof HTMLInputElement) checkOut.value = nextDay ?? "";

    enforceDateMins();
    enforceNotReservedDates();
    updateDateSummary();
    updateDateValidity();
    updateSubmitEnabled();
    showFormModal();
    if (statusReserved instanceof HTMLInputElement) statusReserved.focus();
  };

  reservationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert();

    reservationForm.classList.add("was-validated");
    updateDateValidity();

    const formData = new FormData(reservationForm);
    const status = String(formData.get("status") ?? "").trim();
    const checkInDate = String(formData.get("checkInDate") ?? "").trim();
    const checkOutDate = String(formData.get("checkOutDate") ?? "").trim();
    const fee = parseFee(formData.get("fee"));
    const amount = parseAmount(formData.get("amount"));
    const source = String(formData.get("source") ?? "").trim();
    const guest = String(formData.get("guest") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    const parsedRange = parseCheckInOut({ checkInDate, checkOutDate });

    if (!STATUS_VALUES.has(status)) {
      showAlert("Choose a status.");
      return;
    }
    if (!parsedRange) return;
    if (parsedRange.checkOutMs <= parsedRange.checkInMs) {
      showAlert("Check-out date must be after check-in date.");
      return;
    }
    if (String(formData.get("fee") ?? "").trim() && fee == null) {
      showAlert("Reservation fee must be a number (0 or higher).");
      return;
    }
    if (String(formData.get("amount") ?? "").trim() && amount == null) {
      showAlert("Booking amount must be a number (0 or higher).");
      return;
    }
    if (!SOURCE_VALUES.has(source)) {
      showAlert("Please choose a valid source.");
      return;
    }
    if (
      overlapsExisting({
        checkInMs: parsedRange.checkInMs,
        checkOutMs: parsedRange.checkOutMs,
        ignoreId: state.editingId,
      })
    ) {
      showAlert("This booking range overlaps an existing reservation.");
      return;
    }

    if (state.editingId) {
      const index = state.reservations.findIndex((r) => String(r.id) === state.editingId);
      if (index >= 0) {
        const updated = {
          ...state.reservations[index],
          status,
          checkInDate: parsedRange.checkInDate,
          checkOutDate: parsedRange.checkOutDate,
          fee,
          amount,
          source,
          guest,
          notes,
        };
        try {
          await upsertSupabaseReservation(updated);
        } catch {
          showAlert("Failed to save online. Please try again.");
          return;
        }
        state.reservations[index] = updated;
      }
      setEditingMode(null);
    } else {
      const created = {
        id: makeId(),
        status,
        checkInDate: parsedRange.checkInDate,
        checkOutDate: parsedRange.checkOutDate,
        fee,
        amount,
        source,
        guest,
        notes,
        createdAt: new Date().toISOString(),
      };
      try {
        await upsertSupabaseReservation(created);
      } catch {
        showAlert("Failed to save online. Please try again.");
        return;
      }
      state.reservations.push(created);
    }
    sortReservations(state.reservations);
    saveLocal();
    render();
    renderCalendar();

    reservationForm.reset();
    reservationForm.classList.remove("was-validated");
    setDefaultDates();
    hideFormModal();
  });

  cancelEditBtn.addEventListener("click", () => {
    hideAlert();
    reservationForm.reset();
    reservationForm.classList.remove("was-validated");
    setEditingMode(null);
    setDefaultDates();
    hideDateSummary();
  });

  reservationFormModalEl.addEventListener("hidden.bs.modal", () => {
    hideAlert();
    reservationForm.reset();
    reservationForm.classList.remove("was-validated");
    setEditingMode(null);
    setDefaultDates();
    hideDateSummary();
    submitBtn.disabled = false;
  });

  addReservationBtn.addEventListener("click", () => {
    hideAlert();
    reservationForm.reset();
    reservationForm.classList.remove("was-validated");
    setEditingMode(null);
    setDefaultDates();
    showFormModal();
    const statusReserved = document.getElementById("statusReserved");
    if (statusReserved instanceof HTMLInputElement) statusReserved.checked = true;
    enforceDateMins();
    enforceNotReservedDates();
    updateDateSummary();
    updateDateValidity();
    updateSubmitEnabled();
    if (statusReserved instanceof HTMLInputElement) statusReserved.focus();
  });

  reservationTbody.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("button[data-action]");
    if (!button) return;

    const action = button.getAttribute("data-action");
    const row = button.closest("tr[data-id]");
    const id = row?.getAttribute("data-id");
    if (!id) return;

    if (action === "view") {
      const reservation = state.reservations.find((r) => String(r.id) === id);
      if (!reservation) return;
      showReservationDetails(reservation);
      return;
    }

    if (action === "edit") {
      const reservation = state.reservations.find((r) => String(r.id) === id);
      if (!reservation) return;
      setEditingMode(reservation);
      setFormFromReservation(reservation);
      reservationForm.classList.remove("was-validated");
      hideAlert();
      showFormModal();
      return;
    }

    if (action !== "delete") return;
    const reservation = state.reservations.find((r) => String(r.id) === id);
    const label = reservation
      ? `${formatDate(reservation.checkInDate)} → ${formatDate(reservation.checkOutDate)}${reservation.guest ? ` (${reservation.guest})` : ""}`
      : "this reservation";
    const displayLabel = reservation
      ? `${formatDateWithWeekday(reservation.checkInDate)} → ${formatDateWithWeekday(reservation.checkOutDate)}${reservation.guest ? ` (${reservation.guest})` : ""}`
      : label;
    const ok = await confirmWithModal({ title: "Delete reservation?", message: `Delete ${displayLabel}?` });
    if (!ok) return;

    try {
      await deleteSupabaseReservation(id);
    } catch {
      alert("Failed to delete online. Please try again.");
      return;
    }
    state.reservations = state.reservations.filter((r) => String(r.id) !== id);
    if (state.editingId && state.editingId === id) {
      setEditingMode(null);
      reservationForm.reset();
      reservationForm.classList.remove("was-validated");
      setDefaultDates();
    }
    saveLocal();
    render();
    renderCalendar();
  });

  exportBtn.addEventListener("click", exportCsv);

  searchInput.addEventListener("input", () => {
    state.query = searchInput.value;
    render();
  });

  scheduleFilter.addEventListener("change", () => {
    state.scheduleFilter = String(scheduleFilter.value || "upcoming");
    render();
  });

  const checkInDateInput = document.getElementById("checkInDate");
  const checkOutDateInput = document.getElementById("checkOutDate");
  const onDatesChanged = () => {
    enforceDateMins();
    enforceNotReservedDates();
    updateDateSummary();
    updateDateValidity();
    updateSubmitEnabled();
  };
  if (checkInDateInput instanceof HTMLInputElement) {
    checkInDateInput.addEventListener("input", onDatesChanged);
    checkInDateInput.addEventListener("change", onDatesChanged);
  }
  if (checkOutDateInput instanceof HTMLInputElement) {
    checkOutDateInput.addEventListener("input", onDatesChanged);
    checkOutDateInput.addEventListener("change", onDatesChanged);
  }

  const statusReservedInput = document.getElementById("statusReserved");
  const statusPartialInput = document.getElementById("statusPartial");
  if (statusReservedInput instanceof HTMLInputElement) {
    statusReservedInput.addEventListener("change", updateSubmitEnabled);
  }
  if (statusPartialInput instanceof HTMLInputElement) {
    statusPartialInput.addEventListener("change", updateSubmitEnabled);
  }

  const renderCalendar = () => {
    const monthDate = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth(), 1);
    const monthName = monthDate.toLocaleString(undefined, { month: "long", year: "numeric" });
    calendarMonthLabel.textContent = monthName;

    const firstDayIndex = monthDate.getDay(); // 0=Sun
    const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
    const daysInMonth = Math.round((nextMonth - monthDate) / (24 * 60 * 60 * 1000));
    const monthStartIso = toIsoDateLocal(monthDate);
    const monthEndIso = toIsoDateLocal(nextMonth);
    const monthColors = buildMonthColorMap(monthStartIso, monthEndIso);

    const todayIso = toIsoDateLocal(new Date());
    const cells = [];

    for (let i = 0; i < firstDayIndex; i += 1) {
      cells.push(`<div class="tc-calendar-cell tc-calendar-empty" aria-hidden="true"></div>`);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      const iso = toIsoDateLocal(date);
      const active = state.reservations.filter((r) => isDateInStay(r, iso));
      const count = active.length;
      const isToday = iso === todayIso;
      const primary = active
        .slice()
        .sort((a, b) => {
          const aRank = a.status === "reserved" ? 0 : 1;
          const bRank = b.status === "reserved" ? 0 : 1;
          if (aRank !== bRank) return aRank - bRank;
          return String(a.checkInDate ?? "").localeCompare(String(b.checkInDate ?? ""));
        })[0];
      const primaryColor =
        primary?.status === "partial" ? "hsl(0 0% 70%)" : primary ? monthColors.get(String(primary.id)) : null;
      const primaryLabel = primary?.status === "partial" ? "Partial" : "Reserved";
      const label = count
        ? `<span class="tc-calendar-label tc-cal-dynamic" style="--tc-cal:${escapeHtml(primaryColor ?? "hsl(0 0% 45%)")}">${escapeHtml(primaryLabel)}</span>`
        : "";
      const footer = count ? `<div class="tc-calendar-segs">${label}</div>` : "";
      cells.push(`
        <button type="button"
          class="tc-calendar-cell tc-calendar-day ${isToday ? "tc-calendar-today" : ""} ${count ? "tc-cal-dynamic" : ""}"
          ${primaryColor ? `style="--tc-cal:${escapeHtml(primaryColor)}"` : ""}
          data-date="${escapeHtml(iso)}"
          aria-label="${escapeHtml(iso)}${count ? `, ${escapeHtml(primaryLabel.toLowerCase())}` : ""}">
          <div class="tc-calendar-daynum" aria-hidden="true">${day}</div>
          ${footer}
        </button>
      `);
    }

    calendarGrid.innerHTML = cells.join("");
  };

  const showCalendarDayModal = (isoDate) => {
    renderCalendarDayList(isoDate);

    const Modal = window.bootstrap?.Modal;
    if (!Modal) return;
    Modal.getOrCreateInstance(calendarDayModalEl).show();
  };

  const runAfterModalHidden = (modalEl, action) => {
    if (!(modalEl instanceof HTMLElement)) {
      action();
      return;
    }

    const Modal = window.bootstrap?.Modal;
    if (!Modal) {
      action();
      return;
    }

    const isShown = modalEl.classList.contains("show");
    if (!isShown) {
      action();
      return;
    }

    modalEl.addEventListener(
      "hidden.bs.modal",
      () => {
        action();
      },
      { once: true },
    );
    Modal.getOrCreateInstance(modalEl).hide();
  };

  calendarGrid.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("button[data-date]");
    const iso = button?.getAttribute("data-date");
    if (!iso) return;
    const hasBooking = state.reservations.some((r) => isDateInStay(r, iso));
    if (!hasBooking) {
      openAddReservationWithDate(iso);
      return;
    }
    showCalendarDayModal(iso);
  });

  calendarDayList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("button[data-action][data-id]");
    if (!button) return;
    event.preventDefault();
    const action = button.getAttribute("data-action");
    const id = button.getAttribute("data-id");
    if (!action || !id) return;

    if (action === "view") {
      const reservation = state.reservations.find((r) => String(r.id) === id);
      if (!reservation) return;
      runAfterModalHidden(calendarDayModalEl, () => {
        showReservationDetails(reservation);
      });
      return;
    }

    if (action === "edit") {
      const reservation = state.reservations.find((r) => String(r.id) === id);
      if (!reservation) return;
      runAfterModalHidden(calendarDayModalEl, () => {
        setEditingMode(reservation);
        setFormFromReservation(reservation);
        reservationForm.classList.remove("was-validated");
        hideAlert();
        showFormModal();
      });
      return;
    }

    if (action === "delete") {
      const reservation = state.reservations.find((r) => String(r.id) === id);
      const label = reservation
        ? `${formatDate(reservation.checkInDate)} → ${formatDate(reservation.checkOutDate)}${reservation.guest ? ` (${reservation.guest})` : ""}`
        : "this reservation";
      runAfterModalHidden(calendarDayModalEl, async () => {
        const displayLabel = reservation
          ? `${formatDateWithWeekday(reservation.checkInDate)} → ${formatDateWithWeekday(reservation.checkOutDate)}${reservation.guest ? ` (${reservation.guest})` : ""}`
          : label;
        const ok = await confirmWithModal({ title: "Delete reservation?", message: `Delete ${displayLabel}?` });
        if (!ok) {
          if (state.ui.calendarDayIso) showCalendarDayModal(state.ui.calendarDayIso);
          return;
        }

        try {
          await deleteSupabaseReservation(id);
        } catch {
          alert("Failed to delete online. Please try again.");
          if (state.ui.calendarDayIso) showCalendarDayModal(state.ui.calendarDayIso);
          return;
        }

        state.reservations = state.reservations.filter((r) => String(r.id) !== id);
        saveLocal();
        render();
        renderCalendar();
        if (state.ui.calendarDayIso) showCalendarDayModal(state.ui.calendarDayIso);
      });
      return;
    }
  });

  prevMonthBtn.addEventListener("click", () => {
    state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() - 1, 1);
    renderCalendar();
  });

  nextMonthBtn.addEventListener("click", () => {
    state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  const onSignedIn = async (user) => {
    authUser.textContent = user?.email ? `Signed in: ${user.email}` : "Signed in";
    setAppVisibility(true);
    loadLocal();
    sortReservations(state.reservations);
    render();
    setDefaultDates();
    renderCalendar();
    await refreshFromSupabase();

    if (state.supabase.pollTimer) clearInterval(state.supabase.pollTimer);
    state.supabase.pollTimer = setInterval(() => {
      refreshFromSupabase().catch(() => {});
    }, 15000);
  };

  const onSignedOut = () => {
    if (state.supabase.pollTimer) clearInterval(state.supabase.pollTimer);
    state.supabase.pollTimer = null;
    authUser.textContent = "";
    setAppVisibility(false);
  };

  signInBtn.addEventListener("click", redirectToHomeForAuth);
  signInBtnGate.addEventListener("click", redirectToHomeForAuth);

  signOutBtn.addEventListener("click", async () => {
    await state.supabase.client?.auth.signOut().catch(() => {});
    onSignedOut();
  });

  setAppVisibility(false);
  const supabaseOk = initSupabase();
  if (!supabaseOk) {
    const p = authGate.querySelector("p");
    if (p) {
      p.textContent = "Supabase is not configured. Update assets/js/supabase-config.js.";
    }
    signInBtn.disabled = true;
    signInBtnGate.disabled = true;
    return;
  }

  const start = async () => {
    const { data } = await state.supabase.client.auth.getSession();
    const user = data?.session?.user ?? null;
    if (user && isEmailAllowed(user.email)) {
      await onSignedIn(user);
      return;
    }

    // Booking page should be private: if not authenticated, go home to sign in.
    redirectToHomeForAuth();
  };

  start().catch(() => {
    redirectToHomeForAuth();
  });

  state.supabase.client.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    if (user && isEmailAllowed(user.email)) {
      onSignedIn(user).catch(() => {});
      return;
    }
    onSignedOut();
  });

  detailsDeleteBtn.addEventListener("click", async () => {
    const id = state.ui.detailsId;
    if (!id) return;
    const reservation = state.reservations.find((r) => String(r.id) === id);
    const label = reservation
      ? `${formatDate(reservation.checkInDate)} → ${formatDate(reservation.checkOutDate)}${reservation.guest ? ` (${reservation.guest})` : ""}`
      : "this reservation";
    const detailsModalEl = document.getElementById("reservationDetailsModal");
    runAfterModalHidden(detailsModalEl, async () => {
      const displayLabel = reservation
        ? `${formatDateWithWeekday(reservation.checkInDate)} → ${formatDateWithWeekday(reservation.checkOutDate)}${reservation.guest ? ` (${reservation.guest})` : ""}`
        : label;
      const ok = await confirmWithModal({ title: "Delete reservation?", message: `Delete ${displayLabel}?` });
      if (!ok) {
        if (reservation) showReservationDetails(reservation);
        return;
      }

      detailsDeleteBtn.disabled = true;
      try {
        await deleteSupabaseReservation(id);
      } catch {
        alert("Failed to delete online. Please try again.");
        detailsDeleteBtn.disabled = false;
        if (reservation) showReservationDetails(reservation);
        return;
      }

      state.reservations = state.reservations.filter((r) => String(r.id) !== id);
      saveLocal();
      render();
      renderCalendar();
      state.ui.detailsId = null;
    });
  });

  const detailsModalEl = document.getElementById("reservationDetailsModal");
  detailsModalEl?.addEventListener?.("hidden.bs.modal", () => {
    state.ui.detailsId = null;
    detailsDeleteBtn.disabled = false;
  });
})();
