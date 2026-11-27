/**
 * Backend 100% GRATUITO en Google Apps Script (sin servidor externo, presupuesto 0 €).
 * Permite que TODOS los usuarios vean y editen los mismos eventos en tiempo real,
 * sincroniza FESTIVOS y VACACIONES desde "Usuarios APP", y mantiene sincronizado
 * Google Calendar (crear, copiar, mover, sustituir, eliminar y alertas a móvil/PC).
 *
 * CÓMO ACTIVARLO (2 minutos):
 *  1. Entra en https://script.google.com con tu cuenta de Google Workspace -> Nuevo proyecto.
 *  2. Borra el código que aparece y pega TODO este archivo.
 *  3. Pulsa "Implementar" -> "Nueva implementación" -> Tipo: "Aplicación web".
 *     - Ejecutar como: "Yo" (tu cuenta)
 *     - Quién tiene acceso: "Cualquier usuario" (para que la web pueda leer/guardar)
 *  4. Copia la URL que termina en /exec y pégala en APPS_SCRIPT_URL dentro de app.js.
 */

const VACATIONS_SHEET_ID = "1K0vGOPwteG6ZjNVT7cDaEwIeb3ONcjmNec3-FGlH10g";
const EVENTS_SHEET_NAME = "EVENTOS_WEB";
const TEAM_SHEET_NAME = "EQUIPO_WEB";

function getMasterCalendar_() {
  const id = PropertiesService.getScriptProperties().getProperty("MASTER_CALENDAR_ID");
  if (!id) return CalendarApp.getDefaultCalendar();
  return CalendarApp.getCalendarById(id) || CalendarApp.getDefaultCalendar();
}

function getTeamSyncCalendar_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty("TEAM_SYNC_CALENDAR_ID");
  if (savedId) {
    const existing = CalendarApp.getCalendarById(savedId);
    if (existing) return existing;
  }
  const byName = CalendarApp.getCalendarsByName("Calendario Training (Equipo)");
  if (byName && byName.length > 0) {
    props.setProperty("TEAM_SYNC_CALENDAR_ID", byName[0].getId());
    return byName[0];
  }
  const created = CalendarApp.createCalendar("Calendario Training (Equipo)", {
    summary: "Calendario secundario automático para sincronizar eventos del equipo sin mezclarlos en el calendario personal.",
  });
  props.setProperty("TEAM_SYNC_CALENDAR_ID", created.getId());
  return created;
}

const TEAM_MAP = {
  COORD: "victorprado@salesland.net",
  David: "davidotero@salesland.net",
  TL1: "franciscocerezo@salesland.net",
  TM1: "tomasrubiolo@salesland.net",
  TB1: "carleshinojosa@salesland.net",
  TS1: "fabiogarcia@salesland.net",
  TN1: "hamzagaya@salesland.net",
};

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty("EVENTS_SS_ID");
  let ss;
  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
    } catch (e) {
      ss = null;
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create("Calendario Training - Base de Datos Compartida");
    props.setProperty("EVENTS_SS_ID", ss.getId());
  }
  return ss;
}

function getEventsSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(EVENTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(EVENTS_SHEET_NAME);
    sheet.appendRow([
      "id", "title", "memberId", "channelId", "date", "startTime",
      "endTime", "allDay", "location", "notes", "popupMin", "emailMin",
      "groupAttendees", "syncGoogle", "updatedAt", "googleEventId",
      "syncStatus", "syncError",
    ]);
  }
  if (sheet.getRange(1, 17).getValue() !== "syncStatus") sheet.getRange(1, 17).setValue("syncStatus");
  if (sheet.getRange(1, 18).getValue() !== "syncError") sheet.getRange(1, 18).setValue("syncError");
  return sheet;
}

function getTeamSheet_(alreadyLocked) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(TEAM_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TEAM_SHEET_NAME);
    sheet.appendRow(["id", "name", "email"]);
  }
  if (sheet.getLastRow() <= 1) {
    let lock = null;
    let lockedHere = false;
    if (!alreadyLocked) {
      lock = LockService.getScriptLock();
      lockedHere = lock.tryLock(10000);
    }
    try {
      if (sheet.getLastRow() <= 1) {
        const defaults = Object.keys(TEAM_MAP).map((id) => [id, id, TEAM_MAP[id]]);
        sheet.getRange(2, 1, defaults.length, 3).setValues(defaults);
      }
    } finally {
      if (lockedHere && lock) {
        lock.releaseLock();
      }
    }
  }
  return sheet;
}

function readTeamFromSheet_(teamSheet) {
  const rows = teamSheet.getDataRange().getValues();
  const team = [];
  const seenIndex = {};
  for (let i = 1; i < rows.length; i++) {
    const id = String(rows[i][0] || "").trim();
    if (!id) continue;
    const key = id.toLowerCase();
    const name = String(rows[i][1] || id).trim();
    const email = String(rows[i][2] || "").trim();
    if (Object.prototype.hasOwnProperty.call(seenIndex, key)) {
      const existing = team[seenIndex[key]];
      if (!existing.email && email) existing.email = email;
      continue;
    }
    seenIndex[key] = team.length;
    team.push({ id, name, email });
  }
  return team;
}

function doGet() {
  const sheet = getEventsSheet_();
  const teamSheet = getTeamSheet_();
  syncEditsFromGoogleCalendar_(sheet);
  const rows = sheet.getDataRange().getValues();
  const events = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    events.push({
      id: String(r[0]),
      title: String(r[1] || ""),
      memberId: String(r[2] || "COORD"),
      channelId: String(r[3] || "open_market"),
      date: formatDateIso_(r[4]),
      startTime: formatTimeHhMm_(r[5], "09:30"),
      endTime: formatTimeHhMm_(r[6], "11:30"),
      allDay: r[7] === true || r[7] === "true",
      location: String(r[8] || ""),
      notes: String(r[9] || ""),
      popupMin: String(r[10] || "60"),
      emailMin: String(r[11] || "none"),
      groupAttendees: r[12] ? JSON.parse(String(r[12])) : [],
      syncGoogle: r[13] !== false && r[13] !== "false",
      googleEventId: r[15] ? String(r[15]) : null,
      syncStatus: String(r[16] || (r[15] ? "synced" : "pending")),
      syncError: String(r[17] || ""),
      tentative: r[18] === true || r[18] === "true",
      textAlign: String(r[19] || "left"),
    });
  }

  const team = readTeamFromSheet_(teamSheet);
  const blockedDays = readVacationsAndHolidays_(team);
  return jsonOut_({ ok: true, events, blockedDays, team });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const action = payload.action;
    const sheet = getEventsSheet_();

    if (action === "upsert" && payload.event) {
      const ev = payload.event;
      const prevGoogleId = findGoogleEventIdByLocalId_(sheet, ev.id) || ev.googleEventId;
      ev.googleEventId = prevGoogleId || "";
      ev.syncStatus = "disabled";
      ev.syncError = "";

      if (ev.syncGoogle !== false) {
        try {
          const result = upsertCalendarInvite_(ev, prevGoogleId);
          ev.googleEventId = result.googleEventId || "";
          ev.syncStatus = result.syncStatus;
          ev.syncError = result.syncError || "";
        } catch (err) {
          ev.syncStatus = "error";
          ev.syncError = String((err && err.message) || err);
          Logger.log("Error sincronizando Google Calendar: " + ev.syncError);
        }
      } else if (prevGoogleId) {
        deleteGoogleEventById_(prevGoogleId);
        ev.googleEventId = "";
      }

      upsertRow_(sheet, ev);
      return jsonOut_({
        ok: true,
        googleEventId: ev.googleEventId,
        syncStatus: ev.syncStatus,
        syncError: ev.syncError,
      });
    }

    if (action === "bulkImport" && Array.isArray(payload.events)) {
      const existingRows = sheet.getDataRange().getValues();
      const existingKeys = new Set();
      for (let i = 1; i < existingRows.length; i++) {
        const r = existingRows[i];
        if (!r[0]) continue;
        existingKeys.add(`${formatDateIso_(r[4])}|${String(r[2] || "")}|${String(r[1] || "").trim().toLowerCase()}`);
      }
      const syncCalendar = payload.syncCalendar === true;
      const toAppend = [];
      let syncedCount = 0;
      let skippedCount = 0;
      const nowIso = new Date().toISOString();

      payload.events.forEach((ev) => {
        const key = `${ev.date}|${ev.memberId}|${String(ev.title || "").trim().toLowerCase()}`;
        if (existingKeys.has(key)) {
          skippedCount++;
          return;
        }
        existingKeys.add(key);
        let googleId = "";
        let syncStatus = syncCalendar ? "pending" : "disabled";
        let syncError = "";
        if (syncCalendar && ev.syncGoogle !== false) {
          try {
            const res = upsertCalendarInvite_(ev, null);
            googleId = res.googleEventId || "";
            syncStatus = res.syncStatus || "synced";
            syncError = res.syncError || "";
            if (googleId) syncedCount++;
          } catch (err) {
            syncStatus = "error";
            syncError = String((err && err.message) || err);
          }
        }
        toAppend.push([
          ev.id,
          ev.title || "",
          ev.memberId || "COORD",
          ev.channelId || "otros",
          ev.date || "",
          ev.startTime || "09:30",
          ev.endTime || "10:30",
          Boolean(ev.allDay),
          ev.location || "",
          ev.notes || "",
          ev.popupMin || "60",
          ev.emailMin || "none",
          JSON.stringify(ev.groupAttendees || []),
          syncCalendar && ev.syncGoogle !== false,
          nowIso,
          googleId,
          syncStatus,
          syncError,
          Boolean(ev.tentative),
          String(ev.textAlign || "left"),
        ]);
      });

      if (toAppend.length > 0) {
        const startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, toAppend.length, 20).setValues(toAppend);
      }
      return jsonOut_({ ok: true, inserted: toAppend.length, skipped: skippedCount, syncedCalendar: syncedCount });
    }

    if (action === "delete" && payload.id) {
      const prevGoogleId = findGoogleEventIdByLocalId_(sheet, payload.id) || payload.googleEventId;
      if (prevGoogleId) {
        deleteGoogleEventById_(prevGoogleId);
      }
      deleteRowById_(sheet, payload.id);
      return jsonOut_({ ok: true });
    }

    if (action === "addTeamMember" && payload.member && payload.member.id) {
      const teamSheet = getTeamSheet_(true);
      const m = payload.member;
      const newId = String(m.id).trim();
      const newName = String(m.name || newId).trim();
      const newEmail = String(m.email || "").trim();
      const rows = teamSheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0] || "").trim().toLowerCase() === newId.toLowerCase()) {
          teamSheet.getRange(i + 1, 1, 1, 3).setValues([[newId, newName, newEmail]]);
          return jsonOut_({ ok: true, team: readTeamFromSheet_(teamSheet) });
        }
      }
      teamSheet.appendRow([newId, newName, newEmail]);
      return jsonOut_({ ok: true, team: readTeamFromSheet_(teamSheet) });
    }

    if (action === "saveTeam" && Array.isArray(payload.team)) {
      const teamSheet = getTeamSheet_(true);
      const validRows = [];
      const seenIndex = {};
      payload.team.forEach((m) => {
        if (!m) return;
        const id = String(m.id || "").trim();
        if (!id) return;
        const key = id.toLowerCase();
        const row = [id, String(m.name || id).trim(), String(m.email || "").trim()];
        if (Object.prototype.hasOwnProperty.call(seenIndex, key)) {
          const prev = validRows[seenIndex[key]];
          validRows[seenIndex[key]] = [row[0], row[1] || prev[1], row[2] || prev[2]];
          return;
        }
        seenIndex[key] = validRows.length;
        validRows.push(row);
      });
      if (validRows.length === 0) {
        return jsonOut_({ ok: false, error: "La lista del equipo no puede quedar vacía" });
      }
      // Escritura atómica sin vaciar primero la hoja (evita que lecturas simultáneas reinicien TEAM_MAP)
      teamSheet.getRange(2, 1, validRows.length, 3).setValues(validRows);
      const lastRow = teamSheet.getLastRow();
      const excessStart = validRows.length + 2;
      if (lastRow >= excessStart) {
        teamSheet.deleteRows(excessStart, lastRow - excessStart + 1);
      }
      return jsonOut_({ ok: true, team: readTeamFromSheet_(teamSheet) });
    }

    return jsonOut_({ ok: false, error: "Acción no reconocida" });
  } finally {
    lock.releaseLock();
  }
}

function findGoogleEventIdByLocalId_(sheet, id) {
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      return rows[i][15] ? String(rows[i][15]) : null;
    }
  }
  return null;
}

function syncEditsFromGoogleCalendar_(sheet) {
  try {
    const cache = CacheService.getScriptCache();
    if (cache.get("GCAL_SYNC_THROTTLE")) return;
    try {
      cache.put("GCAL_SYNC_THROTTLE", "1", 120);
    } catch (e) {}

    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return;

    const now = new Date();
    const minDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const maxDate = new Date(now.getFullYear(), now.getMonth() + 4, 0);

    const cals = [];
    const seenCalIds = {};
    const pushCal = (c) => {
      if (!c) return;
      const cid = c.getId();
      if (seenCalIds[cid]) return;
      seenCalIds[cid] = true;
      cals.push(c);
    };
    pushCal(getMasterCalendar_());
    try {
      pushCal(getTeamSyncCalendar_());
    } catch (e) {
      Logger.log("Aviso obteniendo calendario de equipo: " + e);
    }

    const byId = {};
    let allCalsReadOk = true;
    cals.forEach((cal) => {
      try {
        cal.getEvents(minDate, maxDate).forEach((ge) => {
          byId[ge.getId()] = ge;
        });
      } catch (readErr) {
        allCalsReadOk = false;
        Logger.log("Error leyendo calendario en syncEditsFromGoogleCalendar_: " + readErr);
      }
    });

    const tz = Session.getScriptTimeZone();
    const minIso = Utilities.formatDate(minDate, tz, "yyyy-MM-dd");
    const maxIso = Utilities.formatDate(maxDate, tz, "yyyy-MM-dd");

    for (let i = rows.length - 1; i >= 1; i--) {
      const gId = rows[i][15] ? String(rows[i][15]) : "";
      if (!gId) continue;

      let ge = byId[gId] || null;
      if (!ge) {
        const rowDateIso = formatDateIso_(rows[i][4]);
        if (rowDateIso >= minIso && rowDateIso <= maxIso) {
          // Comprobamos en TODOS los calendarios (principal y equipo) antes de asumir que fue borrado
          let lookupErrored = false;
          for (let c = 0; c < cals.length; c++) {
            try {
              const found = cals[c].getEventById(gId);
              if (found) {
                ge = found;
                break;
              }
            } catch (lookupErr) {
              lookupErrored = true;
            }
          }
          if (!ge) {
            if (allCalsReadOk && !lookupErrored) {
              sheet.deleteRow(i + 1);
            }
            continue;
          }
          const geIso = Utilities.formatDate(ge.getStartTime(), tz, "yyyy-MM-dd");
          if (geIso >= minIso && geIso <= maxIso) {
            if (allCalsReadOk && !lookupErrored) {
              sheet.deleteRow(i + 1);
            }
            continue;
          }
        } else {
          continue;
        }
      }
      let rawTitle = ge.getTitle() || "";
      const prevTentative = rows[i][18] === true || rows[i][18] === "true";
      let newTentative = prevTentative;
      const tentMatch = rawTitle.match(/^\[TENTATIVA\]\s*(.*)$/i);
      if (tentMatch) {
        newTentative = true;
        rawTitle = tentMatch[1];
      } else if (prevTentative && /^\[[^\]]+\]\s*/.test(rawTitle)) {
        newTentative = false;
      }
      const roleMatch = rawTitle.match(/^\[([^\]]+)\]\s*(.*)$/);
      const newTitle = roleMatch ? roleMatch[2] : rawTitle;
      const newAllDay = ge.isAllDayEvent();
      const newDate = Utilities.formatDate(ge.getStartTime(), tz, "yyyy-MM-dd");
      const newStart = newAllDay ? "09:30" : Utilities.formatDate(ge.getStartTime(), tz, "HH:mm");
      const newEnd = newAllDay ? "11:30" : Utilities.formatDate(ge.getEndTime(), tz, "HH:mm");
      const newLoc = ge.getLocation() || "";

      const changed =
        newTitle !== String(rows[i][1] || "") ||
        newDate !== formatDateIso_(rows[i][4]) ||
        newStart !== formatTimeHhMm_(rows[i][5], "09:30") ||
        newEnd !== formatTimeHhMm_(rows[i][6], "11:30") ||
        newAllDay !== (rows[i][7] === true || rows[i][7] === "true") ||
        newLoc !== String(rows[i][8] || "") ||
        newTentative !== prevTentative;

      if (changed) {
        sheet.getRange(i + 1, 2).setValue(newTitle);
        sheet.getRange(i + 1, 5).setValue(newDate);
        sheet.getRange(i + 1, 6).setValue(newStart);
        sheet.getRange(i + 1, 7).setValue(newEnd);
        sheet.getRange(i + 1, 8).setValue(newAllDay);
        sheet.getRange(i + 1, 9).setValue(newLoc);
        sheet.getRange(i + 1, 15).setValue(new Date().toISOString());
        sheet.getRange(i + 1, 19).setValue(newTentative);
      }
    }
  } catch (err) {
    Logger.log("Error sincronizando ediciones desde Google Calendar: " + err);
  }
}

function deleteGoogleEventById_(googleEventId) {
  if (!googleEventId) return;
  const cals = [getMasterCalendar_()];
  try {
    const teamCal = getTeamSyncCalendar_();
    if (teamCal && teamCal.getId() !== cals[0].getId()) cals.push(teamCal);
  } catch (e) {}

  for (let c = 0; c < cals.length; c++) {
    try {
      const cal = cals[c];
      const gEv = cal.getEventById(googleEventId);
      if (gEv) {
        gEv.deleteEvent();
        return;
      }
      const now = new Date();
      const events = cal.getEvents(
        new Date(now.getFullYear(), now.getMonth() - 3, 1),
        new Date(now.getFullYear(), now.getMonth() + 6, 0)
      );
      for (let i = 0; i < events.length; i++) {
        if (events[i].getId() === googleEventId) {
          events[i].deleteEvent();
          return;
        }
      }
    } catch (err) {
      Logger.log("No se pudo borrar evento previo de Google Calendar: " + err);
    }
  }
}

function upsertRow_(sheet, ev) {
  const rows = sheet.getDataRange().getValues();
  const rowData = [
    ev.id,
    ev.title,
    ev.memberId,
    ev.channelId,
    ev.date,
    ev.startTime || "09:30",
    ev.endTime || "11:30",
    Boolean(ev.allDay),
    ev.location || "",
    ev.notes || "",
    ev.popupMin || "60",
    ev.emailMin || "none",
    JSON.stringify(ev.groupAttendees || []),
    ev.syncGoogle !== false,
    new Date().toISOString(),
    ev.googleEventId || "",
    ev.syncStatus || "",
    ev.syncError || "",
    Boolean(ev.tentative),
    String(ev.textAlign || "left"),
  ];

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(ev.id)) {
      sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
      return;
    }
  }
  sheet.appendRow(rowData);
}

function deleteRowById_(sheet, id) {
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
    }
  }
}

function resolveAttendeeEmails_(ev) {
  const recipients = [];
  const add = (email) => {
    const clean = String(email || "").trim().toLowerCase();
    if (clean && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) && recipients.indexOf(clean) < 0) {
      recipients.push(clean);
    }
  };
  const lookup = {};
  readTeamFromSheet_(getTeamSheet_(true)).forEach((m) => {
    lookup[m.id] = m.email || "";
  });
  // Solo notificar a la persona responsable de la tarea (sin añadir otros compañeros como invitados)
  add(lookup[ev.memberId]);
  return recipients;
}

function isExternalNonGoogleEmail_(email) {
  const em = String(email || "").trim().toLowerCase();
  if (!em || em.indexOf("@") < 0) return false;
  return !(em.endsWith("@salesland.net") || em.endsWith("@gmail.com") || em.endsWith("@googlemail.com"));
}

function upsertCalendarInvite_(ev, prevGoogleId) {
  const guests = resolveAttendeeEmails_(ev);
  if (!guests.length) {
    return {
      googleEventId: prevGoogleId || "",
      syncStatus: "no_recipients",
      syncError: "No hay correo configurado en Equipo para esta persona",
    };
  }

  const ownerEmail = String(Session.getActiveUser().getEmail() || "victorprado@salesland.net").trim().toLowerCase();
  const isOwnerOnly = guests.length === 1 && guests[0] === ownerEmail;
  const cal = isOwnerOnly ? getMasterCalendar_() : getTeamSyncCalendar_();
  const effectiveGuests = isOwnerOnly ? [] : guests;
  const hasExternalGuest = effectiveGuests.some(isExternalNonGoogleEmail_);

  const title = `${ev.tentative ? "[TENTATIVA] " : ""}[${ev.memberId}] ${ev.title}`;
  const desc = `${ev.notes || ""}\n\n(Enviado desde Calendario Training)`;
  const tz = Session.getScriptTimeZone();
  const eventDate = Utilities.parseDate(ev.date, tz, "yyyy-MM-dd");
  const start = ev.allDay ? null : Utilities.parseDate(`${ev.date} ${ev.startTime || "09:30"}`, tz, "yyyy-MM-dd HH:mm");
  const end = ev.allDay ? null : Utilities.parseDate(`${ev.date} ${ev.endTime || "11:30"}`, tz, "yyyy-MM-dd HH:mm");
  if (!ev.allDay && !(end > start)) {
    throw new Error("La hora final debe ser posterior a la inicial");
  }

  // Buscar evento existente en el calendario destino o en el calendario principal
  let event = prevGoogleId ? cal.getEventById(prevGoogleId) : null;
  let foundInOtherCal = false;
  if (!event && prevGoogleId) {
    const otherCal = isOwnerOnly ? getTeamSyncCalendar_() : getMasterCalendar_();
    const otherEv = otherCal.getEventById(prevGoogleId);
    if (otherEv) {
      event = otherEv;
      foundInOtherCal = true;
    }
  }

  // En Apps Script CalendarApp no se puede convertir directamente un evento Todo el día <-> Con horario
  // con setTime/setAllDayDate sin fallo; en ese caso (o si cambió de calendario) recreamos limpiamente sin correo.
  const needsRecreate =
    !event ||
    foundInOtherCal ||
    Boolean(event.isAllDayEvent()) !== Boolean(ev.allDay);

  if (needsRecreate) {
    if (event) {
      try {
        event.deleteEvent();
      } catch (delErr) {
        Logger.log("Aviso borrando evento previo al cambiar Todo el día/horario: " + delErr);
      }
    }
    const opts = {
      description: desc,
      location: ev.location || "",
      sendInvites: hasExternalGuest,
    };
    if (effectiveGuests.length) {
      opts.guests = effectiveGuests.join(",");
    }
    event = ev.allDay
      ? cal.createAllDayEvent(title, eventDate, opts)
      : cal.createEvent(title, start, end, opts);
  } else {
    // Actualiza el mismo evento in-place (funciona incluso en fechas/horas pasadas, sin enviar correo)
    event.setTitle(title);
    event.setDescription(desc);
    event.setLocation(ev.location || "");
    if (ev.allDay) event.setAllDayDate(eventDate);
    else event.setTime(start, end);

    const existing = event.getGuestList().map((g) => g.getEmail().toLowerCase());
    existing.forEach((email) => {
      if (effectiveGuests.indexOf(email) < 0) event.removeGuest(email);
    });
    effectiveGuests.forEach((email) => {
      if (existing.indexOf(email) < 0) event.addGuest(email);
    });
  }

  // Si la API avanzada de Google Calendar está activada, eliminamos cualquier Meet automático sin mandar avisos
  try {
    if (typeof Calendar !== "undefined" && Calendar.Events && typeof Calendar.Events.patch === "function") {
      const rawId = String(event.getId()).split("@")[0];
      Calendar.Events.patch({ conferenceData: null }, cal.getId(), rawId, {
        conferenceDataVersion: 1,
        sendUpdates: "none",
      });
    }
  } catch (meetErr) {
    Logger.log("Aviso limpiando conferenceData: " + meetErr);
  }

  event.setGuestsCanModify(true);
  event.setGuestsCanInviteOthers(false);
  event.removeAllReminders();
  if (ev.popupMin && ev.popupMin !== "none") event.addPopupReminder(Number(ev.popupMin));
  if (ev.emailMin && ev.emailMin !== "none") {
    event.addEmailReminder(Number(ev.emailMin));
    try {
      maybeSendEmailReminderNow_(ev, guests);
    } catch (mailErr) {
      Logger.log("Aviso enviando recordatorio por correo: " + mailErr);
    }
  }
  return { googleEventId: event.getId(), syncStatus: "synced", syncError: "" };
}

function formatReminderLabel_(min) {
  const m = Number(min);
  if (m === 15) return "15 minutos antes";
  if (m === 30) return "30 minutos antes";
  if (m === 60) return "1 hora antes";
  if (m === 1440) return "1 día antes";
  if (m === 2880) return "2 días antes";
  return m >= 60 ? `${Math.round(m / 60)} h antes` : `${m} min antes`;
}

function getSentRemindersMap_() {
  const raw = PropertiesService.getScriptProperties().getProperty("SENT_EMAIL_REMINDERS");
  if (!raw) return {};
  try {
    const map = JSON.parse(raw);
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const clean = {};
    Object.keys(map).forEach((k) => {
      if (Number(map[k]) > cutoff) clean[k] = map[k];
    });
    return clean;
  } catch (e) {
    return {};
  }
}

function saveSentRemindersMap_(map) {
  PropertiesService.getScriptProperties().setProperty("SENT_EMAIL_REMINDERS", JSON.stringify(map));
}

function maybeSendEmailReminderNow_(ev, guests) {
  if (!ev || !ev.emailMin || ev.emailMin === "none") return false;
  const mins = Number(ev.emailMin);
  if (!mins || isNaN(mins) || !guests || !guests.length) return false;

  const tz = Session.getScriptTimeZone();
  const timePart = ev.allDay ? "09:00" : (ev.startTime || "09:30");
  const eventStart = Utilities.parseDate(`${ev.date} ${timePart}`, tz, "yyyy-MM-dd HH:mm");
  if (!eventStart) return false;

  const nowMs = Date.now();
  const startMs = eventStart.getTime();
  const remindAtMs = startMs - mins * 60000;

  // Solo enviamos si ya estamos dentro de la ventana del recordatorio y el evento aún no ha empezado
  if (nowMs < remindAtMs || nowMs >= startMs) return false;

  const remKey = `${ev.id}|${ev.date}|${ev.allDay ? "ALLDAY" : (ev.startTime || "09:30")}|${mins}`;
  const sentMap = getSentRemindersMap_();
  if (sentMap[remKey]) return false;

  const label = formatReminderLabel_(mins);
  const horario = ev.allDay ? "Todo el día" : `${ev.startTime || "09:30"} - ${ev.endTime || "10:30"}`;
  const subject = `🔔 Recordatorio (${label}): [${ev.memberId}] ${ev.title}`;
  const plainBody = [
    `Recordatorio de actividad en Calendario Training`,
    ``,
    `Actividad: ${ev.title}`,
    `Responsable: ${ev.memberId}`,
    `Fecha: ${ev.date}`,
    `Horario: ${horario}`,
    ev.location ? `Ubicación: ${ev.location}` : "",
    ev.notes ? `Notas: ${ev.notes}` : "",
    ``,
    `Este es un aviso por correo programado (${label}). No es una invitación de calendario.`,
  ]
    .filter(Boolean)
    .join("\n");

  const esc = (s) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:520px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <div style="background:#ff6900;color:#ffffff;padding:12px 16px;font-weight:700;font-size:15px;">
        🔔 Recordatorio · Calendario Training
      </div>
      <div style="padding:16px;color:#111827;font-size:14px;line-height:1.5;">
        <p style="margin:0 0 10px;font-size:16px;font-weight:700;">[${esc(ev.memberId)}] ${esc(ev.title)}</p>
        <p style="margin:4px 0;"><strong>📅 Fecha:</strong> ${esc(ev.date)}</p>
        <p style="margin:4px 0;"><strong>🕒 Horario:</strong> ${esc(horario)}</p>
        ${ev.location ? `<p style="margin:4px 0;"><strong>📍 Ubicación:</strong> ${esc(ev.location)}</p>` : ""}
        ${ev.notes ? `<p style="margin:8px 0 0;padding:8px 10px;background:#f9fafb;border-radius:6px;"><strong>📝 Notas:</strong><br>${esc(ev.notes).replace(/\n/g, "<br>")}</p>` : ""}
        <p style="margin:14px 0 0;font-size:12px;color:#6b7280;">
          Aviso programado: ${esc(label)}. (Recordatorio informativo sin invitación .ics).
        </p>
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: guests.join(","),
    subject: subject,
    body: plainBody,
    htmlBody: htmlBody,
  });

  sentMap[remKey] = nowMs;
  saveSentRemindersMap_(sentMap);
  return true;
}

/**
 * Revisa periódicamente los eventos con "Alerta por Correo" activada y envía el
 * correo de recordatorio a todos los destinatarios cuando llega su hora.
 */
function processScheduledEmailReminders() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const sheet = getEventsSheet_();
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue;
      const emailMin = String(r[11] || "none");
      if (!emailMin || emailMin === "none") continue;
      const syncGoogle = r[13] !== false && r[13] !== "false";
      if (!syncGoogle) continue;
      const ev = {
        id: String(r[0]),
        title: String(r[1] || ""),
        memberId: String(r[2] || "COORD"),
        channelId: String(r[3] || "open_market"),
        date: formatDateIso_(r[4]),
        startTime: formatTimeHhMm_(r[5], "09:30"),
        endTime: formatTimeHhMm_(r[6], "10:30"),
        allDay: r[7] === true || r[7] === "true",
        location: String(r[8] || ""),
        notes: String(r[9] || ""),
        emailMin: emailMin,
        groupAttendees: r[12] ? JSON.parse(String(r[12])) : [],
      };
      const guests = resolveAttendeeEmails_(ev);
      try {
        maybeSendEmailReminderNow_(ev, guests);
      } catch (err) {
        Logger.log("Error enviando recordatorio para " + ev.id + ": " + err);
      }
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Ejecuta esta función UNA VEZ en el editor de Apps Script para activar el envío
 * automático de recordatorios por correo cada 5 minutos.
 */
function activarRecordatoriosPorCorreo() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "processScheduledEmailReminders") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("processScheduledEmailReminders").timeBased().everyMinutes(5).create();
  processScheduledEmailReminders();
  Logger.log("Activador de recordatorios por correo configurado cada 5 minutos.");
}

function readVacationsAndHolidays_(teamList) {
  const dynamicTeam = Array.isArray(teamList) ? teamList : [];
  const curYear = new Date().getFullYear();
  const festYears = [curYear, curYear + 1];

  const teamSig = dynamicTeam.map((m) => `${m.id || ""}|${m.name || ""}|${m.email || ""}`).join(";");
  let teamHash = String(teamSig.length);
  try {
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, teamSig);
    teamHash = digest.map((b) => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
  } catch (e) {}
  const cacheKey = `BLOCKED_DAYS_V2_${curYear}_${teamHash}`;
  const cache = CacheService.getScriptCache();
  try {
    const cachedRaw = cache.get(cacheKey);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  const blocked = {};
  try {
    const ss = SpreadsheetApp.openById(VACATIONS_SHEET_ID);
    const festSheet = ss.getSheetByName("FESTIVOS");
    if (festSheet) {
      const rows = festSheet.getDataRange().getValues();
      for (let r = 1; r < rows.length; r++) {
        const memberId = mapUser_(rows[r][0], dynamicTeam) || mapUser_(rows[r][1], dynamicTeam);
        if (!memberId) continue;
        for (let c = 3; c < rows[r].length; c++) {
          const val = rows[r][c];
          if (!val) continue;
          festYears.forEach((yr) => {
            const iso = parseShortDate_(val, yr);
            if (iso) blocked[`${memberId}|${iso}`] = { type: "FESTIVO", label: "FESTIVO" };
          });
        }
      }
    }

    const vacSheet = ss.getSheetByName("VACACIONES");
    if (vacSheet) {
      const rows = vacSheet.getDataRange().getValues();
      for (let r = 1; r < rows.length; r++) {
        const estado = String(rows[r][5] || "").trim().toLowerCase();
        if (estado !== "aprobado") continue;
        const memberId = mapUser_(rows[r][1], dynamicTeam) || mapUser_(rows[r][0], dynamicTeam);
        if (!memberId) continue;
        const fechaTxt = String(rows[r][2] || "").trim();
        const opcion = String(rows[r][4] || "Vacaciones").toUpperCase();
        const label = opcion.indexOf("EXTRA") >= 0 ? "DÍA EXTRA" : "VACACIONES";
        const rangeMatch = fechaTxt.match(/del\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+al\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
        if (rangeMatch) {
          const s = parseShortDateObj_(rangeMatch[1], curYear);
          const e = parseShortDateObj_(rangeMatch[2], curYear);
          if (s && e) {
            for (let d = new Date(s), g = 0; d <= e && g < 90; d.setDate(d.getDate() + 1), g++) {
              blocked[`${memberId}|${formatDateIso_(d)}`] = { type: label, label };
            }
          }
        } else {
          const iso = parseShortDate_(fechaTxt, curYear);
          if (iso) blocked[`${memberId}|${iso}`] = { type: label, label };
        }
      }
    }

    if (Object.keys(blocked).length > 0) {
      try {
        cache.put(cacheKey, JSON.stringify(blocked), 600);
      } catch (e) {}
    }
  } catch (err) {
    Logger.log("Error leyendo Usuarios APP: " + err);
  }
  return blocked;
}

function normStr_(val) {
  return String(val || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mapUser_(raw, teamList) {
  const s = normStr_(raw);
  if (!s) return null;
  if (s === "tm" || s.indexOf("tomas") >= 0) return "TM1";
  if (s === "ts" || s.indexOf("fabio") >= 0) return "TS1";
  if (s === "tn" || s.indexOf("hamza") >= 0) return "TN1";
  if (s === "tb" || s.indexOf("carles") >= 0) return "TB1";
  if (s === "tl" || s.indexOf("francisco") >= 0) return "TL1";
  if (s.indexOf("coordinator") >= 0 || s === "coord" || s.indexOf("victor") >= 0) return "COORD";
  if (s.indexOf("creator") >= 0 || s.indexOf("david") >= 0) return "David";

  // Emparejamiento dinámico con cualquier usuario creado en EQUIPO_WEB (por ID, nombre, correo o primer nombre del correo)
  const list = Array.isArray(teamList) ? teamList : [];
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if (!m || !m.id) continue;
    const idNorm = normStr_(m.id);
    const nameNorm = normStr_(m.name);
    const emailNorm = normStr_(m.email);
    const emailLocal = emailNorm.split("@")[0] || "";
    const firstWord = s.split(/[\s._-]+/)[0] || "";
    if (
      (idNorm && (s === idNorm || s.indexOf(idNorm) >= 0)) ||
      (nameNorm && (s === nameNorm || s.indexOf(nameNorm) >= 0)) ||
      (emailNorm && s === emailNorm) ||
      (emailLocal && firstWord.length >= 4 && emailLocal.indexOf(firstWord) === 0)
    ) {
      return m.id;
    }
  }
  return null;
}

function parseShortDateObj_(val, defaultYear) {
  if (val instanceof Date) {
    return new Date(defaultYear, val.getMonth(), val.getDate());
  }
  const m = String(val || "").match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!m) return null;
  const yr = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : defaultYear;
  return new Date(yr, Number(m[2]) - 1, Number(m[1]));
}

function parseShortDate_(val, defaultYear) {
  const d = parseShortDateObj_(val, defaultYear);
  return d ? formatDateIso_(d) : null;
}

function formatDateIso_(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(val || "").slice(0, 10);
}

function formatTimeHhMm_(val, fallback) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "HH:mm");
  }
  const m = String(val || "").match(/(\d{1,2}:\d{2})/);
  return m ? m[1].padStart(5, "0") : fallback;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
