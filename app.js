/* ==========================================================================
   Calendario Training — Grupo de Trabajo (Sin servidor · Google Workspace)
   ========================================================================== */

// Pega aquí la URL /exec de tu Google Apps Script para que TODO el equipo vea y comparta los mismos eventos en tiempo real (0 €):
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzBlkQgHjuAWBxDGj5Pb9vmFV-9rZSa121HD0CSX5rpGslarqXfg5C8lFzyDJKDaylz/exec";

const STORAGE_KEYS = {
  EVENTS: "cal_xiaomi_events_v2",
  OUTBOX: "cal_xiaomi_outbox_v1",
  TEAM: "cal_xiaomi_team_v1",
  EXT_CALENDARS: "cal_xiaomi_ext_cals_v1",
  GOOGLE_CFG: "cal_xiaomi_google_cfg_v1",
  BLOCKED_DAYS: "cal_xiaomi_blocked_days_v2",
};

const DEFAULT_VACATIONS_SHEET_ID = "1K0vGOPwteG6ZjNVT7cDaEwIeb3ONcjmNec3-FGlH10g";

// Festivos exactos por usuario extraídos de la pestaña FESTIVOS de Usuarios APP
const SHEET_FESTIVOS_BY_USER = {
  TM1: [
    "2026-01-01", "2026-01-06", "2026-04-02", "2026-04-03", "2026-05-01", "2026-05-02",
    "2026-05-15", "2026-08-15", "2026-10-12", "2026-11-02", "2026-11-09", "2026-12-07",
    "2026-12-08", "2026-12-25", "2027-01-01", "2027-01-06",
  ],
  TS1: [
    "2026-01-01", "2026-01-06", "2026-02-28", "2026-04-02", "2026-04-03", "2026-05-01",
    "2026-08-15", "2026-08-19", "2026-09-08", "2026-10-12", "2026-11-02", "2026-12-07",
    "2026-12-08", "2026-12-25", "2027-01-01", "2027-01-06",
  ],
  TN1: [
    "2026-01-01", "2026-01-06", "2026-02-17", "2026-04-02", "2026-04-03", "2026-05-01",
    "2026-06-29", "2026-08-15", "2026-09-08", "2026-10-12", "2026-11-02", "2026-12-07",
    "2026-12-08", "2026-12-25", "2027-01-01", "2027-01-06",
  ],
  TB1: [
    "2026-01-01", "2026-01-06", "2026-04-03", "2026-04-06", "2026-05-01", "2026-05-25",
    "2026-06-24", "2026-08-15", "2026-09-11", "2026-09-24", "2026-10-12", "2026-11-01",
    "2026-12-08", "2026-12-25", "2026-12-26", "2027-01-01", "2027-01-06",
  ],
  TL1: [
    "2026-01-01", "2026-01-06", "2026-03-19", "2026-04-03", "2026-04-06", "2026-04-16",
    "2026-05-01", "2026-06-24", "2026-08-15", "2026-10-09", "2026-10-12", "2026-11-01",
    "2026-12-06", "2026-12-08", "2026-12-25", "2027-01-01", "2027-01-06",
  ],
  David: [
    "2026-01-01", "2026-01-06", "2026-02-28", "2026-04-02", "2026-04-03", "2026-04-22",
    "2026-05-01", "2026-06-04", "2026-08-15", "2026-10-12", "2026-11-02", "2026-12-07",
    "2026-12-08", "2026-12-25", "2027-01-01", "2027-01-06",
  ],
  COORD: [
    "2026-01-01", "2026-01-06", "2026-04-02", "2026-04-03", "2026-05-01", "2026-05-02",
    "2026-05-15", "2026-08-15", "2026-10-12", "2026-11-02", "2026-11-09", "2026-12-07",
    "2026-12-08", "2026-12-25", "2027-01-01", "2027-01-06",
  ],
};

function buildDefaultBlockedDays() {
  const map = {};
  Object.entries(SHEET_FESTIVOS_BY_USER).forEach(([memberId, dates]) => {
    dates.forEach((d) => {
      map[`${memberId}|${d}`] = { type: "FESTIVO", label: "FESTIVO" };
    });
  });
  return map;
}

const CHANNELS = [
  { id: "open_market", label: "Open Market", bg: "#cccccc", fg: "#111111" },
  { id: "interno", label: "INTERNO (PC, GPV...)", bg: "#ffff00", fg: "#111111" },
  { id: "xiaomi_stores", label: "Xiaomi Stores", bg: "#ff6d01", fg: "#111111" },
  { id: "materiales", label: "Materiales", bg: "#34a853", fg: "#111111" },
  { id: "otros", label: "Otros", bg: "#a60054", fg: "#ffffff" },
  { id: "orange", label: "ORANGE (OSP)", bg: "#ff9900", fg: "#111111" },
  { id: "vodafone", label: "VODAFONE (VDF)", bg: "#e53935", fg: "#ffffff" },
  { id: "masmovil", label: "MÁS MOVIL & YOIGO", bg: "#e01e84", fg: "#ffffff" },
  { id: "telefonica", label: "TELEFÓNICA (TME)", bg: "#4a86e8", fg: "#ffffff" },
];

const DEFAULT_TEAM = [
  { id: "COORD", name: "COORD", email: "victorprado@salesland.net", calendarId: "victorprado@salesland.net" },
  { id: "David", name: "David", email: "davidotero@salesland.net", calendarId: "davidotero@salesland.net" },
  { id: "TL1", name: "TL1", email: "franciscocerezo@salesland.net", calendarId: "franciscocerezo@salesland.net" },
  { id: "TM1", name: "TM1", email: "tomasrubiolo@salesland.net", calendarId: "tomasrubiolo@salesland.net" },
  { id: "TB1", name: "TB1", email: "carleshinojosa@salesland.net", calendarId: "carleshinojosa@salesland.net" },
  { id: "TS1", name: "TS1", email: "fabiogarcia@salesland.net", calendarId: "fabiogarcia@salesland.net" },
  { id: "TN1", name: "TN1", email: "hamzagaya@salesland.net", calendarId: "hamzagaya@salesland.net" },
];

const DEFAULT_EXT_CALENDARS = [
  {
    id: "es.spain#holiday@group.v.calendar.google.com",
    name: "Festivos España",
    color: "#a60054",
    enabled: true,
  },
];

// Calendario limpio listo para producción (sin eventos de prueba)
const SEED_EVENTS = [];

// Estado de la aplicación
let state = {
  events: [],
  outbox: {}, // id -> { action, id, event, revision, status, error }
  externalEvents: [],
  blockedDays: {}, // key: "memberId|YYYY-MM-DD" -> { type, label }
  team: [],
  extCalendars: [],
  googleCfg: {
    clientId: "",
    primaryCalendarId: "primary",
    vacationsSheetId: DEFAULT_VACATIONS_SHEET_ID,
  },
  accessToken: null,
  tokenClient: null,
  syncTimer: null,
  clipboard: null, // { mode: "copy" | "cut", eventId: string }
  viewMode: "auto", // "auto" | "table" | "mobile"
  calendarMode: "month", // "week" | "month" | "agenda"
  anchorDate: new Date(),
  filters: { search: "", members: [], channel: "all" }, // members: [] = Todo el equipo
};

/* ---------- Utilidades de Fechas (ISO Week, Lunes a Domingo) ---------- */
function normalizeTimeStr(t, fallback = "") {
  if (!t) return fallback;
  const s = String(t);
  const m = s.match(/(\d{1,2}:\d{2})/);
  if (m) return m[1].padStart(5, "0");
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return fallback;
}

function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date, days) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function getISOWeekYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

function getWeekCornerImageIndex(weekStart, weekNum) {
  const isoYear = getISOWeekYear(weekStart);
  const has53Weeks = getISOWeekNumber(new Date(isoYear, 11, 28)) === 53;
  if (has53Weeks) {
    if (weekNum === 53) return 52;
    if (weekNum === 52) return 51;
  }
  return Math.min(52, Math.max(1, weekNum));
}

function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function getMonthNameEs(date) {
  return date
    .toLocaleDateString("es-ES", { month: "long" })
    .toUpperCase();
}

/* ---------- Persistencia Local ---------- */
function loadState() {
  try {
    localStorage.removeItem("cal_xiaomi_events_v1");
    const ev = localStorage.getItem(STORAGE_KEYS.EVENTS);
    state.events = ev ? JSON.parse(ev) : [];

    const tm = localStorage.getItem(STORAGE_KEYS.TEAM);
    if (tm) {
      state.team = JSON.parse(tm);
      // Completar correos por defecto si algún miembro guardado aún no tenía email
      let patched = false;
      state.team.forEach((m) => {
        const def = DEFAULT_TEAM.find((d) => d.id.toLowerCase() === m.id.toLowerCase());
        if (def && !m.email) {
          m.email = def.email;
          if (!m.calendarId) m.calendarId = def.calendarId;
          patched = true;
        }
      });
      if (patched) saveTeam();
    } else {
      state.team = DEFAULT_TEAM;
      saveTeam();
    }

    const ec = localStorage.getItem(STORAGE_KEYS.EXT_CALENDARS);
    state.extCalendars = ec ? JSON.parse(ec) : DEFAULT_EXT_CALENDARS;

    const gc = localStorage.getItem(STORAGE_KEYS.GOOGLE_CFG);
    if (gc) {
      state.googleCfg = { vacationsSheetId: DEFAULT_VACATIONS_SHEET_ID, ...JSON.parse(gc) };
    }

    const bd = localStorage.getItem(STORAGE_KEYS.BLOCKED_DAYS);
    if (bd && Object.keys(JSON.parse(bd)).length > 0) {
      state.blockedDays = JSON.parse(bd);
    } else {
      state.blockedDays = buildDefaultBlockedDays();
      saveBlockedDays();
    }

    const ob = localStorage.getItem(STORAGE_KEYS.OUTBOX);
    state.outbox = ob ? JSON.parse(ob) : {};
    if (Object.keys(state.outbox).length > 0) {
      mergeRemoteEvents(state.events);
    }
  } catch (e) {
    console.error("Error cargando localStorage:", e);
  }
}

function saveBlockedDays() {
  localStorage.setItem(STORAGE_KEYS.BLOCKED_DAYS, JSON.stringify(state.blockedDays));
}

function getBlockedInfo(dateIso, memberId) {
  return state.blockedDays[`${memberId}|${dateIso}`] || null;
}

function isCellLocked(blocked) {
  return Boolean(blocked && blocked.type !== "FESTIVO");
}

let pendingSyncWrites = 0;
let lastWriteTimestamp = 0;
let syncEpoch = 0;

function saveOutbox() {
  localStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify(state.outbox || {}));
}

function eventContent(ev) {
  const copy = { ...ev };
  delete copy._saveState;
  delete copy._saveError;
  return copy;
}

// Las lecturas remotas nunca sustituyen una edición pendiente ni resucitan un borrado sin confirmar.
function mergeRemoteEvents(remoteEvents) {
  const merged = new Map((remoteEvents || []).map((ev) => [ev.id, { ...ev }]));
  Object.values(state.outbox || {}).forEach((op) => {
    if (op.action === "delete") {
      merged.delete(op.id);
    } else if (op.event) {
      merged.set(op.id, {
        ...op.event,
        _saveState: op.status === "error" ? "error" : "pending",
        _saveError: op.error || "",
      });
    }
  });
  state.events = Array.from(merged.values());
}

function updateSaveSummary() {
  const bar = document.getElementById("syncSummaryBar");
  const txt = document.getElementById("syncSummaryText");
  if (!bar || !txt) return;
  const ops = Object.values(state.outbox || {});
  if (ops.length === 0) {
    bar.classList.add("hidden");
    bar.classList.remove("is-error");
    return;
  }
  const errCount = ops.filter((o) => o.status === "error").length;
  const pendCount = ops.length - errCount;
  bar.classList.remove("hidden");
  bar.classList.toggle("is-error", errCount > 0);
  if (errCount > 0) {
    const firstErr = ops.find((o) => o.status === "error")?.error || "";
    txt.textContent = `⚠️ ${errCount} cambio(s) sin sincronizar con Google (${firstErr || "error de conexión"})${pendCount ? ` · ${pendCount} pendiente(s)` : ""}`;
  } else {
    txt.textContent = `⏳ ${pendCount} cambio(s) pendientes de sincronizar con el grupo...`;
  }
}

function queueEventChange(action, ev) {
  syncEpoch++;
  if (!APPS_SCRIPT_URL) {
    if (action !== "delete") {
      ev._saveState = "local";
      ev._saveError = "";
    }
    saveEvents();
    updateSaveSummary();
    return null;
  }
  const op = {
    action,
    id: ev.id,
    event: eventContent(ev),
    revision: `${Date.now()}-${Math.random()}`,
    status: "pending",
    error: "",
  };
  state.outbox[ev.id] = op;
  if (action !== "delete") {
    ev._saveState = "pending";
    ev._saveError = "";
  }
  saveOutbox();
  saveEvents();
  updateSaveSummary();
  return op;
}

async function sendQueuedOperation(op) {
  if (!op || !APPS_SCRIPT_URL) return { ok: true };
  const payload =
    op.action === "delete"
      ? { action: "delete", id: op.id, googleEventId: op.event?.googleEventId || null }
      : { action: "upsert", event: eventContent(op.event) };

  const res = await postToAppsScript(payload);
  const currentOp = state.outbox[op.id];
  // Si el usuario editó o deshizo este mismo ID mientras enviábamos, respetamos la operación más nueva
  if (!currentOp || currentOp.revision !== op.revision) return res;

  if (res?.ok === true) {
    delete state.outbox[op.id];
    const target = state.events.find((x) => x.id === op.id);
    if (target) {
      if (res.googleEventId) target.googleEventId = res.googleEventId;
      delete target._saveState;
      delete target._saveError;
    }
    saveOutbox();
    saveEvents();
    updateSaveSummary();
    renderWeeks();
    return res;
  }

  currentOp.status = "error";
  currentOp.error = res?.error || "No se pudo conectar";
  const target = state.events.find((x) => x.id === op.id);
  if (target) {
    target._saveState = "error";
    target._saveError = currentOp.error;
  }
  saveOutbox();
  saveEvents();
  updateSaveSummary();
  renderWeeks();
  return res || { ok: false, error: currentOp.error };
}

async function retryAllChanges() {
  const ops = Object.values(state.outbox || {});
  if (ops.length === 0 || !APPS_SCRIPT_URL) return;
  let okCount = 0;
  for (const op of ops) {
    op.status = "pending";
    op.error = "";
    const res = await sendQueuedOperation(op);
    if (res?.ok === true) okCount++;
  }
  if (okCount === ops.length) {
    showToast("Todos los cambios pendientes se han sincronizado.");
  } else if (okCount > 0) {
    showToast(`Sincronizados ${okCount} de ${ops.length} cambios.`);
  } else {
    showToast("Sigue habiendo cambios sin sincronizar. Revisa tu conexión.");
  }
}

function availabilityIssues(ev, excludedIds = []) {
  const participantIds = [ev.memberId, ...(ev.groupAttendees || [])];
  const errors = [];
  const warnings = [];
  if (!String(ev.title || "").trim()) errors.push("Escribe el título de la actividad.");
  if (!state.team.some((m) => m.id === ev.memberId)) errors.push("Selecciona la persona responsable.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.date || "")) errors.push("Selecciona una fecha válida.");
  if (!ev.allDay && (!ev.startTime || !ev.endTime || ev.endTime <= ev.startTime)) {
    errors.push("Indica un horario completo; la hora de fin debe ser posterior al inicio.");
  }
  for (const id of new Set(participantIds)) {
    const blocked = getBlockedInfo(ev.date, id);
    const name = state.team.find((m) => m.id === id)?.name || id;
    if (isCellLocked(blocked)) errors.push(`${name}: día bloqueado (${blocked.label}).`);
    else if (blocked) warnings.push(`${name}: ${blocked.label}.`);
  }
  const overlaps = [...state.events, ...state.externalEvents].filter((other) => {
    if (excludedIds.includes(other.id) || other.date !== ev.date) return false;
    const others = [other.memberId, ...(other.groupAttendees || [])];
    if (!participantIds.some((id) => others.includes(id))) return false;
    return (
      ev.allDay ||
      other.allDay ||
      (ev.startTime < normalizeTimeStr(other.endTime, "23:59") &&
        ev.endTime > normalizeTimeStr(other.startTime, "00:00"))
    );
  });
  if (overlaps.length) {
    warnings.push(`Coincide con ${overlaps.length} actividad(es): ${overlaps.map((x) => x.title).join("; ")}.`);
  }
  return { errors, warnings };
}

let availabilityResolver = null;
function confirmAvailability(ev, excludedIds = []) {
  const { errors, warnings } = availabilityIssues(ev, excludedIds);
  if (errors.length) {
    showToast(errors.join(" "));
    return Promise.resolve(false);
  }
  if (!warnings.length) return Promise.resolve(true);
  const msgEl = document.getElementById("availabilityMessage");
  const modalEl = document.getElementById("availabilityModal");
  if (!msgEl || !modalEl) return Promise.resolve(true);
  msgEl.textContent = warnings.join(" ") + " ¿Quieres guardar de todas formas?";
  modalEl.showModal();
  return new Promise((resolve) => {
    availabilityResolver = resolve;
  });
}

function resolveAvailability(accepted) {
  const modalEl = document.getElementById("availabilityModal");
  if (modalEl?.open) modalEl.close();
  availabilityResolver?.(accepted);
  availabilityResolver = null;
}

async function syncFromAppsScript(silent = false) {
  if (!APPS_SCRIPT_URL) return;
  if (pendingSyncWrites > 0 || Date.now() - lastWriteTimestamp < 8000) return;
  const readEpoch = syncEpoch;
  try {
    const res = await fetch(APPS_SCRIPT_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Respuesta ${res.status}`);
    const data = await res.json();
    // Si hubo una escritura local mientras descargábamos, ignoramos esta lectura obsoleta
    if (readEpoch !== syncEpoch || pendingSyncWrites > 0 || Date.now() - lastWriteTimestamp < 8000) return;
    if (data.ok && Array.isArray(data.events)) {
      mergeRemoteEvents(data.events.map((ev) => ({ ...ev, _saveState: "saved" })));
      saveEvents();
      if (data.blockedDays && Object.keys(data.blockedDays).length > 0) {
        state.blockedDays = data.blockedDays;
        saveBlockedDays();
      }
      if (Array.isArray(data.team) && data.team.length > 0) {
        state.team = data.team;
        saveTeam();
        if (!document.getElementById("eventModal")?.open) renderLegendAndSelects();
      }
      updateSaveSummary();
      renderWeeks();
      if (!silent) showToast("Calendario del grupo actualizado");
    }
  } catch (err) {
    console.warn("Error sincronizando con Apps Script:", err);
  }
}

async function postToAppsScript(payload) {
  if (!APPS_SCRIPT_URL) return { ok: false, error: "Sin conexión compartida" };
  pendingSyncWrites++;
  lastWriteTimestamp = Date.now();
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    lastWriteTimestamp = Date.now();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.ok !== true) throw new Error(data?.error || "Guardado no confirmado");
    return data;
  } catch (err) {
    console.warn("Error enviando cambio a Apps Script:", err);
    return { ok: false, error: err?.message || "No se pudo conectar" };
  } finally {
    pendingSyncWrites = Math.max(0, pendingSyncWrites - 1);
  }
}

function saveEvents() {
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(state.events));
}

function saveTeam() {
  localStorage.setItem(STORAGE_KEYS.TEAM, JSON.stringify(state.team));
}

function saveExtCalendars() {
  localStorage.setItem(STORAGE_KEYS.EXT_CALENDARS, JSON.stringify(state.extCalendars));
}

function saveGoogleCfg() {
  localStorage.setItem(STORAGE_KEYS.GOOGLE_CFG, JSON.stringify(state.googleCfg));
}

/* ---------- Toast, Deshacer & Notificaciones ---------- */
let toastTimer;
let lastUndoSnapshot = null;

function showToast(msg, withUndo = false) {
  const el = document.getElementById("toast");
  el.innerHTML = "";
  const span = document.createElement("span");
  span.textContent = msg;
  el.appendChild(span);

  if (withUndo && lastUndoSnapshot) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-undo-btn";
    btn.textContent = "↶ Deshacer";
    btn.onclick = performUndo;
    el.appendChild(btn);
  }

  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), withUndo ? 8000 : 3800);
}

function saveUndoSnapshot(label) {
  lastUndoSnapshot = {
    events: JSON.parse(JSON.stringify(state.events)),
    label,
  };
  document.getElementById("btnUndo")?.classList.remove("hidden");
}

async function performUndo() {
  if (!lastUndoSnapshot) return;
  const snap = lastUndoSnapshot;
  lastUndoSnapshot = null;
  document.getElementById("btnUndo")?.classList.add("hidden");

  const prevEvents = state.events;
  const prevMap = new Map(prevEvents.map((e) => [e.id, e]));
  const snapIds = new Set(snap.events.map((e) => e.id));

  state.events = snap.events;
  saveEvents();
  renderWeeks();

  if (APPS_SCRIPT_URL) {
    // Deshacer por ID a través de la cola outbox para no pisar eventos de otros compañeros
    for (const oldEv of prevEvents) {
      if (!snapIds.has(oldEv.id)) {
        const op = queueEventChange("delete", oldEv);
        if (op) await sendQueuedOperation(op);
      }
    }
    for (const ev of state.events) {
      const prev = prevMap.get(ev.id);
      if (!prev || JSON.stringify(eventContent(prev)) !== JSON.stringify(eventContent(ev))) {
        const op = queueEventChange("upsert", ev);
        if (op) await sendQueuedOperation(op);
      }
    }
    saveEvents();
  } else if (state.accessToken) {
    for (const ev of state.events) {
      if (ev.syncGoogle && !prevMap.has(ev.id)) {
        try {
          const synced = await upsertGoogleCalendarEvent({ ...ev, googleEventId: null });
          ev.googleEventId = synced.id;
        } catch (err) {
          console.warn("Error restaurando evento en Google:", err);
        }
      }
    }
    saveEvents();
  }
  showToast(`Deshecho: ${snap.label}`);
}

/* ---------- Renderizado de Leyenda y Selectores ---------- */
function renderLegendAndSelects() {
  const legendEl = document.getElementById("legendItems");
  const evChannel = document.getElementById("evChannel");

  legendEl.innerHTML = "";
  evChannel.innerHTML = "";

  CHANNELS.forEach((ch) => {
    const chip = document.createElement("div");
    chip.className = "legend-chip" + (state.filters.channel === ch.id ? " active-filter" : "");
    chip.style.background = ch.bg;
    chip.style.color = ch.fg;
    chip.textContent = ch.label;
    chip.title = "Clic para filtrar por este canal";
    chip.onclick = () => {
      state.filters.channel = state.filters.channel === ch.id ? "all" : ch.id;
      renderLegendAndSelects();
      renderWeeks();
    };
    legendEl.appendChild(chip);

    evChannel.add(new Option(ch.label, ch.id));
  });

  const evMember = document.getElementById("evMember");
  evMember.innerHTML = "";
  state.team.forEach((m) => {
    const label = m.email ? `${m.name} (${m.email})` : m.name;
    evMember.add(new Option(label, m.id));
  });

  renderMemberMultiFilter();
}

function isMemberVisible(memberId) {
  return state.filters.members.length === 0 || state.filters.members.includes(memberId);
}

function renderMemberMultiFilter() {
  const btn = document.getElementById("btnFilterMembers");
  const menu = document.getElementById("memberFilterMenu");
  if (!btn || !menu) return;

  const sel = state.filters.members;
  if (sel.length === 0) {
    btn.textContent = "Todo el equipo ▾";
  } else if (sel.length <= 2) {
    btn.textContent = `${sel.join(", ")} ▾`;
  } else {
    btn.textContent = `${sel.length} personas ▾`;
  }

  menu.innerHTML = "";

  // Opción "Todo el equipo" (exclusiva: al marcarla se desmarcan las individuales)
  const allLabel = document.createElement("label");
  allLabel.className = "multi-filter-item";
  allLabel.innerHTML = `<input type="checkbox" ${sel.length === 0 ? "checked" : ""} /> <span>Todo el equipo</span>`;
  allLabel.querySelector("input").onchange = () => {
    state.filters.members = [];
    renderMemberMultiFilter();
    renderWeeks();
  };
  menu.appendChild(allLabel);

  const hr = document.createElement("hr");
  hr.className = "multi-filter-divider";
  menu.appendChild(hr);

  // Opciones individuales (multiselección)
  state.team.forEach((m) => {
    const item = document.createElement("label");
    item.className = "multi-filter-item";
    const checked = sel.includes(m.id);
    item.innerHTML = `<input type="checkbox" value="${escapeHtml(m.id)}" ${checked ? "checked" : ""} /> <span>${escapeHtml(m.name)}</span>`;
    item.querySelector("input").onchange = (e) => {
      if (e.target.checked) {
        if (!state.filters.members.includes(m.id)) {
          state.filters.members = [...state.filters.members, m.id];
        }
      } else {
        state.filters.members = state.filters.members.filter((id) => id !== m.id);
      }
      renderMemberMultiFilter();
      renderWeeks();
    };
    menu.appendChild(item);
  });
}

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function populateDateSelectors() {
  const selMonth = document.getElementById("selectMonth");
  const selYear = document.getElementById("selectYear");
  if (!selMonth || !selYear) return;

  selMonth.innerHTML = "";
  MONTHS_ES.forEach((name, idx) => selMonth.add(new Option(name, String(idx))));

  const currentYear = new Date().getFullYear();
  selYear.innerHTML = "";
  for (let y = currentYear - 1; y <= currentYear + 2; y++) {
    selYear.add(new Option(String(y), String(y)));
  }
  syncDateSelectorsFromAnchor();
}

function getMonthWeeks(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startMonday = getMonday(firstDay);
  const endMonday = getMonday(lastDay);
  const weeks = [];
  let cur = new Date(startMonday);
  while (cur <= endMonday) {
    weeks.push(new Date(cur));
    cur = addDays(cur, 7);
  }
  return weeks;
}

function syncDateSelectorsFromAnchor() {
  const selMonth = document.getElementById("selectMonth");
  const selYear = document.getElementById("selectYear");
  const selWeek = document.getElementById("selectWeek");
  if (!selMonth || !selYear || !selWeek) return;

  const year = state.anchorDate.getFullYear();
  const month = state.anchorDate.getMonth();

  selYear.value = String(year);
  selMonth.value = String(month);

  // Poblar todas las semanas del mes seleccionado
  selWeek.innerHTML = "";
  const weeks = getMonthWeeks(year, month);
  weeks.forEach((monday) => {
    const wNum = getISOWeekNumber(monday);
    const isoMonday = toIsoDate(monday);
    const sun = addDays(monday, 6);
    const label = `W${wNum} (${monday.getDate()}-${sun.getDate()} ${MONTHS_ES[sun.getMonth()].slice(0, 3)})`;
    selWeek.add(new Option(label, isoMonday));
  });

  const activeMondayIso = toIsoDate(getMonday(state.anchorDate));
  if (Array.from(selWeek.options).some((o) => o.value === activeMondayIso)) {
    selWeek.value = activeMondayIso;
  }
}

/* ---------- Renderizado de Cuadrícula Semanal (Escritorio + Móvil) ---------- */
function isMobileView() {
  if (state.viewMode === "mobile") return true;
  if (state.viewMode === "table") return false;
  return window.innerWidth <= 768;
}

function updateViewToggleLabel() {
  const btn = document.getElementById("btnToggleView");
  if (!btn) return;
  btn.textContent = isMobileView() ? "📊 Tabla" : "📱 Móvil";
}

function getVisibleWeeks() {
  if (state.calendarMode === "week" || state.calendarMode === "agenda") {
    return [getMonday(state.anchorDate)];
  }
  return getMonthWeeks(state.anchorDate.getFullYear(), state.anchorDate.getMonth());
}

function renderWeeks() {
  const activeEventId = document.activeElement?.dataset?.eventId || null;
  updateViewToggleLabel();
  syncDateSelectorsFromAnchor();
  if (isMobileView() || state.calendarMode === "agenda") {
    renderMobileWeeks();
  } else {
    renderTableWeeks();
  }
  if (activeEventId && !document.getElementById("eventModal")?.open) {
    const container = document.getElementById("weeksContainer");
    const restored = container?.querySelector(`.event-pill[data-event-id="${CSS.escape(activeEventId)}"]`);
    if (restored) restored.focus({ preventScroll: true });
  }
}

function renderMobileWeeks() {
  const container = document.getElementById("weeksContainer");
  container.innerHTML = "";

  const weeks = getVisibleWeeks();
  const todayIso = toIsoDate(new Date());
  const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const visibleMembers = state.team.filter((m) => isMemberVisible(m.id));

  for (const weekStart of weeks) {
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const weekNum = getISOWeekNumber(weekStart);
    const monthLabel = getMonthNameEs(weekDays[3]);

    const card = document.createElement("section");
    card.className = "mobile-week-card";
    card.dataset.weekMonday = toIsoDate(weekStart);

    const banner = document.createElement("div");
    banner.className = "mobile-week-banner";
    banner.textContent = `${monthLabel} · W${weekNum}`;
    card.appendChild(banner);

    const daysList = document.createElement("div");
    daysList.className = "mobile-days-list";

    weekDays.forEach((d, idx) => {
      const iso = toIsoDate(d);
      const isToday = iso === todayIso;
      const isWeekend = idx >= 5;

      const dayCard = document.createElement("div");
      dayCard.className = "mobile-day-card";
      dayCard.dataset.date = iso;

      // Soporte drag & drop también en tarjetas móviles (escritorio reducido o táctil)
      dayCard.ondragover = (e) => {
        e.preventDefault();
        dayCard.classList.add("drag-over");
      };
      dayCard.ondragleave = () => dayCard.classList.remove("drag-over");
      dayCard.ondrop = (e) => {
        e.preventDefault();
        dayCard.classList.remove("drag-over");
        const eventId = e.dataTransfer.getData("text/plain");
        const orig = state.events.find((x) => x.id === eventId);
        if (!orig) return;
        const targetMemberId =
          state.filters.members.length === 1 ? state.filters.members[0] : orig.memberId;
        promptDropAction(eventId, iso, targetMemberId);
      };

      const dayHeader = document.createElement("div");
      dayHeader.className =
        "mobile-day-header" +
        (isToday ? " is-today" : "") +
        (isWeekend ? " is-weekend" : "");
      dayHeader.innerHTML = `
        <span>${dayNames[idx]} ${d.getDate()}</span>
        <button type="button" class="mobile-add-btn">${state.clipboard ? "📋 Pegar" : "+ Añadir"}</button>
      `;
      dayHeader.querySelector(".mobile-add-btn").onclick = () => {
        const targetMember =
          state.filters.members.length === 1
            ? state.filters.members[0]
            : state.clipboard
              ? state.events.find((x) => x.id === state.clipboard.eventId)?.memberId || visibleMembers[0]?.id || "COORD"
              : visibleMembers[0]?.id || "COORD";
        if (state.clipboard) {
          pasteClipboardTo(iso, targetMember);
        } else {
          openEventModal({ date: iso, memberId: targetMember });
        }
      };
      dayCard.appendChild(dayHeader);

      const eventsBox = document.createElement("div");
      eventsBox.className = "mobile-day-events";

      let anyEvent = false;
      visibleMembers.forEach((member) => {
        const blocked = getBlockedInfo(iso, member.id);
        const cellEvents = getFilteredEventsForCell(iso, member.id);
        if (!blocked && !cellEvents.length) return;
        anyEvent = true;

        const row = document.createElement("div");
        row.className = "mobile-role-row";

        const badge = document.createElement("div");
        badge.className = "mobile-role-badge";
        badge.textContent = member.name;
        row.appendChild(badge);

        const stack = document.createElement("div");
        stack.className = "event-stack";
        if (blocked) {
          const blkEl = document.createElement("div");
          const locked = isCellLocked(blocked);
          blkEl.className = locked ? "blocked-badge" : "holiday-badge";
          blkEl.textContent = locked ? `🔒 ${blocked.label}` : blocked.label;
          stack.appendChild(blkEl);
        }
        cellEvents.forEach((ev) => stack.appendChild(renderEventPill(ev)));
        row.appendChild(stack);

        eventsBox.appendChild(row);
      });

      if (!anyEvent) {
        const empty = document.createElement("div");
        empty.className = "mobile-empty-day";
        empty.textContent = "Sin actividades";
        eventsBox.appendChild(empty);
      }

      dayCard.appendChild(eventsBox);
      daysList.appendChild(dayCard);
    });

    card.appendChild(daysList);
    container.appendChild(card);
  }
}

function renderTableWeeks() {
  const container = document.getElementById("weeksContainer");
  container.innerHTML = "";

  const weeks = getVisibleWeeks();
  const todayIso = toIsoDate(new Date());
  const weekdayLetters = ["L", "M", "X", "J", "V", "S", "D"];

  for (const weekStart of weeks) {
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const weekNum = getISOWeekNumber(weekStart);
    const monthLabel = getMonthNameEs(weekDays[3]);

    const block = document.createElement("div");
    block.className = "week-block";
    block.dataset.weekMonday = toIsoDate(weekStart);

    const table = document.createElement("table");
    table.className = "week-table";

    // Colgroup para proporciones fieles al Excel (L-V anchos, S-D estrechos)
    table.innerHTML = `
      <colgroup>
        <col class="col-role" />
        <col class="col-weekday" />
        <col class="col-weekday" />
        <col class="col-weekday" />
        <col class="col-weekday" />
        <col class="col-weekday" />
        <col class="col-weekend" />
        <col class="col-weekend" />
      </colgroup>
    `;

    const thead = document.createElement("thead");

    // Fila 1: Banner de semana + Ilustración estacional en la esquina superior izquierda
    const weekImgIdx = getWeekCornerImageIndex(weekStart, weekNum);
    const weekImgNum = String(weekImgIdx).padStart(2, "0");
    const trBanner = document.createElement("tr");
    trBanner.innerHTML = `
      <th rowspan="3" class="corner-season-cell" title="Semana ${weekNum}">
        <img class="corner-season-img" src="assets/weeks/w${weekImgNum}.jpg" alt="Semana ${weekNum}" loading="lazy" />
      </th>
      <th colspan="7" class="week-banner-cell">${monthLabel} · W${weekNum}</th>
    `;
    thead.appendChild(trBanner);

    // Fila 2: Letras L M X J V S D
    const trDays = document.createElement("tr");
    trDays.innerHTML = weekdayLetters
      .map((l) => `<th class="weekday-header-cell">${l}</th>`)
      .join("");
    thead.appendChild(trDays);

    // Fila 3: Números del día
    const trNums = document.createElement("tr");
    trNums.innerHTML = weekDays
      .map((d) => {
        const iso = toIsoDate(d);
        const cls = iso === todayIso ? "date-number-cell is-today" : "date-number-cell";
        return `<th class="${cls}" title="${iso}">${d.getDate()}</th>`;
      })
      .join("");
    thead.appendChild(trNums);
    table.appendChild(thead);

    // Cuerpo: Filas por cada miembro del equipo
    const tbody = document.createElement("tbody");
    const visibleMembers = state.team.filter((m) => isMemberVisible(m.id));

    visibleMembers.forEach((member) => {
      const tr = document.createElement("tr");

      // Columna izquierda: Rol / Persona
      const tdRole = document.createElement("td");
      tdRole.className = "role-cell";
      tdRole.innerHTML = `
        <div>${escapeHtml(member.name)}</div>
        ${member.email ? `<span class="role-email-hint" title="${escapeHtml(member.email)}">${escapeHtml(member.email)}</span>` : ""}
      `;
      tr.appendChild(tdRole);

      // Celdas L..D
      weekDays.forEach((d, idx) => {
        const iso = toIsoDate(d);
        const blocked = getBlockedInfo(iso, member.id);
        const locked = isCellLocked(blocked);
        const td = document.createElement("td");
        td.dataset.date = iso;
        td.dataset.memberId = member.id;
        td.className =
          "day-cell" +
          (idx >= 5 ? " weekend-cell" : "") +
          (locked ? " day-cell-blocked" : "");

        td.onmouseenter = () => {
          hoveredCell = { date: iso, memberId: member.id };
        };
        td.onmouseleave = () => {
          if (hoveredCell?.date === iso && hoveredCell?.memberId === member.id) hoveredCell = null;
        };

        td.onclick = (e) => {
          if (locked) {
            showToast(`Día bloqueado para ${member.name}: ${blocked.label}`);
            return;
          }
          if (state.clipboard) {
            pasteClipboardTo(iso, member.id);
            return;
          }
          if (
            e.target === td ||
            e.target.classList.contains("event-stack") ||
            e.target.classList.contains("holiday-badge")
          ) {
            openEventModal({ date: iso, memberId: member.id });
          }
        };

        // Arrastrar y soltar (solo bloqueado en Vacaciones/Días Extras, permitido en Festivos)
        td.ondragover = (e) => {
          if (locked) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = e.ctrlKey || e.altKey ? "copy" : "move";
          td.classList.add("drag-over");
        };
        td.ondragleave = () => td.classList.remove("drag-over");
        td.ondrop = (e) => {
          e.preventDefault();
          td.classList.remove("drag-over");
          if (locked) {
            showToast(`No se puede mover/copiar a un día bloqueado (${blocked.label})`);
            return;
          }
          const eventId = e.dataTransfer.getData("text/plain");
          if (eventId) {
            promptDropAction(eventId, iso, member.id);
          }
        };

        const stack = document.createElement("div");
        stack.className = "event-stack";

        if (blocked) {
          const blkEl = document.createElement("div");
          blkEl.className = locked ? "blocked-badge" : "holiday-badge";
          blkEl.title = locked
            ? "Vacaciones aprobadas (día bloqueado)"
            : "Festivo (puedes hacer clic para añadir actividad si trabajas este día)";
          blkEl.textContent = locked ? `🔒 ${blocked.label}` : blocked.label;
          stack.appendChild(blkEl);
        }

        const cellEvents = getFilteredEventsForCell(iso, member.id);
        cellEvents.forEach((ev) => {
          const pill = renderEventPill(ev);
          stack.appendChild(pill);
        });

        td.appendChild(stack);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    block.appendChild(table);
    container.appendChild(block);
  }
}

function getFilteredEventsForCell(dateIso, memberId) {
  const q = state.filters.search.trim().toLowerCase();
  const chFilter = state.filters.channel;

  const all = [...state.events, ...state.externalEvents];
  return all
    .filter((ev) => {
      if (ev.date !== dateIso) return false;
      if (ev.memberId !== memberId) return false;
      if (chFilter !== "all" && ev.channelId !== chFilter) return false;
      if (q) {
        const hay = `${ev.title} ${ev.location || ""} ${ev.notes || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (Boolean(a.allDay) !== Boolean(b.allDay)) return a.allDay ? -1 : 1;
      return normalizeTimeStr(a.startTime, "00:00").localeCompare(
        normalizeTimeStr(b.startTime, "00:00")
      );
    });
}

function renderEventPill(ev) {
  const ch = CHANNELS.find((c) => c.id === ev.channelId) || CHANNELS[0];
  const pill = document.createElement("div");
  const isCut = state.clipboard?.mode === "cut" && state.clipboard.eventId === ev.id;
  pill.className = "event-pill" + (ev.notes ? " has-notes" : "") + (isCut ? " cut-source" : "");
  pill.style.background = ev.customColor || ch.bg;
  pill.style.color = ev.customColor ? "#ffffff" : ch.fg;

  if (!ev.isExternal) {
    pill.draggable = true;
    pill.title = "Clic para editar · Ctrl+C copiar · Ctrl+X cortar · Arrastrar para mover/copiar";
    pill.onmouseenter = () => {
      hoveredEventId = ev.id;
    };
    pill.onmouseleave = () => {
      if (hoveredEventId === ev.id) hoveredEventId = null;
    };
    pill.ondragstart = (e) => {
      e.dataTransfer.setData("text/plain", ev.id);
      e.dataTransfer.effectAllowed = "copyMove";
      pill.classList.add("dragging");
    };
    pill.ondragend = () => pill.classList.remove("dragging");

    // Soporte táctil para móvil (mantener pulsado ~220ms y arrastrar a otro día/celda)
    attachTouchDrag(pill, ev);
  }

  const timeStr = ev.allDay ? "" : normalizeTimeStr(ev.startTime);
  const syncBadge = ev.googleEventId ? "G" : "";
  const extBadge = ev.isExternal ? `<span class="ext-badge">${escapeHtml(ev.sourceName || "EXT")}</span>` : "";
  const saveStateChip =
    ev._saveState === "error"
      ? `<span class="event-sync-chip is-error" title="${escapeHtml(ev._saveError || "Error de sincronización")}">⚠</span>`
      : ev._saveState === "pending"
        ? `<span class="event-sync-chip" title="Pendiente de sincronizar">⏳</span>`
        : "";

  if (!ev.isExternal) {
    pill.dataset.eventId = ev.id;
    pill.tabIndex = 0;
    pill.setAttribute("role", "button");
    pill.setAttribute(
      "aria-label",
      `${ev.title}, ${ev.date}${timeStr ? ", " + timeStr : ""}${ev._saveState === "error" ? ", error al sincronizar" : ""}`
    );
    pill.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        openEventModal(ev);
      }
    };
  }

  pill.innerHTML = `
    <div>${linkifyHtml(ev.title)}${saveStateChip}</div>
    ${ev.notes ? `<div class="event-notes-preview">${linkifyHtml(ev.notes)}</div>` : ""}
    ${
      timeStr || ev.location || syncBadge || extBadge
        ? `<div class="event-meta">
            <span>${[timeStr, linkifyHtml(ev.location || "")].filter(Boolean).join(" · ")}</span>
            <span>${extBadge}${syncBadge ? " ☁" : ""}</span>
          </div>`
        : ""
    }
  `;

  // Permitir abrir enlaces directamente sin abrir el modal de edición
  pill.querySelectorAll("a.event-link").forEach((a) => {
    a.onclick = (e) => e.stopPropagation();
  });

  pill.onclick = (e) => {
    e.stopPropagation();
    if (ev.isExternal) {
      showToast(`Evento externo (${ev.sourceName}): ${ev.title}`);
      return;
    }
    openEventModal(ev);
  };
  return pill;
}

function attachTouchDrag(pill, ev) {
  let holdTimer = null;
  let dragging = false;
  let ghost = null;
  let lastTarget = null;

  const cleanup = () => {
    clearTimeout(holdTimer);
    if (ghost) {
      ghost.remove();
      ghost = null;
    }
    if (lastTarget) {
      lastTarget.classList.remove("drag-over");
      lastTarget = null;
    }
    pill.classList.remove("dragging");
    dragging = false;
  };

  pill.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1 || e.target.closest("a.event-link")) return;
      const t = e.touches[0];
      holdTimer = setTimeout(() => {
        dragging = true;
        pill.classList.add("dragging");
        ghost = pill.cloneNode(true);
        ghost.className = pill.className + " touch-drag-ghost";
        ghost.style.width = `${pill.offsetWidth}px`;
        ghost.style.left = `${t.clientX - 40}px`;
        ghost.style.top = `${t.clientY - 20}px`;
        document.body.appendChild(ghost);
        if (navigator.vibrate) navigator.vibrate(25);
      }, 220);
    },
    { passive: true }
  );

  pill.addEventListener(
    "touchmove",
    (e) => {
      if (!dragging) {
        clearTimeout(holdTimer);
        return;
      }
      e.preventDefault();
      const t = e.touches[0];
      if (ghost) {
        ghost.style.left = `${t.clientX - 40}px`;
        ghost.style.top = `${t.clientY - 20}px`;
      }
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const dropTarget = el?.closest(".mobile-day-card[data-date], .day-cell[data-date]");
      if (lastTarget && lastTarget !== dropTarget) {
        lastTarget.classList.remove("drag-over");
      }
      if (dropTarget) {
        dropTarget.classList.add("drag-over");
      }
      lastTarget = dropTarget || null;
    },
    { passive: false }
  );

  pill.addEventListener("touchend", () => {
    if (!dragging) {
      clearTimeout(holdTimer);
      return;
    }
    const target = lastTarget;
    cleanup();
    if (!target) return;

    const targetDate = target.dataset.date;
    const targetMemberId = target.dataset.memberId || ev.memberId;
    if (!targetDate) return;

    promptDropAction(ev.id, targetDate, targetMemberId);
  });

  pill.addEventListener("touchcancel", cleanup);
}

/* ---------- Modal: Crear / Editar Evento ---------- */
function openEventModal(data = {}) {
  const modal = document.getElementById("eventModal");
  const isEdit = Boolean(data.id);

  document.getElementById("eventModalTitle").textContent = isEdit ? "Editar evento" : "Nuevo evento";
  document.getElementById("evId").value = data.id || "";
  document.getElementById("evGoogleId").value = data.googleEventId || "";
  document.getElementById("evGoogleCalId").value = data.googleCalId || "";
  document.getElementById("evTitle").value = data.title || "";
  document.getElementById("evMember").value = data.memberId || state.team[0]?.id || "COORD";
  document.getElementById("evChannel").value = data.channelId || "open_market";
  updateChannelColorDot();
  closeQuickTimePopover();
  document.getElementById("evDate").value = data.date || toIsoDate(new Date());
  document.getElementById("evStartTime").value = normalizeTimeStr(data.startTime, "09:30");
  document.getElementById("evEndTime").value = normalizeTimeStr(
    data.endTime,
    addOneHour(document.getElementById("evStartTime").value)
  );
  document.getElementById("evAllDay").checked = Boolean(data.allDay);
  document.getElementById("evNotes").value = data.notes || "";
  document.getElementById("evReminderPopup").value = data.popupMin ?? "60";

  const hasEmailAlert = Boolean(data.emailMin && data.emailMin !== "none");
  const emailCb = document.getElementById("evEnableEmailAlert");
  const emailSel = document.getElementById("evReminderEmail");
  emailCb.checked = hasEmailAlert;
  emailSel.disabled = !hasEmailAlert;
  emailSel.value = hasEmailAlert ? String(data.emailMin) : "60";

  document.getElementById("evSyncGoogle").checked = data.syncGoogle !== false;

  // Renderizar solo miembros del grupo (nunca invitados externos)
  renderGroupAttendeeChips(data.memberId || state.team[0]?.id, data.groupAttendees || []);

  // Si viene de hacer clic en una celda concreta (nuevo evento), ocultamos Persona/Fecha y mostramos un resumen
  const isNewFromCell = !isEdit && Boolean(data.date && data.memberId);
  const badge = document.getElementById("evContextBadge");
  const memberDateRow = document.getElementById("evMemberDateRow");
  if (isNewFromCell) {
    const memberObj = state.team.find((m) => m.id === data.memberId);
    document.getElementById("evContextText").textContent = `👤 ${memberObj?.name || data.memberId} · 📅 ${data.date}`;
    badge.classList.remove("hidden");
    memberDateRow.classList.add("hidden");
  } else {
    badge.classList.add("hidden");
    memberDateRow.classList.remove("hidden");
  }

  toggleTimeInputs();
  document.getElementById("btnDeleteEvent").classList.toggle("hidden", !isEdit);
  document.getElementById("btnCopyEvent").classList.toggle("hidden", !isEdit);
  document.getElementById("btnCutEvent").classList.toggle("hidden", !isEdit);
  modal.showModal();
  setTimeout(() => document.getElementById("evTitle").focus(), 30);
}

let hoveredEventId = null;
let hoveredCell = null;

function setClipboard(mode, eventId) {
  const ev = state.events.find((x) => x.id === eventId);
  if (!ev) return;
  state.clipboard = { mode, eventId };
  const bar = document.getElementById("clipboardBar");
  const txt = document.getElementById("clipboardText");
  if (bar && txt) {
    txt.textContent =
      mode === "copy"
        ? `📋 Copiando "${ev.title}" — Haz clic en cada día donde quieras pegarlo (Esc o Listo para terminar)`
        : `✂ Cortando "${ev.title}" — Haz clic en el día destino para moverlo`;
    bar.classList.remove("hidden");
  }
  renderWeeks();
}

function clearClipboard() {
  if (!state.clipboard) return;
  state.clipboard = null;
  document.getElementById("clipboardBar")?.classList.add("hidden");
  renderWeeks();
}

async function pasteClipboardTo(targetDate, targetMemberId) {
  if (!state.clipboard) return;
  const { mode, eventId } = state.clipboard;
  const orig = state.events.find((x) => x.id === eventId);
  if (!orig) {
    clearClipboard();
    return;
  }
  const isCopy = mode === "copy";
  const candidate = {
    ...orig,
    date: targetDate,
    memberId: targetMemberId,
  };
  const ok = await confirmAvailability(candidate, isCopy ? [] : [eventId]);
  if (!ok) return;

  saveUndoSnapshot(`${isCopy ? "Pegar copia" : "Pegar (cortado)"} "${orig.title}"`);
  await moveOrCopyEvent(eventId, targetDate, targetMemberId, isCopy);
  if (!isCopy) {
    clearClipboard();
  }
}

let pendingDrop = null;

function promptDropAction(eventId, targetDate, targetMemberId) {
  const orig = state.events.find((x) => x.id === eventId);
  if (!orig) return;

  pendingDrop = { eventId, targetDate, targetMemberId };

  // Poblar selector de usuario destino solo en modo móvil (en tabla ya se suelta sobre la fila del usuario)
  const selTarget = document.getElementById("dropTargetMember");
  const selLabel = document.getElementById("dropTargetMemberLabel");
  selTarget.innerHTML = "";
  state.team.forEach((m) => selTarget.add(new Option(m.name, m.id)));
  selTarget.value = targetMemberId || orig.memberId;
  if (selLabel) selLabel.classList.toggle("hidden", !isMobileView());

  const updateSummary = () => {
    const chosenMember = selTarget.value;
    const existingCount = state.events.filter(
      (x) => x.date === targetDate && x.memberId === chosenMember && x.id !== eventId
    ).length;
    const summaryEl = document.getElementById("dropActionSummary");
    summaryEl.textContent =
      `Evento: "${orig.title}" → ${chosenMember} (${targetDate}).` +
      (existingCount > 0
        ? ` En esta celda ya hay ${existingCount} evento(s). ¿Deseas copiarlo, sustituir el contenido o moverlo?`
        : ` ¿Deseas copiarlo, sustituir o moverlo aquí?`);
  };

  selTarget.onchange = updateSummary;
  updateSummary();
  document.getElementById("dropActionModal").showModal();
}

async function executeDropAction(mode) {
  if (!pendingDrop) return;
  const { eventId, targetDate } = pendingDrop;
  const targetMemberId = document.getElementById("dropTargetMember").value;

  const orig = state.events.find((x) => x.id === eventId);
  if (!orig) return;
  if (mode === "move" && orig.date === targetDate && orig.memberId === targetMemberId) {
    pendingDrop = null;
    document.getElementById("dropActionModal").close();
    return;
  }

  const toRemove =
    mode === "replace"
      ? state.events.filter((x) => x.date === targetDate && x.memberId === targetMemberId && x.id !== eventId)
      : [];
  const excludedIds = mode === "copy" ? [] : [eventId, ...toRemove.map((r) => r.id)];

  const ok = await confirmAvailability({ ...orig, date: targetDate, memberId: targetMemberId }, excludedIds);
  if (!ok) return;

  pendingDrop = null;
  document.getElementById("dropActionModal").close();

  saveUndoSnapshot(`${mode === "replace" ? "Sustituir" : mode === "copy" ? "Copiar" : "Mover"} "${orig.title}"`);

  // Si es sustituir, eliminamos los eventos previos de esa celda destino
  if (mode === "replace") {
    for (const rem of toRemove) {
      if (APPS_SCRIPT_URL) {
        const op = queueEventChange("delete", rem);
        if (op) await sendQueuedOperation(op);
      } else if (rem.googleEventId && state.accessToken) {
        try {
          const calId = encodeURIComponent(rem.googleCalId || "primary");
          await gFetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${rem.googleEventId}`,
            { method: "DELETE" }
          );
        } catch (err) {
          console.warn("No se pudo eliminar evento sustituido en Google:", err);
        }
      }
    }
    state.events = state.events.filter(
      (x) => !(x.date === targetDate && x.memberId === targetMemberId && x.id !== eventId)
    );
  }

  const isCopy = mode === "copy";
  await moveOrCopyEvent(eventId, targetDate, targetMemberId, isCopy);
  if (mode === "replace") {
    showToast(`Celda de ${targetMemberId} (${targetDate}) sustituida`, true);
  }
}

function buildAttendeeEmails(memberId, groupAttendees = []) {
  const emails = [];
  const addById = (id) => {
    const m = state.team.find((x) => x.id === id);
    const em = (m?.email || "").trim().toLowerCase();
    if (em && !emails.includes(em)) emails.push(em);
  };
  addById(memberId);
  (groupAttendees || []).forEach(addById);
  return emails;
}

async function moveOrCopyEvent(eventId, targetDate, targetMemberId, isCopy) {
  const orig = state.events.find((x) => x.id === eventId);
  if (!orig) return;

  if (!isCopy && orig.date === targetDate && orig.memberId === targetMemberId) return;

  const updated = isCopy
    ? {
        ...orig,
        id: `ev-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        googleEventId: null,
        googleCalId: null,
        date: targetDate,
        memberId: targetMemberId,
        attendeeEmails: buildAttendeeEmails(targetMemberId, orig.groupAttendees),
      }
    : {
        ...orig,
        date: targetDate,
        memberId: targetMemberId,
        attendeeEmails: buildAttendeeEmails(targetMemberId, orig.groupAttendees),
      };

  if (updated.syncGoogle && state.accessToken) {
    try {
      const synced = await upsertGoogleCalendarEvent(updated);
      updated.googleEventId = synced.id;
      updated.googleCalId = state.googleCfg.primaryCalendarId || "primary";
    } catch (err) {
      console.warn("Error sincronizando movimiento/copia en Google:", err);
    }
  }

  if (isCopy) {
    state.events.push(updated);
    showToast(`Evento copiado a ${targetMemberId} (${targetDate})`, true);
  } else {
    const idx = state.events.findIndex((x) => x.id === eventId);
    if (idx >= 0) state.events[idx] = updated;
    showToast(`Evento movido a ${targetMemberId} (${targetDate})`, true);
  }

  saveEvents();
  renderWeeks();
  if (APPS_SCRIPT_URL) {
    const op = queueEventChange("upsert", updated);
    if (op) sendQueuedOperation(op);
  }
}

function renderGroupAttendeeChips(primaryMemberId, selectedIds = []) {
  const container = document.getElementById("evGroupAttendees");
  container.innerHTML = "";
  state.team.forEach((m) => {
    if (m.id === primaryMemberId) return;
    const hasEmail = Boolean(m.email && m.email.includes("@"));
    const label = document.createElement("label");
    label.className = "group-chip" + (hasEmail ? "" : " disabled");
    label.title = hasEmail ? m.email : "Añade su correo en 'Equipo' para notificarle";
    label.innerHTML = `
      <input type="checkbox" value="${escapeHtml(m.id)}" ${selectedIds.includes(m.id) ? "checked" : ""} ${hasEmail ? "" : "disabled"} />
      <span>${escapeHtml(m.name)}</span>
    `;
    container.appendChild(label);
  });
}

function addOneHour(hhmm) {
  const [h, m] = String(hhmm || "09:30").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "10:30";
  const nextH = Math.min(23, h + 1);
  const nextM = h >= 23 ? 59 : m;
  return `${String(nextH).padStart(2, "0")}:${String(nextM).padStart(2, "0")}`;
}

function updateChannelColorDot() {
  const sel = document.getElementById("evChannel");
  const dot = document.getElementById("evChannelDot");
  if (!sel || !dot) return;
  const ch = CHANNELS.find((c) => c.id === sel.value) || CHANNELS[0];
  dot.style.background = ch ? ch.bg : "#9ca3af";
}

function addMinutesToTime(hhmm, deltaMin) {
  const [h, m] = String(hhmm || "09:30").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "09:30";
  const total = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + deltaMin));
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function closeQuickTimePopover() {
  const pop = document.getElementById("quickTimePopover");
  if (!pop) return;
  pop.classList.add("hidden");
  pop.innerHTML = "";
  pop.dataset.target = "";
}

function applyQuickTime(inputId, nextVal) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.value = nextVal;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  closeQuickTimePopover();
}

function openQuickTimePopover(targetInputId, anchorEl) {
  const pop = document.getElementById("quickTimePopover");
  const input = document.getElementById(targetInputId);
  if (!pop || !input || input.disabled) return;

  if (!pop.classList.contains("hidden") && pop.dataset.target === targetInputId) {
    closeQuickTimePopover();
    return;
  }

  const currentVal = normalizeTimeStr(input.value, "09:30");
  const isEnd = targetInputId === "evEndTime";
  const startVal = normalizeTimeStr(document.getElementById("evStartTime")?.value, "09:30");

  const presets = [];
  for (let h = 8; h <= 20; h++) {
    presets.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 20) presets.push(`${String(h).padStart(2, "0")}:30`);
  }

  const durationHtml = isEnd
    ? `<div class="quick-time-section-title">Duración desde ${escapeHtml(startVal)}</div>
       <div class="quick-time-durations">
         <button type="button" class="qt-btn qt-accent" data-qt-val="${addMinutesToTime(startVal, 30)}">+30m</button>
         <button type="button" class="qt-btn qt-accent" data-qt-val="${addMinutesToTime(startVal, 60)}">+1h</button>
         <button type="button" class="qt-btn qt-accent" data-qt-val="${addMinutesToTime(startVal, 90)}">+1h30</button>
         <button type="button" class="qt-btn qt-accent" data-qt-val="${addMinutesToTime(startVal, 120)}">+2h</button>
       </div>`
    : "";

  pop.innerHTML = `
    <div class="quick-time-section-title">Ajuste rápido</div>
    <div class="quick-time-steppers">
      <button type="button" class="qt-btn" data-qt-val="${addMinutesToTime(currentVal, -30)}">-30m</button>
      <button type="button" class="qt-btn" data-qt-val="${addMinutesToTime(currentVal, -15)}">-15m</button>
      <button type="button" class="qt-btn" data-qt-val="${addMinutesToTime(currentVal, 15)}">+15m</button>
      <button type="button" class="qt-btn" data-qt-val="${addMinutesToTime(currentVal, 30)}">+30m</button>
    </div>
    ${durationHtml}
    <div class="quick-time-section-title">Horas habituales</div>
    <div class="quick-time-grid">
      ${presets
        .map(
          (t) =>
            `<button type="button" class="qt-btn${t === currentVal ? " active" : ""}" data-qt-val="${t}">${t}</button>`
        )
        .join("")}
    </div>
  `;

  pop.dataset.target = targetInputId;
  pop.classList.remove("hidden");

  const rect = anchorEl.getBoundingClientRect();
  const popWidth = 248;
  const left = Math.max(8, Math.min(window.innerWidth - popWidth - 8, rect.left));
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow >= 280 ? rect.bottom + 6 : Math.max(8, rect.top - 290);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;

  pop.querySelectorAll("[data-qt-val]").forEach((btn) => {
    btn.onclick = () => applyQuickTime(targetInputId, btn.dataset.qtVal);
  });
}

function toggleTimeInputs() {
  const allDay = document.getElementById("evAllDay").checked;
  document.getElementById("evStartTime").disabled = allDay;
  document.getElementById("evEndTime").disabled = allDay;
  document.getElementById("evStartTimeField")?.classList.toggle("disabled", allDay);
  document.getElementById("evEndTimeField")?.classList.toggle("disabled", allDay);
  document.querySelectorAll(".time-picker-btn").forEach((btn) => {
    btn.disabled = allDay;
  });
  if (allDay) closeQuickTimePopover();
}

let isSavingEvent = false;

async function handleSaveEvent(e) {
  e.preventDefault();
  if (isSavingEvent) return;
  isSavingEvent = true;

  const saveBtn = document.getElementById("btnSaveEvent");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando...";
  }

  try {
    const startTimeVal = document.getElementById("evStartTime").value;
    const endTimeVal = document.getElementById("evEndTime").value;
    const allDayVal = document.getElementById("evAllDay").checked;

    const id = document.getElementById("evId").value || `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const ev = {
      id,
      googleEventId: document.getElementById("evGoogleId").value || null,
      googleCalId: document.getElementById("evGoogleCalId").value || null,
      title: document.getElementById("evTitle").value.trim(),
      memberId: document.getElementById("evMember").value,
      channelId: document.getElementById("evChannel").value,
      date: document.getElementById("evDate").value,
      startTime: startTimeVal,
      endTime: endTimeVal,
      allDay: allDayVal,
      location: "",
      notes: document.getElementById("evNotes").value.trim(),
      popupMin: document.getElementById("evReminderPopup").value,
      emailMin: document.getElementById("evEnableEmailAlert").checked
        ? document.getElementById("evReminderEmail").value
        : "none",
      syncGoogle: document.getElementById("evSyncGoogle").checked,
      groupAttendees: Array.from(
        document.querySelectorAll("#evGroupAttendees input:checked")
      ).map((cb) => cb.value),
    };
    ev.attendeeEmails = buildAttendeeEmails(ev.memberId, ev.groupAttendees);

    const allowed = await confirmAvailability(ev, [id]);
    if (!allowed) return;

    const idx = state.events.findIndex((item) => item.id === id);
    saveUndoSnapshot(idx >= 0 ? `Editar "${ev.title}"` : `Crear "${ev.title}"`);

    // Guardado optimista inmediato: cierra el modal al instante para evitar dobles clics
    if (idx >= 0) state.events[idx] = ev;
    else state.events.push(ev);

    const op = queueEventChange("upsert", ev);
    saveEvents();
    document.getElementById("eventModal").close();
    renderWeeks();

    if (APPS_SCRIPT_URL) {
      showToast("Guardando evento y actualizando Google Calendar...", true);
      const res = op ? await sendQueuedOperation(op) : await postToAppsScript({ action: "upsert", event: ev });
      if (!res?.ok) {
        showToast("Guardado en el dispositivo (pendiente de reintentar con Google).", true);
      } else if (res.syncStatus === "error" || res.syncStatus === "no_recipients") {
        showToast(`Guardado en la web, pero aviso en Calendar: ${res.syncError || res.syncStatus}`, true);
      } else {
        showToast("Evento guardado para todo el grupo y actualizado en Google Calendar.", true);
      }
    } else if (ev.syncGoogle && state.accessToken) {
      try {
        const synced = await upsertGoogleCalendarEvent(ev);
        ev.googleEventId = synced.id;
        ev.googleCalId = state.googleCfg.primaryCalendarId || "primary";
        saveEvents();
        renderWeeks();
        showToast("Evento guardado y enviado a Google Calendar (alertas activas)");
      } catch (err) {
        console.error(err);
        showToast("Guardado localmente, pero falló envío a Google: " + err.message);
      }
    } else if (ev.syncGoogle && !state.accessToken) {
      const gcalUrl = buildGoogleCalendarTemplateUrl(ev);
      window.open(gcalUrl, "_blank", "noopener,noreferrer");
      showToast("Evento guardado. Se abrió Google Calendar para enviar la alerta al grupo.");
    } else {
      showToast("Evento guardado localmente.");
    }
  } finally {
    isSavingEvent = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Guardar evento";
    }
  }
}

async function handleDeleteEvent() {
  const id = document.getElementById("evId").value;
  const ev = state.events.find((x) => x.id === id);
  if (!ev) return;

  saveUndoSnapshot(`Eliminar "${ev.title}"`);
  state.events = state.events.filter((x) => x.id !== id);
  const op = APPS_SCRIPT_URL ? queueEventChange("delete", ev) : null;
  saveEvents();
  document.getElementById("eventModal").close();
  renderWeeks();
  showToast("Evento eliminado", true);

  if (APPS_SCRIPT_URL) {
    if (op) await sendQueuedOperation(op);
  } else if (ev.googleEventId && state.accessToken) {
    try {
      const calId = encodeURIComponent(ev.googleCalId || "primary");
      await gFetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${ev.googleEventId}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.warn("No se pudo eliminar en Google Calendar:", err);
    }
  }
}

/* ---------- Gestión del Equipo y Correos ---------- */
function renderTeamList() {
  const list = document.getElementById("teamList");
  list.innerHTML = "";
  state.team.forEach((m, index) => {
    const row = document.createElement("div");
    row.className = "team-item";
    row.innerHTML = `
      <strong>${escapeHtml(m.name)}</strong>
      <input type="email" value="${escapeHtml(m.email || "")}" placeholder="correo@empresa.com" data-idx="${index}" data-field="email" />
      <button type="button" class="btn btn-secondary" data-remove-member="${index}" title="Eliminar">🗑</button>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll("input").forEach((inp) => {
    inp.onchange = () => {
      const idx = Number(inp.dataset.idx);
      state.team[idx][inp.dataset.field] = inp.value.trim();
      saveTeam();
      if (APPS_SCRIPT_URL) postToAppsScript({ action: "saveTeam", team: state.team });
      renderLegendAndSelects();
      renderWeeks();
    };
  });

  list.querySelectorAll("[data-remove-member]").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.removeMember);
      state.team.splice(idx, 1);
      saveTeam();
      if (APPS_SCRIPT_URL) postToAppsScript({ action: "saveTeam", team: state.team });
      renderTeamList();
      renderLegendAndSelects();
      renderWeeks();
    };
  });
}

/* ---------- Google Identity Services (OAuth 2.0 Client-Side, 0 €) ---------- */
function initGoogleAuth() {
  const clientId = state.googleCfg.clientId;
  const clientInput = document.getElementById("googleClientIdInput");
  const primaryInput = document.getElementById("primaryCalendarIdInput");
  const vacInput = document.getElementById("vacationsSheetIdInput");
  if (clientInput) clientInput.value = clientId || "";
  if (primaryInput) primaryInput.value = state.googleCfg.primaryCalendarId || "primary";
  if (vacInput) vacInput.value = state.googleCfg.vacationsSheetId || DEFAULT_VACATIONS_SHEET_ID;

  if (!clientId) return;

  if (window.google?.accounts?.oauth2) {
    state.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/spreadsheets.readonly",
      callback: (resp) => {
        if (resp.error) {
          showToast("Error de autenticación Google: " + resp.error);
          return;
        }
        state.accessToken = resp.access_token;
        updateGoogleStatusUI(true);
        showToast("Conectado a Google Workspace");
        syncFromGoogleCalendars();
      },
    });
  }
}

function buildGoogleCalendarTemplateUrl(ev) {
  const member = state.team.find((m) => m.id === ev.memberId);
  const ch = CHANNELS.find((c) => c.id === ev.channelId);
  const emails = [];
  if (member?.email) emails.push(member.email);
  (ev.groupAttendees || []).forEach((mId) => {
    const gm = state.team.find((m) => m.id === mId);
    if (gm?.email && !emails.includes(gm.email)) emails.push(gm.email);
  });

  const dateCompact = ev.date.replace(/-/g, "");
  let datesParam;
  if (ev.allDay) {
    const nextDay = toIsoDate(addDays(new Date(ev.date + "T00:00:00"), 1)).replace(/-/g, "");
    datesParam = `${dateCompact}/${nextDay}`;
  } else {
    const s = (ev.startTime || "09:00").replace(":", "") + "00";
    const e = (ev.endTime || "10:00").replace(":", "") + "00";
    datesParam = `${dateCompact}T${s}/${dateCompact}T${e}`;
  }

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `[${ev.memberId}] ${ev.title}`,
    dates: datesParam,
    details: `Canal: ${ch?.label || ev.channelId}\nAsignado a: ${member?.name || ev.memberId}\n${ev.notes || ""}`,
  });
  if (ev.location) params.set("location", ev.location);
  if (emails.length) params.set("add", emails.join(","));
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function requestGoogleLogin() {
  if (!state.googleCfg.clientId) {
    document.getElementById("calendarsModal").showModal();
    return;
  }
  if (!state.tokenClient) initGoogleAuth();
  if (state.tokenClient) {
    state.tokenClient.requestAccessToken({ prompt: state.accessToken ? "" : "consent" });
  } else {
    showToast("Cargando librería de Google... intenta en un segundo.");
  }
}

function updateGoogleStatusUI(connected) {
  if (connected && !state.syncTimer) {
    state.syncTimer = setInterval(() => {
      if (state.accessToken) syncFromGoogleCalendars(true);
    }, 45000);
  } else if (!connected && state.syncTimer) {
    clearInterval(state.syncTimer);
    state.syncTimer = null;
  }
}

async function gFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${state.accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }
  return res.status === 204 ? null : res.json();
}

async function upsertGoogleCalendarEvent(ev) {
  const calId = encodeURIComponent(state.googleCfg.primaryCalendarId || "primary");
  const member = state.team.find((m) => m.id === ev.memberId);
  const ch = CHANNELS.find((c) => c.id === ev.channelId);

  // Solo se permite invitar a miembros del grupo (nunca a personas externas)
  const allowedTeamEmails = new Set(
    state.team.map((m) => (m.email || "").trim().toLowerCase()).filter(Boolean)
  );
  const attendees = [];
  const pushGroupEmail = (email) => {
    const clean = (email || "").trim().toLowerCase();
    if (clean && allowedTeamEmails.has(clean) && !attendees.some((a) => a.email === clean)) {
      attendees.push({ email: clean });
    }
  };

  if (member?.email) pushGroupEmail(member.email);
  (ev.groupAttendees || []).forEach((mId) => {
    const gm = state.team.find((m) => m.id === mId);
    if (gm?.email) pushGroupEmail(gm.email);
  });

  const overrides = [];
  if (ev.popupMin !== "none") overrides.push({ method: "popup", minutes: Number(ev.popupMin) });
  if (ev.emailMin !== "none") overrides.push({ method: "email", minutes: Number(ev.emailMin) });

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid";
  const body = {
    summary: `[${ev.memberId}] ${ev.title}`,
    location: ev.location || undefined,
    description: `Canal: ${ch?.label || ev.channelId}\nAsignado a: ${member?.name || ev.memberId}\n\n${ev.notes || ""}`,
    attendees: attendees.length ? attendees : undefined,
    extendedProperties: {
      shared: {
        memberId: ev.memberId,
        channelId: ev.channelId,
        notes: ev.notes || "",
      },
    },
    reminders: {
      useDefault: false,
      overrides,
    },
    start: ev.allDay
      ? { date: ev.date }
      : { dateTime: `${ev.date}T${ev.startTime || "09:00"}:00`, timeZone: tz },
    end: ev.allDay
      ? { date: toIsoDate(addDays(new Date(ev.date + "T00:00:00"), 1)) }
      : { dateTime: `${ev.date}T${ev.endTime || "10:00"}:00`, timeZone: tz },
  };

  if (ev.googleEventId) {
    return gFetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${ev.googleEventId}?sendUpdates=all`,
      { method: "PUT", body: JSON.stringify(body) }
    );
  }
  return gFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?sendUpdates=all`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

async function syncFromGoogleCalendars(silent = false) {
  if (!state.accessToken) return;
  const baseMonday = getMonday(state.anchorDate);
  const timeMin = baseMonday.toISOString();
  const timeMax = addDays(baseMonday, 21).toISOString();

  // 1) Sincronizar el calendario compartido del grupo (lectura/escritura colaborativa)
  const sharedCalId = state.googleCfg.primaryCalendarId || "primary";
  try {
    const sharedUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(sharedCalId)}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;
    const sharedData = await gFetch(sharedUrl);
    const remoteEvents = (sharedData.items || [])
      .map((item) => mapGoogleEventToLocal(item, sharedCalId))
      .filter(Boolean);

    // Conservar eventos locales de otras fechas o no sincronizados, y actualizar los del rango sincronizado
    const minIso = toIsoDate(baseMonday);
    const maxIso = toIsoDate(addDays(baseMonday, 21));
    const keptLocal = state.events.filter(
      (ev) => !ev.googleEventId && (ev.date < minIso || ev.date >= maxIso)
    );
    state.events = [...keptLocal, ...remoteEvents];
    saveEvents();
  } catch (err) {
    console.warn("Error leyendo calendario compartido del grupo:", err.message);
  }

  // 2) No se leen calendarios personales del equipo para respetar su privacidad
  state.externalEvents = [];

  // 3) Sincronizar Festivos y Vacaciones desde el Google Sheet "Usuarios APP"
  await syncVacationsAndHolidaysFromSheet(true);

  renderWeeks();
  if (!silent) {
    showToast(`Sincronizado con el grupo (${state.events.length} eventos)`);
  }
}

/* ---------- Lector de Google Sheet: FESTIVOS y VACACIONES (Usuarios APP) ---------- */
function mapSheetUserToMemberId(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return null;
  if (s === "tm" || s.includes("tomás") || s.includes("tomas")) return "TM1";
  if (s === "ts" || s.includes("fabio")) return "TS1";
  if (s === "tn" || s.includes("hamza")) return "TN1";
  if (s === "tb" || s.includes("carles")) return "TB1";
  if (s === "tl" || s.includes("francisco")) return "TL1";
  if (s.includes("coordinator") || s === "coord" || s.includes("victor") || s.includes("víctor")) return "COORD";
  if (s.includes("creator") || s.includes("david")) return "David";
  const exact = state.team.find((m) => m.id.toLowerCase() === s || m.name.toLowerCase() === s);
  return exact ? exact.id : null;
}

function parseShortDateToken(token, defaultYear = 2026) {
  const m = String(token || "").trim().match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = defaultYear;
  if (m[3]) {
    year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  }
  return new Date(year, month - 1, day);
}

async function fetchSheetValues(sheetId, sheetName) {
  if (state.accessToken) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(sheetName + "!A1:R500")}`;
    const data = await gFetch(url);
    return data.values || [];
  }
  // Fallback sin login si la hoja está compartida con el enlace
  const csvUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error("Hoja privada: conecta Google arriba para leerla.");
  const text = await res.text();
  if (text.trim().startsWith("<!DOCTYPE") || text.includes("accounts.google.com")) {
    throw new Error("Hoja privada: conecta Google arriba para leerla.");
  }
  return parseCsvRows(text);
}

function parseCsvRows(csv) {
  return csv
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const out = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === "," && !inQuotes) {
          out.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out;
    });
}

async function syncVacationsAndHolidaysFromSheet(silent = false) {
  const sheetId = (
    document.getElementById("vacationsSheetIdInput")?.value ||
    state.googleCfg.vacationsSheetId ||
    DEFAULT_VACATIONS_SHEET_ID
  ).trim();
  if (!sheetId) {
    if (!silent) showToast("Indica el ID del Google Sheet de Festivos y Vacaciones.");
    return;
  }

  const nextBlocked = {};
  let festivosCount = 0;
  let vacacionesCount = 0;

  try {
    // 1. Pestaña FESTIVOS (Usuario, Nombre, Sede, FESTIVO 1..15 en formato DD/MM)
    const festRows = await fetchSheetValues(sheetId, "FESTIVOS");
    for (let r = 1; r < festRows.length; r++) {
      const row = festRows[r];
      const memberId = mapSheetUserToMemberId(row[0]) || mapSheetUserToMemberId(row[1]);
      if (!memberId) continue;
      for (let c = 3; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;
        [2026, 2027].forEach((yr) => {
          const dt = parseShortDateToken(cell, yr);
          if (!dt || Number.isNaN(dt.getTime())) return;
          const iso = toIsoDate(dt);
          nextBlocked[`${memberId}|${iso}`] = { type: "FESTIVO", label: "FESTIVO" };
          festivosCount++;
        });
      }
    }

    // 2. Pestaña VACACIONES (DATA, Trainer, FECHA, MES, OPCIÓN, Estado, DÍAS, ID)
    const vacRows = await fetchSheetValues(sheetId, "VACACIONES");
    for (let r = 1; r < vacRows.length; r++) {
      const row = vacRows[r];
      const estado = String(row[5] || "").trim().toLowerCase();
      if (estado !== "aprobado") continue;

      const memberId = mapSheetUserToMemberId(row[1]);
      if (!memberId) continue;

      const fechaTxt = String(row[2] || "").trim();
      const opcion = String(row[4] || "Vacaciones").trim().toUpperCase();
      const label = opcion.includes("EXTRA") ? "DÍA EXTRA" : "VACACIONES";

      // Rango: "Del 21/12/26 al 31/12/26"
      const rangeMatch = fechaTxt.match(/del\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+al\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
      if (rangeMatch) {
        const startDt = parseShortDateToken(rangeMatch[1], 2026);
        const endDt = parseShortDateToken(rangeMatch[2], 2026);
        if (startDt && endDt && startDt <= endDt) {
          let cur = new Date(startDt);
          let guard = 0;
          while (cur <= endDt && guard++ < 90) {
            nextBlocked[`${memberId}|${toIsoDate(cur)}`] = { type: label, label };
            vacacionesCount++;
            cur = addDays(cur, 1);
          }
        }
      } else {
        // Día suelto: "Día 23/12/26"
        const singleDt = parseShortDateToken(fechaTxt, 2026);
        if (singleDt && !Number.isNaN(singleDt.getTime())) {
          nextBlocked[`${memberId}|${toIsoDate(singleDt)}`] = { type: label, label };
          vacacionesCount++;
        }
      }
    }

    state.blockedDays = nextBlocked;
    saveBlockedDays();
    renderWeeks();
    if (!silent) {
      showToast(`Festivos (${festivosCount}) y Vacaciones (${vacacionesCount} días) bloqueados`);
    }
  } catch (err) {
    console.warn("Error leyendo Google Sheet de Festivos/Vacaciones:", err);
    if (!silent) {
      showToast("No se pudo leer el Sheet de Festivos/Vacaciones: " + err.message);
    }
  }
}

function mapGoogleEventToLocal(item, calId) {
  const startStr = item.start?.date || item.start?.dateTime;
  if (!startStr) return null;
  const props = item.extendedProperties?.shared || {};
  const rawSummary = item.summary || "(Sin título)";
  const roleMatch = rawSummary.match(/^\[([^\]]+)\]\s*(.*)$/);
  const inferredMember = roleMatch && state.team.some((m) => m.id === roleMatch[1]) ? roleMatch[1] : null;

  return {
    id: `g-${item.id}`,
    googleEventId: item.id,
    googleCalId: calId,
    title: roleMatch ? roleMatch[2] : rawSummary,
    memberId: props.memberId || inferredMember || state.team[0]?.id || "COORD",
    channelId: props.channelId || "open_market",
    date: startStr.slice(0, 10),
    allDay: Boolean(item.start?.date),
    startTime: item.start?.dateTime ? item.start.dateTime.slice(11, 16) : "09:00",
    endTime: item.end?.dateTime ? item.end.dateTime.slice(11, 16) : "10:00",
    location: item.location || "",
    notes: props.notes || "",
    popupMin: "60",
    emailMin: "1440",
    syncGoogle: true,
  };
}

/* ---------- Exportación .ICS ---------- */

function eventsForExport(scope = "view") {
  if (scope === "all") return [...state.events];
  const visibleWeeks = getVisibleWeeks();
  const visibleDates = new Set();
  visibleWeeks.forEach((ws) => {
    for (let i = 0; i < 7; i++) visibleDates.add(toIsoDate(addDays(ws, i)));
  });
  const q = state.filters.search.trim().toLowerCase();
  const chFilter = state.filters.channel;
  return state.events.filter((ev) => {
    if (visibleDates.size && !visibleDates.has(ev.date)) return false;
    if (!isMemberVisible(ev.memberId)) return false;
    if (chFilter !== "all" && ev.channelId !== chFilter) return false;
    if (q) {
      const hay = `${ev.title} ${ev.location || ""} ${ev.notes || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function escapeIcsText(val) {
  return String(val || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildICS(events) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Calendario Training Xiaomi//ES",
    "CALSCALE:GREGORIAN",
    "X-WR-TIMEZONE:Europe/Madrid",
  ];

  events.forEach((ev) => {
    const dtStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const dateCompact = ev.date.replace(/-/g, "");
    const member = state.team.find((m) => m.id === ev.memberId);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.id}@calendario-training`);
    lines.push(`DTSTAMP:${dtStamp}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateCompact}`);
    } else {
      const s = (normalizeTimeStr(ev.startTime, "09:00") || "09:00").replace(":", "") + "00";
      const e = (normalizeTimeStr(ev.endTime, "10:00") || "10:00").replace(":", "") + "00";
      lines.push(`DTSTART;TZID=Europe/Madrid:${dateCompact}T${s}`);
      lines.push(`DTEND;TZID=Europe/Madrid:${dateCompact}T${e}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(`[${ev.memberId}] ${ev.title}`)}`);
    if (ev.location) lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
    if (ev.notes) lines.push(`DESCRIPTION:${escapeIcsText(ev.notes)}`);
    if (member?.email) lines.push(`ATTENDEE;CN=${escapeIcsText(member.name)}:mailto:${member.email}`);

    // Alarma nativa para móvil y PC
    if (ev.popupMin && ev.popupMin !== "none") {
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(`DESCRIPTION:${escapeIcsText(`Recordatorio: ${ev.title}`)}`);
      lines.push(`TRIGGER:-PT${ev.popupMin}M`);
      lines.push("END:VALARM");
    }
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function exportICS(scope = "view") {
  const list = eventsForExport(scope);
  if (list.length === 0) {
    showToast("No hay eventos que exportar en esta selección.");
    return;
  }
  const icsText = buildICS(list);
  const blob = new Blob([icsText], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = scope === "all" ? "calendario-training-completo.ics" : "calendario-training-vista.ics";
  a.click();
  showToast(
    `Exportados ${list.length} evento(s) (${scope === "all" ? "todo el calendario" : "vista actual"}).`
  );
}

function handleIcsImport(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || "");
    const blocks = text.split("BEGIN:VEVENT").slice(1);
    let count = 0;
    blocks.forEach((b) => {
      const summary = (b.match(/SUMMARY[^:]*:(.*)/) || [])[1]?.trim();
      const dtstart = (b.match(/DTSTART[^:]*:(\d{8})(T(\d{4}))?/) || []);
      if (!summary || !dtstart[1]) return;
      const rawDate = dtstart[1];
      const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      const startTime = dtstart[3] ? `${dtstart[3].slice(0, 2)}:${dtstart[3].slice(2, 4)}` : "09:00";
      state.externalEvents.push({
        id: `ics-${Date.now()}-${count++}`,
        title: summary,
        memberId: state.team[0]?.id || "COORD",
        channelId: "otros",
        customColor: "#475569",
        date,
        allDay: !dtstart[3],
        startTime,
        isExternal: true,
        sourceName: "ICS",
      });
    });
    renderWeeks();
    showToast(`Importados ${count} eventos desde el archivo .ICS`);
  };
  reader.readAsText(file);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkifyHtml(str) {
  const escaped = escapeHtml(str);
  return escaped.replace(/(https?:\/\/[^\s<>"']+)/gi, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="event-link">${url}</a>`;
  });
}

/* ---------- Inicialización y Eventos UI ---------- */
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  renderLegendAndSelects();
  populateDateSelectors();
  renderWeeks();
  initGoogleAuth();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  if (APPS_SCRIPT_URL) {
    syncFromAppsScript(true);
    setInterval(() => syncFromAppsScript(true), 20000);
  }

  document.getElementById("btnPrevWeek").onclick = () => {
    if (state.calendarMode === "week" || state.calendarMode === "agenda") {
      state.anchorDate = addDays(state.anchorDate, -7);
    } else {
      state.anchorDate = new Date(state.anchorDate.getFullYear(), state.anchorDate.getMonth() - 1, 1);
    }
    renderWeeks();
  };
  document.getElementById("btnNextWeek").onclick = () => {
    if (state.calendarMode === "week" || state.calendarMode === "agenda") {
      state.anchorDate = addDays(state.anchorDate, 7);
    } else {
      state.anchorDate = new Date(state.anchorDate.getFullYear(), state.anchorDate.getMonth() + 1, 1);
    }
    renderWeeks();
  };
  document.getElementById("btnToday").onclick = () => {
    state.anchorDate = new Date();
    renderWeeks();
    const target = document.querySelector(`[data-week-monday="${toIsoDate(getMonday(new Date()))}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  document.querySelectorAll("[data-calendar-mode]").forEach((btn) => {
    btn.onclick = () => {
      state.calendarMode = btn.dataset.calendarMode;
      document.querySelectorAll("[data-calendar-mode]").forEach((b) =>
        b.classList.toggle("is-active", b === btn)
      );
      renderWeeks();
    };
  });

  const jumpToMonthYear = () => {
    const y = Number(document.getElementById("selectYear").value);
    const m = Number(document.getElementById("selectMonth").value);
    state.anchorDate = new Date(y, m, 1);
    renderWeeks();
  };
  document.getElementById("selectMonth").onchange = jumpToMonthYear;
  document.getElementById("selectYear").onchange = jumpToMonthYear;
  document.getElementById("selectWeek").onchange = (e) => {
    if (!e.target.value) return;
    if (state.calendarMode === "week" || state.calendarMode === "agenda") {
      state.anchorDate = new Date(e.target.value + "T00:00:00");
      renderWeeks();
      return;
    }
    const target = document.querySelector(`[data-week-monday="${e.target.value}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const btnFilterMembers = document.getElementById("btnFilterMembers");
  const memberFilterMenu = document.getElementById("memberFilterMenu");
  btnFilterMembers.onclick = (e) => {
    e.stopPropagation();
    memberFilterMenu.classList.toggle("hidden");
  };
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#memberMultiFilter")) {
      memberFilterMenu.classList.add("hidden");
    }
  });

  document.getElementById("evMember").onchange = (e) => {
    renderGroupAttendeeChips(e.target.value, []);
  };
  document.getElementById("btnCopyEvent").onclick = () => {
    const currentId = document.getElementById("evId").value;
    if (!currentId) return;
    document.getElementById("eventModal").close();
    setClipboard("copy", currentId);
  };
  document.getElementById("btnCutEvent").onclick = () => {
    const currentId = document.getElementById("evId").value;
    if (!currentId) return;
    document.getElementById("eventModal").close();
    setClipboard("cut", currentId);
  };
  document.getElementById("btnCancelClipboard").onclick = clearClipboard;

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select")) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "c" && hoveredEventId) {
      e.preventDefault();
      setClipboard("copy", hoveredEventId);
    } else if (mod && e.key.toLowerCase() === "x" && hoveredEventId) {
      e.preventDefault();
      setClipboard("cut", hoveredEventId);
    } else if (mod && e.key.toLowerCase() === "v" && state.clipboard && hoveredCell) {
      e.preventDefault();
      pasteClipboardTo(hoveredCell.date, hoveredCell.memberId);
    } else if (e.key === "Escape" && state.clipboard) {
      clearClipboard();
    }
  });
  document.getElementById("btnToggleView").onclick = () => {
    state.viewMode = isMobileView() ? "table" : "mobile";
    renderWeeks();
  };

  let resizeTimer;
  window.addEventListener("resize", () => {
    if (state.viewMode !== "auto") return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderWeeks, 150);
  });
  document.getElementById("btnChangeContext").onclick = () => {
    document.getElementById("evContextBadge").classList.add("hidden");
    document.getElementById("evMemberDateRow").classList.remove("hidden");
  };
  document.getElementById("evChannel").onchange = updateChannelColorDot;
  document.getElementById("evAllDay").onchange = toggleTimeInputs;
  document.getElementById("evStartTime").onchange = (e) => {
    document.getElementById("evEndTime").value = addOneHour(e.target.value);
  };
  document.querySelectorAll(".time-picker-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const targetId = btn.dataset.timeTarget;
      const fieldEl = btn.closest(".time-field") || btn;
      openQuickTimePopover(targetId, fieldEl);
    };
  });
  document.addEventListener("click", (e) => {
    const pop = document.getElementById("quickTimePopover");
    if (!pop || pop.classList.contains("hidden")) return;
    if (pop.contains(e.target) || e.target.closest(".time-picker-btn")) return;
    closeQuickTimePopover();
  });
  document.getElementById("eventModal")?.addEventListener("close", closeQuickTimePopover);
  document.getElementById("evEnableEmailAlert").onchange = (e) => {
    document.getElementById("evReminderEmail").disabled = !e.target.checked;
  };
  document.getElementById("eventForm").onsubmit = handleSaveEvent;
  document.getElementById("btnDeleteEvent").onclick = handleDeleteEvent;
  document.getElementById("btnDropCopy").onclick = () => executeDropAction("copy");
  document.getElementById("btnDropReplace").onclick = () => executeDropAction("replace");
  document.getElementById("btnDropMove").onclick = () => executeDropAction("move");
  document.getElementById("btnUndo").onclick = performUndo;

  document.getElementById("btnTeam").onclick = () => {
    renderTeamList();
    document.getElementById("teamModal").showModal();
  };

  document.getElementById("addMemberForm").onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById("newMemberId").value.trim();
    const email = document.getElementById("newMemberEmail").value.trim();
    if (!name) return;
    state.team.push({ id: name, name, email });
    saveTeam();
    if (APPS_SCRIPT_URL) postToAppsScript({ action: "saveTeam", team: state.team });
    e.target.reset();
    renderTeamList();
    renderLegendAndSelects();
    renderWeeks();
  };

  document.getElementById("btnSaveGoogleConfig").onclick = () => {
    state.googleCfg.clientId = document.getElementById("googleClientIdInput").value.trim();
    state.googleCfg.primaryCalendarId = document.getElementById("primaryCalendarIdInput").value.trim() || "primary";
    state.googleCfg.vacationsSheetId =
      document.getElementById("vacationsSheetIdInput")?.value.trim() || DEFAULT_VACATIONS_SHEET_ID;
    saveGoogleCfg();
    initGoogleAuth();
    requestGoogleLogin();
  };

  document.getElementById("btnSyncVacationsSheet").onclick = () => syncVacationsAndHolidaysFromSheet(false);
  document.getElementById("btnSyncNow").onclick = () => syncFromGoogleCalendars(false);
  document.getElementById("btnExportIcs").onclick = () => exportICS("view");
  document.getElementById("btnExportIcsAll").onclick = () => exportICS("all");
  document.getElementById("btnRetryAllSync").onclick = retryAllChanges;
  document.getElementById("btnAvailabilityConfirm").onclick = () => resolveAvailability(true);
  document.getElementById("btnAvailabilityCancel").onclick = () => resolveAvailability(false);
  document.getElementById("btnAvailabilityClose").onclick = () => resolveAvailability(false);
  document.getElementById("availabilityModal")?.addEventListener("cancel", (e) => {
    e.preventDefault();
    resolveAvailability(false);
  });
  window.addEventListener("online", retryAllChanges);
  updateSaveSummary();
  if (Object.keys(state.outbox || {}).length > 0 && APPS_SCRIPT_URL) {
    retryAllChanges();
  }

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.onclick = () => document.getElementById(btn.dataset.close).close();
  });
});
