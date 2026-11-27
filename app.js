/* ==========================================================================
   Calendario Training — Grupo de Trabajo (Sin servidor · Google Workspace)
   ========================================================================== */

// Versión actual de la aplicación (comparada con version.json para mostrar el aviso de actualización)
const APP_VERSION = "v73";

// Pega aquí la URL /exec de tu Google Apps Script para que TODO el equipo vea y comparta los mismos eventos en tiempo real (0 €):
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzBlkQgHjuAWBxDGj5Pb9vmFV-9rZSa121HD0CSX5rpGslarqXfg5C8lFzyDJKDaylz/exec";

const STORAGE_KEYS = {
  EVENTS: "cal_xiaomi_events_v2",
  OUTBOX: "cal_xiaomi_outbox_v1",
  TEAM: "cal_xiaomi_team_v1",
  BLOCKED_DAYS: "cal_xiaomi_blocked_days_v2",
  MOBILE_LAST_MEMBER: "cal_xiaomi_mobile_last_member_v1",
  HIDE_WEEKENDS: "cal_xiaomi_hide_weekends_v1",
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
  { id: "media_markt", label: "MediaMarkt", bg: "#df0000", fg: "#ffffff" },
  { id: "eci", label: "El Corte Inglés · ECI", bg: "#00843d", fg: "#ffffff" },
  { id: "interno", label: "Interno (PC, GPV…)", bg: "#536d86", fg: "#ffffff" },
  { id: "xiaomi_stores", label: "Xiaomi Stores", bg: "#ff6d01", fg: "#111111" },
  { id: "materiales", label: "Materiales", bg: "#287d83", fg: "#ffffff" },
  { id: "otros", label: "Otros", bg: "#70617d", fg: "#ffffff" },
  { id: "orange", label: "ORANGE (OSP)", bg: "#ff9900", fg: "#111111" },
  { id: "vodafone", label: "VODAFONE (VDF)", bg: "#ff5a5f", fg: "#ffffff" },
  { id: "masmovil", label: "MÁS MOVIL & YOIGO", bg: "#e01e84", fg: "#ffffff" },
  { id: "telefonica", label: "TELEFÓNICA (TME)", bg: "#4a86e8", fg: "#ffffff" },
];

// Compatibilidad: los eventos antiguos de open_market se muestran como "Otros" hasta que se editen o eliminen.
function getChannel(id) {
  return (
    CHANNELS.find((channel) => channel.id === id) ||
    CHANNELS.find((channel) => channel.id === "otros") ||
    CHANNELS[0]
  );
}

function getVisibleChannels() {
  return CHANNELS;
}

const QUARTER_THEMES = [
  { bg: "#dce8f3", fg: "#244a6b", accent: "#527da1" },
  { bg: "#dceee6", fg: "#255a46", accent: "#4f8b70" },
  { bg: "#f4e6c9", fg: "#70521f", accent: "#b28a40" },
  { bg: "#f0ded7", fg: "#784b3a", accent: "#ad7661" },
];

function getQuarterTheme(date) {
  return QUARTER_THEMES[Math.floor(date.getMonth() / 3)];
}

function applyQuarterTheme(element, date) {
  const theme = getQuarterTheme(date);
  element.style.setProperty("--period-bg", theme.bg);
  element.style.setProperty("--period-fg", theme.fg);
  element.style.setProperty("--period-accent", theme.accent);
}

function weekBannerHtml(weekDays, weekNum) {
  // Las semanas entre dos meses muestran ambos; cada mes conserva su color.
  const months = weekDays.filter((date, i) => i === 0 || date.getMonth() !== weekDays[i - 1].getMonth());
  const monthNames = months.map((date) => {
    const theme = getQuarterTheme(date);
    return `<span class="week-month-name" style="background:${theme.bg};color:${theme.fg}">${getMonthNameEs(date)}</span>`;
  }).join('<span class="month-divider" aria-hidden="true">/</span>');
  return `<div class="week-banner-content"><span class="week-months">${monthNames}</span><span class="week-number">W${weekNum}</span></div>`;
}

function dayHeaderHtml(date) {
  const dayNames = ["D", "Lun", "Mar", "Mié", "Jue", "Vie", "S"];
  return `<span class="day-name">${dayNames[date.getDay()]}</span><span class="day-number">${date.getDate()}</span>`;
}

const DEFAULT_TEAM = [
  { id: "COORD", name: "COORD", email: "victorprado@salesland.net", calendarId: "victorprado@salesland.net" },
  { id: "David", name: "David", email: "davidotero@salesland.net", calendarId: "davidotero@salesland.net" },
  { id: "TL1", name: "TL1", email: "franciscocerezo@salesland.net", calendarId: "franciscocerezo@salesland.net" },
  { id: "TM1", name: "TM1", email: "tomasrubiolo@salesland.net", calendarId: "tomasrubiolo@salesland.net" },
  { id: "TB1", name: "TB1", email: "carleshinojosa@salesland.net", calendarId: "carleshinojosa@salesland.net" },
  { id: "TS1", name: "TS1", email: "fabiogarcia@salesland.net", calendarId: "fabiogarcia@salesland.net" },
  { id: "TN1", name: "TN1", email: "hamzagaya@salesland.net", calendarId: "hamzagaya@salesland.net" },
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
  clipboard: null, // { mode: "copy" | "cut", eventId: string }
  viewMode: "auto", // "auto" | "table" | "mobile"
  calendarMode: "month", // "week" | "month" | "agenda"
  hideWeekends: false,
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

    state.hideWeekends = localStorage.getItem(STORAGE_KEYS.HIDE_WEEKENDS) === "1";
  } catch (e) {
    console.error("Error cargando localStorage:", e);
  }
}

function saveBlockedDays() {
  try {
    localStorage.setItem(STORAGE_KEYS.BLOCKED_DAYS, JSON.stringify(state.blockedDays));
  } catch (e) {
    console.warn("No se pudieron guardar los días bloqueados en localStorage:", e);
  }
}

function getSavedMobileMember() {
  const saved = localStorage.getItem(STORAGE_KEYS.MOBILE_LAST_MEMBER) || "";
  return state.team.some((m) => m.id === saved) ? saved : "";
}

function saveMobileMember(memberId) {
  if (memberId && state.team.some((m) => m.id === memberId)) {
    localStorage.setItem(STORAGE_KEYS.MOBILE_LAST_MEMBER, memberId);
  }
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
  try {
    localStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify(state.outbox || {}));
  } catch (e) {
    console.warn("No se pudo guardar la cola de cambios en localStorage:", e);
  }
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

let lastSyncFingerprint = "";

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
      const fingerprint = JSON.stringify({
        e: data.events,
        b: data.blockedDays || null,
        t: data.team || null,
      });
      if (silent && fingerprint === lastSyncFingerprint) return;
      lastSyncFingerprint = fingerprint;

      mergeRemoteEvents(data.events.map((ev) => ({ ...ev, _saveState: "saved" })));
      saveEvents();
      if (data.blockedDays && Object.keys(data.blockedDays).length > 0) {
        state.blockedDays = data.blockedDays;
        saveBlockedDays();
      }
      if (Array.isArray(data.team) && data.team.length > 0 && !document.getElementById("teamModal")?.open) {
        state.team = data.team;
        saveTeam();
        if (!document.getElementById("eventModal")?.open) renderLegendAndSelects();
      }
      updateSaveSummary();
      renderWeeks();
      handleWidgetDeepLink();
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
  try {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(state.events));
  } catch (e) {
    console.warn("No se pudieron guardar los eventos en localStorage:", e);
    if (e?.name === "QuotaExceededError") {
      showToast("Memoria local del navegador llena: los cambios siguen guardándose en Google.");
    }
  }
}

function saveTeam() {
  try {
    localStorage.setItem(STORAGE_KEYS.TEAM, JSON.stringify(state.team));
  } catch (e) {
    console.warn("No se pudo guardar el equipo en localStorage:", e);
  }
}

/* ---------- Toast, Deshacer & Notificaciones ---------- */
let toastTimer;
let lastUndoAction = null;

function showToast(msg, withUndo = false) {
  const el = typeof document?.getElementById === "function" ? document.getElementById("toast") : null;
  if (!el) return;
  el.innerHTML = "";
  const span = document.createElement("span");
  span.textContent = msg;
  el.appendChild(span);

  if (withUndo && lastUndoAction) {
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

function saveUndoAction(label, ops = []) {
  lastUndoAction = {
    label,
    ops: (ops || []).map((op) => ({
      id: op.id,
      before: op.before ? JSON.parse(JSON.stringify(op.before)) : null,
      after: op.after ? JSON.parse(JSON.stringify(op.after)) : null,
    })),
  };
  if (typeof document?.getElementById === "function") {
    document.getElementById("btnUndo")?.classList.remove("hidden");
  }
}

async function performUndo() {
  if (!lastUndoAction) return;
  const action = lastUndoAction;
  lastUndoAction = null;
  if (typeof document?.getElementById === "function") {
    document.getElementById("btnUndo")?.classList.add("hidden");
  }

  const queuedOps = [];
  action.ops.forEach((op) => {
    const idx = state.events.findIndex((e) => e.id === op.id);
    if (!op.before) {
      const target = (idx >= 0 ? state.events[idx] : null) || op.after;
      if (idx >= 0) state.events.splice(idx, 1);
      if (APPS_SCRIPT_URL && target) {
        const queued = queueEventChange("delete", target);
        if (queued) queuedOps.push(queued);
      }
    } else {
      const restored = JSON.parse(JSON.stringify(op.before));
      if (idx >= 0) state.events[idx] = restored;
      else state.events.push(restored);
      if (APPS_SCRIPT_URL) {
        const queued = queueEventChange("upsert", restored);
        if (queued) queuedOps.push(queued);
      }
    }
  });

  saveEvents();
  if (typeof renderWeeks === "function") renderWeeks();

  for (const queued of queuedOps) {
    await sendQueuedOperation(queued);
  }
  showToast(`Deshecho: ${action.label}`);
}

/* ---------- Renderizado de Leyenda y Selectores ---------- */
function renderLegendAndSelects() {
  const legendEl = document.getElementById("legendItems");
  const evChannel = document.getElementById("evChannel");

  legendEl.innerHTML = "";
  evChannel.innerHTML = "";

  evChannel.add(new Option("— Selecciona canal —", ""));
  getVisibleChannels().forEach((ch) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.setAttribute("aria-pressed", String(state.filters.channel === ch.id));
    chip.className = "legend-chip" + (state.filters.channel === ch.id ? " active-filter" : "");
    chip.style.setProperty("--channel-bg", ch.bg);
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.background = ch.bg;
    swatch.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = ch.label;
    chip.append(swatch, label);
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
  evMember.add(new Option("— Selecciona usuario —", ""));
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

  const invertBtn = document.createElement("button");
  invertBtn.type = "button";
  invertBtn.id = "btnInvertMemberFilter";
  invertBtn.className = "multi-filter-invert-btn";
  invertBtn.textContent = "⇄ Invertir selección";
  invertBtn.onclick = (e) => {
    e.stopPropagation();
    if (state.filters.members.length === 0) {
      showToast("Marca primero una o más personas para invertir el filtro.");
      return;
    }
    const inverted = state.team
      .map((m) => m.id)
      .filter((id) => !state.filters.members.includes(id));
    state.filters.members = inverted.length === state.team.length ? [] : inverted;
    renderMemberMultiFilter();
    renderWeeks();
  };
  menu.appendChild(invertBtn);

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

let activeMemberFilterAnchor = null;

function toggleMemberFilterMenu(anchorEl) {
  const menu = document.getElementById("memberFilterMenu");
  if (!menu || !anchorEl) return;
  const isAlreadyOpen = !menu.classList.contains("hidden") && activeMemberFilterAnchor === anchorEl;
  if (isAlreadyOpen) {
    menu.classList.add("hidden");
    activeMemberFilterAnchor = null;
    return;
  }
  activeMemberFilterAnchor = anchorEl;
  menu.classList.remove("hidden");
  const rect = anchorEl.getBoundingClientRect();
  const menuW = Math.max(196, menu.offsetWidth || 196);
  const left = Math.max(8, Math.min(window.innerWidth - menuW - 8, rect.left));
  const top = Math.min(window.innerHeight - 160, rect.bottom + 4);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function updateWeekendsToggleUI() {
  const chk = document.getElementById("chkShowWeekends");
  if (chk) chk.checked = !state.hideWeekends;
  // En modo tabla, Fin de semana y el Filtro de equipo viven en la esquina superior izquierda de la tabla;
  // en modo móvil / agenda aparecen en la barra superior. El botón 👥 Equipo permanece siempre en la barra superior.
  const showInTopbar = isMobileView() || state.calendarMode === "agenda";
  document.getElementById("weekendToggleLabel")?.classList.toggle("hidden", !showInTopbar);
  document.getElementById("memberMultiFilter")?.classList.toggle("hidden", !showInTopbar);
  document.getElementById("btnTeam")?.classList.remove("hidden");
}

function renderWeeks() {
  const activeEventId = document.activeElement?.dataset?.eventId || null;
  updateViewToggleLabel();
  updateWeekendsToggleUI();
  syncDateSelectorsFromAnchor();
  const dateControls = document.querySelector(".date-inline-group");
  if (dateControls) applyQuarterTheme(dateControls, state.anchorDate);
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
  const eventsIndex = buildFilteredEventsIndex();

  for (const weekStart of weeks) {
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const weekNum = getISOWeekNumber(weekStart);
    const monthLabel = getMonthNameEs(weekDays[3]);

    const card = document.createElement("section");
    card.className = "mobile-week-card";
    card.dataset.weekMonday = toIsoDate(weekStart);

    const banner = document.createElement("div");
    banner.className = "mobile-week-banner";
    applyQuarterTheme(banner, weekDays[3]);
    banner.innerHTML = weekBannerHtml(weekDays, weekNum);
    card.appendChild(banner);

    const daysList = document.createElement("div");
    daysList.className = "mobile-days-list";

    const visibleDays = state.hideWeekends ? weekDays.slice(0, 5) : weekDays;
    visibleDays.forEach((d, idx) => {
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
      applyQuarterTheme(dayHeader, d);
      dayHeader.innerHTML = `
        <span class="day-heading" aria-label="${d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}">${dayHeaderHtml(d)}</span>
        <button type="button" class="mobile-add-btn">${state.clipboard ? "📋 Pegar" : "+ Añadir"}</button>
      `;
      dayHeader.querySelector(".mobile-add-btn").onclick = () => {
        if (state.clipboard) {
          const clipMember =
            state.filters.members.length === 1
              ? state.filters.members[0]
              : getSavedMobileMember() ||
                state.events.find((x) => x.id === state.clipboard.eventId)?.memberId ||
                visibleMembers[0]?.id ||
                "COORD";
          pasteClipboardTo(iso, clipMember);
        } else {
          // En móvil: la primera vez sale en blanco; luego recuerda el último usuario elegido
          openEventModal({ date: iso, memberId: getSavedMobileMember(), fromMobile: true });
        }
      };
      dayCard.appendChild(dayHeader);

      const eventsBox = document.createElement("div");
      eventsBox.className = "mobile-day-events";

      let anyEvent = false;
      visibleMembers.forEach((member) => {
        const blocked = getBlockedInfo(iso, member.id);
        const cellEvents = eventsIndex.get(`${member.id}|${iso}`) || [];
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
  const eventsIndex = buildFilteredEventsIndex();

  for (const weekStart of weeks) {
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const weekNum = getISOWeekNumber(weekStart);
    const monthLabel = getMonthNameEs(weekDays[3]);

    const block = document.createElement("div");
    block.className = "week-block";
    applyQuarterTheme(block, weekDays[3]);
    block.dataset.weekMonday = toIsoDate(weekStart);

    const visibleDays = state.hideWeekends ? weekDays.slice(0, 5) : weekDays;
    const table = document.createElement("table");
    table.className = "week-table" + (state.hideWeekends ? " hide-weekends" : "");

    // Colgroup para proporciones fieles al Excel (L-V anchos, S-D estrechos u ocultos)
    table.innerHTML = `
      <colgroup>
        <col class="col-role" />
        <col class="col-weekday" />
        <col class="col-weekday" />
        <col class="col-weekday" />
        <col class="col-weekday" />
        <col class="col-weekday" />
        ${state.hideWeekends ? "" : '<col class="col-weekend" /><col class="col-weekend" />'}
      </colgroup>
    `;

    const thead = document.createElement("thead");

    // Fila 1: Banner de semana + casilla Fin de semana (S / D) en la esquina
    const trBanner = document.createElement("tr");
    trBanner.innerHTML = `
      <th class="corner-empty corner-control-cell">
        <label class="corner-weekend-toggle" title="Mostrar u ocultar sábado y domingo">
          <input type="checkbox" class="chk-corner-weekends" ${!state.hideWeekends ? "checked" : ""} />
          <span>S / D</span>
        </label>
      </th>
      <th colspan="${visibleDays.length}" class="week-banner-cell">${weekBannerHtml(weekDays, weekNum)}</th>
    `;
    trBanner.querySelector(".chk-corner-weekends").onchange = (e) => {
      state.hideWeekends = !e.target.checked;
      localStorage.setItem(STORAGE_KEYS.HIDE_WEEKENDS, state.hideWeekends ? "1" : "0");
      renderWeeks();
    };
    thead.appendChild(trBanner);

    // Una única fila combina nombre del día y fecha, incluidos S y D, con el filtro de equipo en la esquina.
    const selMembers = state.filters.members;
    const cornerFilterText =
      selMembers.length === 0
        ? "Equipo ▾"
        : selMembers.length === 1
          ? `${escapeHtml(selMembers[0])} ▾`
          : `${selMembers.length} pers. ▾`;
    const trDays = document.createElement("tr");
    trDays.innerHTML = `<th class="corner-empty corner-control-cell" scope="col"><button type="button" class="corner-team-btn corner-filter-btn${selMembers.length ? " is-filtered" : ""}" title="Filtrar por personas del equipo">${cornerFilterText}</button></th>`;
    const cornerFilterBtn = trDays.querySelector(".corner-filter-btn");
    cornerFilterBtn.onclick = (e) => {
      e.stopPropagation();
      toggleMemberFilterMenu(cornerFilterBtn);
    };
    visibleDays.forEach((date) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.className = "date-number-cell combined-day-cell" + (toIsoDate(date) === todayIso ? " is-today" : "");
      if (date.getDay() === 0 || date.getDay() === 6) th.classList.add("is-weekend");
      th.setAttribute("aria-label", date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
      th.title = toIsoDate(date);
      applyQuarterTheme(th, date);
      th.innerHTML = `<span class="day-heading">${dayHeaderHtml(date)}</span>`;
      trDays.appendChild(th);
    });
    thead.appendChild(trDays);
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

      // Celdas L..V (o L..D)
      visibleDays.forEach((d, idx) => {
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
            openEventModal({ date: iso, memberId: member.id, lockMember: true });
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

        const cellEvents = eventsIndex.get(`${member.id}|${iso}`) || [];
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

function buildFilteredEventsIndex() {
  const q = state.filters.search.trim().toLowerCase();
  const chFilter = state.filters.channel;
  const index = new Map();
  const all = [...state.events, ...state.externalEvents];

  all.forEach((ev) => {
    if (!ev || !ev.date || !ev.memberId) return;
    if (chFilter !== "all" && getChannel(ev.channelId).id !== chFilter) return;
    if (q) {
      const hay = `${ev.title} ${ev.location || ""} ${ev.notes || ""}`.toLowerCase();
      if (!hay.includes(q)) return;
    }
    const key = `${ev.memberId}|${ev.date}`;
    let bucket = index.get(key);
    if (!bucket) {
      bucket = [];
      index.set(key, bucket);
    }
    bucket.push(ev);
  });

  index.forEach((bucket) => {
    bucket.sort((a, b) => {
      if (Boolean(a.allDay) !== Boolean(b.allDay)) return a.allDay ? -1 : 1;
      return normalizeTimeStr(a.startTime, "00:00").localeCompare(
        normalizeTimeStr(b.startTime, "00:00")
      );
    });
  });

  return index;
}

function getFilteredEventsForCell(dateIso, memberId) {
  return buildFilteredEventsIndex().get(`${memberId}|${dateIso}`) || [];
}

function renderEventPill(ev) {
  const ch = getChannel(ev.channelId);
  const pill = document.createElement("div");
  const isCut = state.clipboard?.mode === "cut" && state.clipboard.eventId === ev.id;
  const alignCls =
    ev.textAlign === "center" ? " align-center" : ev.textAlign === "right" ? " align-right" : " align-left";
  pill.className =
    "event-pill" +
    alignCls +
    (ev.notes ? " has-notes" : "") +
    (ev.tentative ? " is-tentative" : "") +
    (isCut ? " cut-source" : "");
  pill.style.background = ev.customColor || ch.bg;
  pill.style.color = ev.customColor ? "#ffffff" : ch.fg;

  if (!ev.isExternal) {
    pill.draggable = true;
    pill.title = `${ch.label} · Clic para editar · Ctrl+C copiar · Ctrl+X cortar · Arrastrar para mover/copiar`;
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
      `${ev.title}, ${ch.label}, ${ev.date}${timeStr ? ", " + timeStr : ""}${ev._saveState === "error" ? ", error al sincronizar" : ""}`
    );
    pill.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        openEventModal(ev);
      }
    };
  }

  const tentativeBadge = ev.tentative
    ? `<div><span class="tentative-badge" title="Evento en tentativa"><span class="tentative-dot" aria-hidden="true"></span>Tentativa</span></div>`
    : "";

  pill.innerHTML = `
    ${tentativeBadge}
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
  const inMobileLikeView = isMobileView() || state.calendarMode === "agenda";
  const isFromMobile = Boolean(data.fromMobile) || inMobileLikeView;
  // En modo tabla, el usuario de la casilla/fila queda bloqueado para evitar introducir datos en otro usuario
  const lockMember = Boolean(data.lockMember) || (!isFromMobile && Boolean(data.memberId));

  document.getElementById("eventModalTitle").textContent = isEdit ? "Editar evento" : "Nuevo evento";
  document.getElementById("evId").value = data.id || "";
  document.getElementById("evGoogleId").value = data.googleEventId || "";
  document.getElementById("evGoogleCalId").value = data.googleCalId || "";
  document.getElementById("evTitle").value = data.title || "";

  const evMemberSel = document.getElementById("evMember");
  const resolvedMemberId =
    data.memberId !== undefined && data.memberId !== null
      ? data.memberId
      : isFromMobile
        ? getSavedMobileMember()
        : state.team[0]?.id || "COORD";
  evMemberSel.value = resolvedMemberId;
  evMemberSel.disabled = lockMember;
  evMemberSel.title = lockMember ? "Usuario fijado por la fila de la tabla" : "";

  const channelSelect = document.getElementById("evChannel");
  channelSelect.value = data.channelId ? getChannel(data.channelId).id : "";
  updateChannelColorDot();
  closeQuickTimePopover();
  document.getElementById("evDate").value = data.date || toIsoDate(new Date());
  document.getElementById("evStartTime").value = normalizeTimeStr(data.startTime, "09:30");
  document.getElementById("evEndTime").value = normalizeTimeStr(
    data.endTime,
    addOneHour(document.getElementById("evStartTime").value)
  );
  document.getElementById("evAllDay").checked = Boolean(data.allDay);
  setTentativeState(Boolean(data.tentative));
  setTextAlignState(data.textAlign || "left");
  document.getElementById("evNotes").value = data.notes || "";
  document.getElementById("evReminderPopup").value = data.popupMin ?? "60";

  const hasEmailAlert = Boolean(data.emailMin && data.emailMin !== "none");
  const emailCb = document.getElementById("evEnableEmailAlert");
  const emailSel = document.getElementById("evReminderEmail");
  emailCb.checked = hasEmailAlert;
  emailSel.disabled = !hasEmailAlert;
  emailSel.value = hasEmailAlert ? String(data.emailMin) : "60";

  document.getElementById("evSyncGoogle").checked = data.syncGoogle !== false;

  // Si viene de hacer clic en una celda concreta con usuario definido (nuevo evento), mostramos resumen compacto
  const isNewWithContext = !isEdit && Boolean(data.date && resolvedMemberId);
  const badge = document.getElementById("evContextBadge");
  const memberDateRow = document.getElementById("evMemberDateRow");
  const changeBtn = document.getElementById("btnChangeContext");
  if (isNewWithContext) {
    const memberObj = state.team.find((m) => m.id === resolvedMemberId);
    document.getElementById("evContextText").textContent = `👤 ${memberObj?.name || resolvedMemberId} · 📅 ${data.date}`;
    if (changeBtn) changeBtn.textContent = lockMember ? "Cambiar fecha" : "Cambiar";
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
  setTimeout(() => {
    if (!resolvedMemberId && !lockMember) {
      evMemberSel.focus();
    } else {
      document.getElementById("evTitle").focus();
    }
  }, 30);
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

  const delta = await moveOrCopyEvent(eventId, targetDate, targetMemberId, isCopy);
  if (delta) {
    saveUndoAction(`${isCopy ? "Pegar copia" : "Pegar (cortado)"} "${orig.title}"`, [
      { id: delta.after.id, before: delta.before, after: delta.after },
    ]);
  }
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

  const undoOps = [];

  // Si es sustituir, eliminamos los eventos previos de esa celda destino
  if (mode === "replace") {
    for (const rem of toRemove) {
      undoOps.push({ id: rem.id, before: eventContent(rem), after: null });
      if (APPS_SCRIPT_URL) {
        const op = queueEventChange("delete", rem);
        if (op) await sendQueuedOperation(op);
      }
    }
    state.events = state.events.filter(
      (x) => !(x.date === targetDate && x.memberId === targetMemberId && x.id !== eventId)
    );
  }

  const isCopy = mode === "copy";
  const delta = await moveOrCopyEvent(eventId, targetDate, targetMemberId, isCopy);
  if (delta) {
    undoOps.push({ id: delta.after.id, before: delta.before, after: delta.after });
  }
  if (undoOps.length) {
    saveUndoAction(
      `${mode === "replace" ? "Sustituir" : mode === "copy" ? "Copiar" : "Mover"} "${orig.title}"`,
      undoOps
    );
  }
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
  if (!orig) return null;

  if (!isCopy && orig.date === targetDate && orig.memberId === targetMemberId) return null;

  const beforeSnap = isCopy ? null : eventContent(orig);
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
  return { before: beforeSnap, after: eventContent(updated) };
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
  const ch = sel.value ? getChannel(sel.value) : null;
  dot.style.background = ch ? ch.bg : "#cbd5e1";
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

function applyQuickTime(inputId, nextVal, shouldClose = true) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.value !== nextVal) {
    input.value = nextVal;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (shouldClose) closeQuickTimePopover();
}

function openQuickTimePopover(targetInputId, anchorEl, allowToggleClose = true) {
  const pop = document.getElementById("quickTimePopover");
  const input = document.getElementById(targetInputId);
  if (!pop || !input || input.disabled) return;

  if (!pop.classList.contains("hidden") && pop.dataset.target === targetInputId) {
    if (allowToggleClose) closeQuickTimePopover();
    return;
  }

  const ITEM_H = 34;
  const currentVal = normalizeTimeStr(input.value, "09:30");
  const [curH, curM] = currentVal.split(":").map(Number);
  const isEnd = targetInputId === "evEndTime";
  const startVal = normalizeTimeStr(document.getElementById("evStartTime")?.value, "09:30");

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
  const curHStr = String(Number.isNaN(curH) ? 9 : curH).padStart(2, "0");
  const curMStr = String(Number.isNaN(curM) ? 30 : curM).padStart(2, "0");
  if (!minutes.includes(curMStr)) {
    minutes.push(curMStr);
    minutes.sort();
  }

  const durationHtml = isEnd
    ? `<div class="wheel-durations">
         <button type="button" class="wheel-dur-btn" data-dur-val="${addMinutesToTime(startVal, 30)}">+30m</button>
         <button type="button" class="wheel-dur-btn" data-dur-val="${addMinutesToTime(startVal, 60)}">+1h</button>
         <button type="button" class="wheel-dur-btn" data-dur-val="${addMinutesToTime(startVal, 120)}">+2h</button>
       </div>`
    : "";

  pop.innerHTML = `
    ${durationHtml}
    <div class="wheel-header"><span>Hora</span><span></span><span>Min</span></div>
    <div class="time-wheel-stage">
      <div class="time-wheel-highlight" aria-hidden="true"></div>
      <div class="time-wheel-col" id="wheelHours" aria-label="Horas">
        <div class="wheel-pad"></div>
        ${hours.map((h, i) => `<div class="wheel-item${h === curHStr ? " active" : ""}" data-idx="${i}" data-val="${h}">${h}</div>`).join("")}
        <div class="wheel-pad"></div>
      </div>
      <div class="time-wheel-sep" aria-hidden="true">:</div>
      <div class="time-wheel-col" id="wheelMinutes" aria-label="Minutos">
        <div class="wheel-pad"></div>
        ${minutes.map((m, i) => `<div class="wheel-item${m === curMStr ? " active" : ""}" data-idx="${i}" data-val="${m}">${m}</div>`).join("")}
        <div class="wheel-pad"></div>
      </div>
    </div>
    <div class="wheel-footer">
      <button type="button" class="wheel-done-btn" id="btnWheelDone">Listo</button>
    </div>
  `;

  pop.dataset.target = targetInputId;
  pop.classList.remove("hidden");

  const rect = anchorEl.getBoundingClientRect();
  const popWidth = 176;
  const popHeight = isEnd ? 275 : 244;
  const left = Math.max(8, Math.min(window.innerWidth - popWidth - 8, rect.left));
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow >= popHeight + 8 ? rect.bottom + 6 : Math.max(8, rect.top - popHeight - 6);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;

  const hCol = pop.querySelector("#wheelHours");
  const mCol = pop.querySelector("#wheelMinutes");
  let selH = curHStr;
  let selM = curMStr;

  const setActiveVisual = (col, idx) => {
    col.querySelectorAll(".wheel-item").forEach((el, i) => {
      el.classList.toggle("active", i === idx);
    });
  };

  const syncFromWheels = () => {
    const hIdx = Math.max(0, Math.min(hours.length - 1, Math.round(hCol.scrollTop / ITEM_H)));
    const mIdx = Math.max(0, Math.min(minutes.length - 1, Math.round(mCol.scrollTop / ITEM_H)));
    selH = hours[hIdx];
    selM = minutes[mIdx];
    setActiveVisual(hCol, hIdx);
    setActiveVisual(mCol, mIdx);
    applyQuickTime(targetInputId, `${selH}:${selM}`, false);
  };

  // Posicionar inicialmente en la hora/minuto actuales sin animación
  const initHIdx = Math.max(0, hours.indexOf(curHStr));
  const initMIdx = Math.max(0, minutes.indexOf(curMStr));
  hCol.scrollTop = initHIdx * ITEM_H;
  mCol.scrollTop = initMIdx * ITEM_H;

  const attachWheelBehavior = (col, list) => {
    let scrollTimer = null;
    col.addEventListener("scroll", () => {
      const idx = Math.max(0, Math.min(list.length - 1, Math.round(col.scrollTop / ITEM_H)));
      setActiveVisual(col, idx);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(syncFromWheels, 70);
    });
    // Paso fino de 1 elemento por cada muesca de la rueda del ratón en escritorio
    col.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const dir = Math.sign(e.deltaY);
        if (!dir) return;
        const curIdx = Math.max(0, Math.min(list.length - 1, Math.round(col.scrollTop / ITEM_H)));
        const nextIdx = Math.max(0, Math.min(list.length - 1, curIdx + dir));
        col.scrollTo({ top: nextIdx * ITEM_H, behavior: "smooth" });
      },
      { passive: false }
    );
    col.querySelectorAll(".wheel-item").forEach((item) => {
      item.onclick = () => {
        const idx = Number(item.dataset.idx);
        col.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
        setTimeout(syncFromWheels, 140);
      };
    });
  };

  attachWheelBehavior(hCol, hours);
  attachWheelBehavior(mCol, minutes);

  pop.querySelectorAll("[data-dur-val]").forEach((btn) => {
    btn.onclick = () => applyQuickTime(targetInputId, btn.dataset.durVal, true);
  });

  pop.querySelector("#btnWheelDone").onclick = () => {
    syncFromWheels();
    closeQuickTimePopover();
  };
}

function toggleTimeInputs() {
  const allDay = document.getElementById("evAllDay").checked;
  document.getElementById("evStartTime").disabled = allDay;
  document.getElementById("evEndTime").disabled = allDay;
  document.getElementById("evStartTimeField")?.classList.toggle("disabled", allDay);
  document.getElementById("evEndTimeField")?.classList.toggle("disabled", allDay);
  document.getElementById("evStartTimeLabel")?.classList.toggle("hidden", allDay);
  document.getElementById("evEndTimeLabel")?.classList.toggle("hidden", allDay);
  document.getElementById("evChannelTimeRow")?.classList.toggle("is-all-day", allDay);
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
    const existingIdx = state.events.findIndex((item) => item.id === id);
    const existingEv = existingIdx >= 0 ? state.events[existingIdx] : null;
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
      tentative: Boolean(document.getElementById("evTentative")?.checked),
      textAlign: document.getElementById("evTextAlign")?.value || "left",
      location: existingEv?.location || "",
      notes: document.getElementById("evNotes").value.trim(),
      popupMin: document.getElementById("evReminderPopup").value,
      emailMin: document.getElementById("evEnableEmailAlert").checked
        ? document.getElementById("evReminderEmail").value
        : "none",
      syncGoogle: document.getElementById("evSyncGoogle").checked,
      groupAttendees: existingEv?.groupAttendees || [],
    };
    ev.attendeeEmails = buildAttendeeEmails(ev.memberId, ev.groupAttendees);

    const allowed = await confirmAvailability(ev, [id]);
    if (!allowed) return;

    if (isMobileView() || state.calendarMode === "agenda") {
      saveMobileMember(ev.memberId);
    }

    saveUndoAction(existingIdx >= 0 ? `Editar "${ev.title}"` : `Crear "${ev.title}"`, [
      { id, before: existingEv ? eventContent(existingEv) : null, after: eventContent(ev) },
    ]);

    // Guardado optimista inmediato: cierra el modal al instante para evitar dobles clics
    if (existingIdx >= 0) state.events[existingIdx] = ev;
    else state.events.push(ev);

    const op = queueEventChange("upsert", ev);
    saveEvents();
    document.getElementById("eventModal").close();
    renderWeeks();

    if (APPS_SCRIPT_URL) {
      showToast("Guardando evento y sincronizando con Google Calendar...", true);
      const res = op ? await sendQueuedOperation(op) : await postToAppsScript({ action: "upsert", event: ev });
      if (!res?.ok) {
        showToast("Guardado en el dispositivo (pendiente de reintentar con Google).", true);
      } else if (res.syncStatus === "error" || res.syncStatus === "no_recipients") {
        showToast(`Guardado en la web, pero aviso en Calendar: ${res.syncError || res.syncStatus}`, true);
      } else {
        showToast("Evento guardado y actualizado en Google Calendar (sin correos de invitación).", true);
      }
    } else if (ev.syncGoogle) {
      const gcalUrl = buildGoogleCalendarTemplateUrl(ev);
      window.open(gcalUrl, "_blank", "noopener,noreferrer");
      showToast("Evento guardado. Se abrió Google Calendar para añadir la alerta.");
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

  saveUndoAction(`Eliminar "${ev.title}"`, [
    { id, before: eventContent(ev), after: null },
  ]);
  state.events = state.events.filter((x) => x.id !== id);
  const op = APPS_SCRIPT_URL ? queueEventChange("delete", ev) : null;
  saveEvents();
  document.getElementById("eventModal").close();
  renderWeeks();
  showToast("Evento eliminado", true);

  if (APPS_SCRIPT_URL && op) {
    await sendQueuedOperation(op);
  }
}

/* ---------- Gestión del Equipo y Correos ---------- */
function persistTeamToServer() {
  syncEpoch++;
  saveTeam();
  if (!APPS_SCRIPT_URL) return;
  postToAppsScript({ action: "saveTeam", team: state.team }).then((res) => {
    if (!res?.ok) {
      showToast("Error guardando el equipo en Google. Reintenta en unos segundos.");
    }
  });
}

function moveTeamMember(fromIdx, toIdx) {
  if (fromIdx === toIdx) return;
  if (fromIdx < 0 || fromIdx >= state.team.length) return;
  if (toIdx < 0 || toIdx >= state.team.length) return;
  const [moved] = state.team.splice(fromIdx, 1);
  state.team.splice(toIdx, 0, moved);
  persistTeamToServer();
  renderTeamList();
  renderLegendAndSelects();
  renderWeeks();
}

function renderTeamList() {
  const list = document.getElementById("teamList");
  list.innerHTML = "";
  let draggedIdx = null;

  state.team.forEach((m, index) => {
    const row = document.createElement("div");
    row.className = "team-item";
    row.draggable = true;
    row.dataset.idx = String(index);
    row.innerHTML = `
      <span class="team-drag-handle" title="Arrastra para reordenar" aria-hidden="true">⋮⋮</span>
      <strong>${escapeHtml(m.name)}</strong>
      <input type="email" value="${escapeHtml(m.email || "")}" placeholder="correo@empresa.com" data-idx="${index}" data-field="email" />
      <div class="team-item-actions">
        <button type="button" class="btn-icon-sm" data-move-member="${index}" data-dir="-1" title="Subir posición" aria-label="Subir a ${escapeHtml(m.name)}" ${index === 0 ? "disabled" : ""}>▲</button>
        <button type="button" class="btn-icon-sm" data-move-member="${index}" data-dir="1" title="Bajar posición" aria-label="Bajar a ${escapeHtml(m.name)}" ${index === state.team.length - 1 ? "disabled" : ""}>▼</button>
        <button type="button" class="btn btn-secondary" data-remove-member="${index}" title="Eliminar">🗑</button>
      </div>
    `;

    row.ondragstart = (e) => {
      if (e.target.closest("input, button")) {
        e.preventDefault();
        return;
      }
      draggedIdx = index;
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    };

    row.ondragover = (e) => {
      if (draggedIdx === null || draggedIdx === index) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = row.getBoundingClientRect();
      const isTopHalf = e.clientY < rect.top + rect.height / 2;
      row.classList.toggle("drag-over-top", isTopHalf);
      row.classList.toggle("drag-over-bottom", !isTopHalf);
    };

    row.ondragleave = () => {
      row.classList.remove("drag-over-top", "drag-over-bottom");
    };

    row.ondrop = (e) => {
      e.preventDefault();
      const wasTop = row.classList.contains("drag-over-top");
      row.classList.remove("drag-over-top", "drag-over-bottom");
      if (draggedIdx === null || draggedIdx === index) return;
      let targetIdx = wasTop ? index : index + 1;
      if (draggedIdx < targetIdx) targetIdx--;
      const from = draggedIdx;
      draggedIdx = null;
      moveTeamMember(from, targetIdx);
    };

    row.ondragend = () => {
      draggedIdx = null;
      row.classList.remove("dragging");
      list.querySelectorAll(".team-item").forEach((el) => {
        el.classList.remove("drag-over-top", "drag-over-bottom");
      });
    };

    list.appendChild(row);
  });

  list.querySelectorAll("input").forEach((inp) => {
    inp.onchange = () => {
      const idx = Number(inp.dataset.idx);
      const val = inp.value.trim();
      if (inp.dataset.field === "email" && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        showToast("Formato de correo no válido");
        inp.value = state.team[idx][inp.dataset.field] || "";
        return;
      }
      state.team[idx][inp.dataset.field] = val;
      persistTeamToServer();
      renderLegendAndSelects();
      renderWeeks();
    };
  });

  list.querySelectorAll("[data-move-member]").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.moveMember);
      const dir = Number(btn.dataset.dir);
      moveTeamMember(idx, idx + dir);
    };
  });

  list.querySelectorAll("[data-remove-member]").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.removeMember);
      const member = state.team[idx];
      if (!member) return;
      if (
        !window.confirm(
          `¿Eliminar a "${member.name}" del equipo? Sus eventos existentes no se borrarán pero dejarán de mostrarse en la tabla.`
        )
      ) {
        return;
      }
      state.team.splice(idx, 1);
      persistTeamToServer();
      renderTeamList();
      renderLegendAndSelects();
      renderWeeks();
    };
  });
}

/* ---------- Enlace plantilla de Google Calendar (fallback sin Apps Script) ---------- */
function buildGoogleCalendarTemplateUrl(ev) {
  const member = state.team.find((m) => m.id === ev.memberId);
  const ch = getChannel(ev.channelId);

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
    text: `${ev.tentative ? "[TENTATIVA] " : ""}[${ev.memberId}] ${ev.title}`,
    dates: datesParam,
    details: `Canal: ${ch?.label || ev.channelId}\nAsignado a: ${member?.name || ev.memberId}\n${ev.notes || ""}`,
  });
  if (ev.location) params.set("location", ev.location);
  // Sin parámetro "add" (0 invitados): así se crea como evento propio del usuario y Google nunca añade Meet
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
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
    if (chFilter !== "all" && getChannel(ev.channelId).id !== chFilter) return false;
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
      const nextDayCompact = toIsoDate(addDays(new Date(ev.date + "T00:00:00"), 1)).replace(/-/g, "");
      lines.push(`DTSTART;VALUE=DATE:${dateCompact}`);
      lines.push(`DTEND;VALUE=DATE:${nextDayCompact}`);
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
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = scope === "all" ? "calendario-training-completo.ics" : "calendario-training-vista.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(
    `Exportados ${list.length} evento(s) (${scope === "all" ? "todo el calendario" : "vista actual"}).`
  );
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setTextAlignState(align) {
  const safe = align === "center" || align === "right" ? align : "left";
  const hidden = document.getElementById("evTextAlign");
  if (hidden) hidden.value = safe;
  document.querySelectorAll(".align-btn[data-align]").forEach((btn) => {
    const active = btn.dataset.align === safe;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  const titleEl = document.getElementById("evTitle");
  const notesEl = document.getElementById("evNotes");
  if (titleEl) titleEl.style.textAlign = safe;
  if (notesEl) notesEl.style.textAlign = safe;
}

function setTentativeState(isTentative) {
  const cb = document.getElementById("evTentative");
  const btn = document.getElementById("btnToggleTentative");
  if (cb) cb.checked = Boolean(isTentative);
  if (btn) {
    btn.classList.toggle("active", Boolean(isTentative));
    btn.setAttribute("aria-pressed", String(Boolean(isTentative)));
  }
}

function linkifyHtml(str) {
  const escaped = escapeHtml(str);
  const urlRe =
    /(https?:\/\/[^\s<>"']+|(?:www\.|meet\.google\.com\/|teams\.(?:microsoft|live)\.com\/|zoom\.us\/)[^\s<>"']+)/gi;
  return escaped.replace(urlRe, (raw) => {
    const clean = raw.replace(/[.,;!?)\]]+$/, "");
    const trailing = raw.slice(clean.length);
    const href = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="event-link">${clean}</a>${trailing}`;
  });
}

/* ---------- Detección y forzado de nuevas actualizaciones ---------- */
let detectedRemoteVersion = null;
let updateDismissedVersion = null;
let swRegistrationRef = null;

function showUpdateBanner(remoteVersion) {
  const versionTag = remoteVersion || "nueva";
  if (updateDismissedVersion && updateDismissedVersion === versionTag) return;
  detectedRemoteVersion = remoteVersion || detectedRemoteVersion;
  const banner = document.getElementById("updateBanner");
  const textEl = document.getElementById("updateBannerText");
  if (!banner || !textEl) return;
  textEl.textContent = remoteVersion
    ? `✨ Nueva actualización disponible (${remoteVersion})`
    : "✨ Nueva actualización disponible";
  banner.classList.remove("hidden");
}

async function checkForAppUpdate() {
  try {
    if (swRegistrationRef) {
      swRegistrationRef.update().catch(() => {});
    }
    const res = await fetch(`./version.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const remoteVer = String(data?.version || "").trim();
    if (remoteVer && remoteVer !== APP_VERSION) {
      showUpdateBanner(remoteVer);
    }
  } catch {
    // Sin conexión o entorno sin version.json: ignorar en silencio
  }
}

async function forceAppUpdate() {
  const btn = document.getElementById("btnForceAppUpdate");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Actualizando...";
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        await reg.unregister().catch(() => {});
      }
    }
  } catch {
    // Continuar con recarga forzada aunque falle la limpieza de caché
  }
  const url = new URL(window.location.href);
  url.searchParams.set("v", (detectedRemoteVersion || APP_VERSION).replace(/^v/i, ""));
  url.searchParams.set("r", String(Date.now()));
  window.location.replace(url.toString());
}

let pendingWidgetAction = null;

function handleWidgetDeepLink() {
  if (!pendingWidgetAction) return;
  const { action, member, editEventId } = pendingWidgetAction;
  if (action === "new") {
    pendingWidgetAction = null;
    const targetMember =
      member && state.team.some((m) => m.id === member) ? member : getSavedMobileMember();
    openEventModal({ date: toIsoDate(new Date()), memberId: targetMember, fromMobile: true });
    return;
  }
  if (editEventId) {
    const found = state.events.find((ev) => ev.id === editEventId);
    if (found) {
      pendingWidgetAction = null;
      openEventModal(found);
    }
  }
}

/* ---------- Inicialización y Eventos UI ---------- */
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  renderLegendAndSelects();
  populateDateSelectors();
  renderWeeks();

  // Acciones directas desde el widget de Xiaomi (?action=new&member=... o ?editEvent=...)
  const initParams = new URLSearchParams(window.location.search);
  const wAction = initParams.get("action");
  const wMember = initParams.get("member") || "";
  const wEditId = initParams.get("editEvent") || "";
  if (wAction === "new" || wEditId) {
    pendingWidgetAction = { action: wAction, member: wMember, editEventId: wEditId };
    initParams.delete("action");
    initParams.delete("member");
    initParams.delete("editEvent");
    const cleanUrl =
      window.location.pathname + (initParams.toString() ? `?${initParams.toString()}` : "") + window.location.hash;
    window.history.replaceState({}, "", cleanUrl);
    handleWidgetDeepLink();
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register(`./sw.js?v=${APP_VERSION.replace(/^v/i, "")}`)
      .then((reg) => {
        swRegistrationRef = reg;
        if (reg.waiting && navigator.serviceWorker.controller) {
          checkForAppUpdate();
        }
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              checkForAppUpdate();
            }
          });
        });
      })
      .catch(() => {});
  }

  document.getElementById("btnForceAppUpdate").onclick = forceAppUpdate;
  document.getElementById("btnDismissUpdate").onclick = () => {
    updateDismissedVersion = detectedRemoteVersion || "nueva";
    document.getElementById("updateBanner")?.classList.add("hidden");
  };

  setTimeout(checkForAppUpdate, 500);
  setInterval(() => {
    if (document.visibilityState === "visible") checkForAppUpdate();
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkForAppUpdate();
      if (APPS_SCRIPT_URL) syncFromAppsScript(true);
    }
  });

  if (APPS_SCRIPT_URL) {
    syncFromAppsScript(true);
    setInterval(() => {
      if (document.visibilityState === "visible") syncFromAppsScript(true);
    }, 45000);
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
    toggleMemberFilterMenu(btnFilterMembers);
  };
  document.addEventListener("click", (e) => {
    if (
      !e.target.closest("#memberFilterMenu") &&
      !e.target.closest("#btnFilterMembers") &&
      !e.target.closest(".corner-filter-btn")
    ) {
      memberFilterMenu.classList.add("hidden");
      activeMemberFilterAnchor = null;
    }
  });

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
  document.getElementById("chkShowWeekends").onchange = (e) => {
    state.hideWeekends = !e.target.checked;
    localStorage.setItem(STORAGE_KEYS.HIDE_WEEKENDS, state.hideWeekends ? "1" : "0");
    updateWeekendsToggleUI();
    renderWeeks();
  };
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
  document.getElementById("btnToggleTentative").onclick = () => {
    const cb = document.getElementById("evTentative");
    setTentativeState(!cb?.checked);
  };
  document.querySelectorAll(".align-btn[data-align]").forEach((btn) => {
    btn.onclick = () => setTextAlignState(btn.dataset.align);
  });
  document.getElementById("evNotes").addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      document.getElementById("eventForm")?.requestSubmit();
    }
  });
  document.getElementById("evStartTime").onchange = (e) => {
    document.getElementById("evEndTime").value = addOneHour(e.target.value);
  };
  document.querySelectorAll(".time-picker-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const targetId = btn.dataset.timeTarget;
      const fieldEl = btn.closest(".time-field") || btn;
      openQuickTimePopover(targetId, fieldEl, true);
    };
  });
  ["evStartTime", "evEndTime"].forEach((timeId) => {
    const inp = document.getElementById(timeId);
    const fieldEl = inp?.closest(".time-field");
    if (!inp || !fieldEl) return;
    const openForInput = () => {
      if (inp.disabled) return;
      openQuickTimePopover(timeId, fieldEl, false);
    };
    inp.addEventListener("focus", openForInput);
    inp.addEventListener("click", (e) => {
      e.stopPropagation();
      openForInput();
    });
    fieldEl.addEventListener("click", (e) => {
      if (e.target.closest(".time-picker-btn")) return;
      e.stopPropagation();
      inp.focus();
      openForInput();
    });
  });
  document.addEventListener("click", (e) => {
    const pop = document.getElementById("quickTimePopover");
    if (!pop || pop.classList.contains("hidden")) return;
    if (pop.contains(e.target) || e.target.closest(".time-field")) return;
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

  document.getElementById("addMemberForm").onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById("newMemberId").value.trim();
    const email = document.getElementById("newMemberEmail").value.trim();
    if (!name) return;
    const newMember = { id: name, name, email };
    const existingIdx = state.team.findIndex((m) => m.id.toLowerCase() === name.toLowerCase());
    if (existingIdx >= 0) state.team[existingIdx] = newMember;
    else state.team.push(newMember);
    syncEpoch++;
    saveTeam();
    e.target.reset();
    renderTeamList();
    renderLegendAndSelects();
    renderWeeks();
    if (APPS_SCRIPT_URL) {
      const res = await postToAppsScript({ action: "addTeamMember", member: newMember });
      if (res?.ok && Array.isArray(res.team) && res.team.length > 0) {
        state.team = res.team;
        saveTeam();
        renderTeamList();
        renderLegendAndSelects();
        renderWeeks();
        showToast(`Usuario "${name}" guardado de forma permanente para todo el equipo.`);
      } else if (!res?.ok) {
        showToast("Error guardando el nuevo usuario en Google. Reintenta.");
      }
    }
  };

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
