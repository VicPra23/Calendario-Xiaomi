const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function loadFrontend(extraGlobals = {}) {
  const storage = new Map();
  const context = vm.createContext({
    document: {
      addEventListener() {},
      getElementById() {
        return null;
      },
      visibilityState: "visible",
    },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    URL,
    Blob,
    console,
    setTimeout,
    clearTimeout,
    ...extraGlobals,
  });
  const code = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  vm.runInContext(
    code +
      "\nthis.api = { state, saveEvents, saveUndoAction, performUndo, eventContent, buildFilteredEventsIndex, buildICS, APP_VERSION };",
    context
  );
  return { api: context.api, storage, context };
}

function loadBackend(mocks = {}) {
  const cacheStore = new Map();
  const context = vm.createContext({
    Logger: { log() {} },
    Session: { getScriptTimeZone: () => "Europe/Madrid", getActiveUser: () => ({ getEmail: () => "victorprado@salesland.net" }) },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cacheStore.has(k) ? cacheStore.get(k) : null),
        put: (k, v) => cacheStore.set(k, String(v)),
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: () => null,
        setProperty: () => {},
      }),
    },
    Utilities: {
      formatDate: (d, _tz, fmt) => {
        const dt = d instanceof Date ? d : new Date(d);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const day = String(dt.getDate()).padStart(2, "0");
        const hh = String(dt.getHours()).padStart(2, "0");
        const mm = String(dt.getMinutes()).padStart(2, "0");
        if (fmt === "yyyy-MM-dd") return `${y}-${m}-${day}`;
        if (fmt === "HH:mm") return `${hh}:${mm}`;
        return dt.toISOString();
      },
    },
    console,
    ...mocks,
  });
  const code = fs.readFileSync(path.join(__dirname, "../apps-script/Code.gs"), "utf8");
  vm.runInContext(
    code +
      "\nthis.api = { syncEditsFromGoogleCalendar_, readTeamFromSheet_, mapUser_, readVacationsAndHolidays_ };",
    context
  );
  return context.api;
}

test("buildFilteredEventsIndex agrupa, ordena todo el día primero y aplica filtro de canal", () => {
  const { api } = loadFrontend();
  api.state.events = [
    { id: "e1", memberId: "COORD", date: "2026-11-30", channelId: "eci", title: "Tarde", startTime: "15:00", allDay: false },
    { id: "e2", memberId: "COORD", date: "2026-11-30", channelId: "media_markt", title: "Todo el día", startTime: "09:30", allDay: true },
    { id: "e3", memberId: "COORD", date: "2026-11-30", channelId: "eci", title: "Mañana", startTime: "09:00", allDay: false },
    { id: "e4", memberId: "MANAGER", date: "2026-11-30", channelId: "eci", title: "Otro", startTime: "10:00", allDay: false },
  ];

  const allIdx = api.buildFilteredEventsIndex();
  const coordList = allIdx.get("COORD|2026-11-30") || [];
  assert.deepEqual(
    Array.from(coordList, (e) => e.id),
    ["e2", "e3", "e1"]
  );

  api.state.filters.channel = "eci";
  const eciIdx = api.buildFilteredEventsIndex();
  assert.deepEqual(
    Array.from(eciIdx.get("COORD|2026-11-30") || [], (e) => e.id),
    ["e3", "e1"]
  );
  assert.equal((eciIdx.get("MANAGER|2026-11-30") || []).length, 1);
});

test("performUndo por delta restaura solo el ID modificado sin borrar eventos concurrentes de compañeros", async () => {
  const postedActions = [];
  const { api, context } = loadFrontend({
    fetch: async (_url, opts) => {
      postedActions.push(JSON.parse(opts.body));
      return { ok: true, json: async () => ({ ok: true, googleEventId: "g-1" }) };
    },
    AbortSignal: { timeout: () => undefined },
  });
  context.renderWeeks = () => {};

  const original = { id: "ev-mine", memberId: "COORD", date: "2026-11-30", title: "Original", channelId: "eci" };
  const edited = { ...original, title: "Editado" };
  const teammateNew = { id: "ev-peer", memberId: "MANAGER", date: "2026-11-30", title: "Evento compañero", channelId: "otros" };
  const createdByMe = { id: "ev-new", memberId: "COORD", date: "2026-12-01", title: "Creado", channelId: "eci" };

  api.state.events = [edited, createdByMe, teammateNew];

  // Caso 1: deshacer edición de ev-mine -> debe restaurar "Original" y mantener ev-peer
  api.saveUndoAction('Editar "Editado"', [
    { id: "ev-mine", before: api.eventContent(original), after: api.eventContent(edited) },
  ]);
  await api.performUndo();

  assert.equal(api.state.events.find((e) => e.id === "ev-mine")?.title, "Original");
  assert.equal(api.state.events.find((e) => e.id === "ev-peer")?.title, "Evento compañero");
  assert.equal(postedActions.length, 1);
  assert.equal(postedActions[0].action, "upsert");
  assert.equal(postedActions[0].event.id, "ev-mine");

  // Caso 2: deshacer creación de ev-new -> debe borrar solo ev-new y seguir respetando ev-peer
  postedActions.length = 0;
  api.saveUndoAction('Crear "Creado"', [
    { id: "ev-new", before: null, after: api.eventContent(createdByMe) },
  ]);
  await api.performUndo();

  assert.equal(api.state.events.find((e) => e.id === "ev-new"), undefined);
  assert.equal(api.state.events.find((e) => e.id === "ev-peer")?.title, "Evento compañero");
  assert.equal(postedActions.length, 1);
  assert.equal(postedActions[0].action, "delete");
  assert.equal(postedActions[0].id, "ev-new");
});

test("buildICS incluye DTEND;VALUE=DATE del día siguiente en eventos de todo el día", () => {
  const { api } = loadFrontend();
  api.state.team = [{ id: "MANAGER", name: "MANAGER", email: "javierr@xiaomi.com" }];
  const ics = api.buildICS([
    {
      id: "allday-1",
      title: "Convención Xiaomi",
      memberId: "MANAGER",
      channelId: "xiaomi_stores",
      date: "2026-11-30",
      allDay: true,
      popupMin: "60",
    },
  ]);
  assert.match(ics, /DTSTART;VALUE=DATE:20261130/);
  assert.match(ics, /DTEND;VALUE=DATE:20261201/);
});

test("Code.gs syncEditsFromGoogleCalendar_ revisa ambos calendarios y conserva eventos [TENTATIVA] del equipo", () => {
  let deletedRows = 0;
  const writtenUpdates = [];
  const startDt = new Date(2026, 10, 27, 10, 0);
  const endDt = new Date(2026, 10, 27, 12, 0);

  const teamEvent = {
    getId: () => "g-team-1",
    getTitle: () => "[TENTATIVA] [TL1] Visita actualizada",
    isAllDayEvent: () => false,
    getStartTime: () => startDt,
    getEndTime: () => endDt,
    getLocation: () => "Madrid",
  };

  const masterCal = {
    getId: () => "master-cal",
    getEvents: () => [],
    getEventById: () => null,
  };
  const teamCal = {
    getId: () => "team-cal",
    getEvents: () => [teamEvent],
    getEventById: (id) => (id === "g-team-1" ? teamEvent : null),
  };

  const mockSheetData = [
    ["id", "title", "memberId", "channelId", "date", "startTime", "endTime", "allDay", "location", "n", "p", "e", "g", "s", "u", "googleEventId", "st", "er", "tentative"],
    ["ev-team", "Visita inicial", "TL1", "eci", "2026-11-27", "10:00", "12:00", false, "", "", "60", "none", "[]", true, "", "g-team-1", "synced", "", true],
  ];

  const mockSheet = {
    getDataRange: () => ({ getValues: () => mockSheetData }),
    deleteRow: () => {
      deletedRows++;
    },
    getRange: (row, col) => ({
      setValue: (val) => writtenUpdates.push({ row, col, val }),
    }),
  };

  const backend = loadBackend({
    CalendarApp: {
      getDefaultCalendar: () => masterCal,
      getCalendarById: () => null,
      getCalendarsByName: () => [teamCal],
    },
  });

  backend.syncEditsFromGoogleCalendar_(mockSheet);

  assert.equal(deletedRows, 0, "No debe borrar eventos almacenados en el calendario del equipo");
  assert.deepEqual(
    writtenUpdates.find((u) => u.col === 2),
    { row: 2, col: 2, val: "Visita actualizada" }
  );
  assert.deepEqual(
    writtenUpdates.find((u) => u.col === 19),
    { row: 2, col: 19, val: true }
  );
});

test("Code.gs readTeamFromSheet_ deduplica sin distinguir mayúsculas y mapUser_ reconoce usuarios dinámicos", () => {
  const backend = loadBackend();
  const teamSheet = {
    getDataRange: () => ({
      getValues: () => [
        ["id", "name", "email"],
        ["COORD", "COORD", ""],
        ["coord", "coord", "victorprado@salesland.net"],
        ["MANAGER", "MANAGER", "javierr@xiaomi.com"],
        ["", "ignorar", "x@y.com"],
      ],
    }),
  };
  const team = backend.readTeamFromSheet_(teamSheet);
  assert.equal(team.length, 2);
  assert.equal(team[0].id, "COORD");
  assert.equal(team[0].email, "victorprado@salesland.net");
  assert.equal(team[1].id, "MANAGER");

  assert.equal(backend.mapUser_("manager", team), "MANAGER");
  assert.equal(backend.mapUser_("javierr@xiaomi.com", team), "MANAGER");
  assert.equal(backend.mapUser_("Javier", team), "MANAGER");
});
