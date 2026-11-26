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

function getTeamSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(TEAM_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TEAM_SHEET_NAME);
    sheet.appendRow(["id", "name", "email"]);
  }
  if (sheet.getLastRow() <= 1) {
    Object.keys(TEAM_MAP).forEach((id) => {
      sheet.appendRow([id, id, TEAM_MAP[id]]);
    });
  }
  return sheet;
}

function readTeamFromSheet_(teamSheet) {
  const rows = teamSheet.getDataRange().getValues();
  const team = [];
  for (let i = 1; i < rows.length; i++) {
    const id = String(rows[i][0] || "").trim();
    if (!id) continue;
    team.push({
      id: id,
      name: String(rows[i][1] || id).trim(),
      email: String(rows[i][2] || "").trim(),
    });
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

  const blockedDays = readVacationsAndHolidays_();
  const team = readTeamFromSheet_(teamSheet);
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
        // No colgamos eventos del equipo en el calendario personal del propietario del script
        // (cada usuario añade su propio evento en su calendario desde la web, sin Meet ni invitaciones).
        // Solo gestionamos el recordatorio por correo opcional si está activado.
        ev.syncStatus = "self_calendar";
        if (ev.emailMin && ev.emailMin !== "none") {
          try {
            maybeSendEmailReminderNow_(ev, resolveAttendeeEmails_(ev));
          } catch (mailErr) {
            Logger.log("Aviso enviando recordatorio por correo: " + mailErr);
          }
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

    if (action === "cleanupImportedCalendar") {
      const cal = getMasterCalendar_();
      const calEvents = cal.getEvents(new Date(2026, 10, 22), new Date(2027, 0, 2));
      let deletedCal = 0;
      calEvents.forEach((ce) => {
        const desc = String(ce.getDescription() || "");
        if (desc.indexOf("(Enviado desde Calendario Training)") >= 0) {
          try {
            ce.deleteEvent();
            deletedCal++;
          } catch (err) {
            Logger.log("No se pudo borrar evento: " + err);
          }
        }
      });
      return jsonOut_({ ok: true, deletedCalendarEvents: deletedCal });
    }

    if (action === "delete" && payload.id) {
      const prevGoogleId = findGoogleEventIdByLocalId_(sheet, payload.id) || payload.googleEventId;
      if (prevGoogleId) {
        deleteGoogleEventById_(prevGoogleId);
      }
      deleteRowById_(sheet, payload.id);
      return jsonOut_({ ok: true });
    }

    if (action === "replaceAll" && Array.isArray(payload.events)) {
      const rows = sheet.getDataRange().getValues();
      const nextIds = new Set(payload.events.map((x) => String(x.id)));
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] && !nextIds.has(String(rows[i][0])) && rows[i][15]) {
          deleteGoogleEventById_(String(rows[i][15]));
        }
      }
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
      payload.events.forEach((ev) => {
        if (ev.syncGoogle !== false && !ev.googleEventId) {
          ev.googleEventId = sendCalendarInvite_(ev) || "";
        }
        upsertRow_(sheet, ev);
      });
      return jsonOut_({ ok: true });
    }

    if (action === "saveTeam" && Array.isArray(payload.team)) {
      const teamSheet = getTeamSheet_();
      const lastRow = teamSheet.getLastRow();
      if (lastRow > 1) teamSheet.deleteRows(2, lastRow - 1);
      payload.team.forEach((m) => {
        if (m && m.id) {
          teamSheet.appendRow([String(m.id), String(m.name || m.id), String(m.email || "")]);
        }
      });
      return jsonOut_({ ok: true });
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
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return;

    const now = new Date();
    const minDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const maxDate = new Date(now.getFullYear(), now.getMonth() + 4, 0);
    const cal = getMasterCalendar_();
    const gEvents = cal.getEvents(minDate, maxDate);
    const byId = {};
    gEvents.forEach((ge) => {
      byId[ge.getId()] = ge;
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
          // Si no aparece en getEvents(min, max), comprobamos si fue movido fuera del rango;
          // si getEventById devuelve null O su fecha sigue dentro del rango, significa que está en la Papelera (borrado)
          try {
            ge = cal.getEventById(gId);
          } catch (e) {
            ge = null;
          }
          if (!ge) {
            sheet.deleteRow(i + 1);
            continue;
          }
          const geIso = Utilities.formatDate(ge.getStartTime(), tz, "yyyy-MM-dd");
          if (geIso >= minIso && geIso <= maxIso) {
            sheet.deleteRow(i + 1);
            continue;
          }
        } else {
          continue;
        }
      }
      const rawTitle = ge.getTitle() || "";
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
        newLoc !== String(rows[i][8] || "");

      if (changed) {
        sheet.getRange(i + 1, 2).setValue(newTitle);
        sheet.getRange(i + 1, 5).setValue(newDate);
        sheet.getRange(i + 1, 6).setValue(newStart);
        sheet.getRange(i + 1, 7).setValue(newEnd);
        sheet.getRange(i + 1, 8).setValue(newAllDay);
        sheet.getRange(i + 1, 9).setValue(newLoc);
        sheet.getRange(i + 1, 15).setValue(new Date().toISOString());
      }
    }
  } catch (err) {
    Logger.log("Error sincronizando ediciones desde Google Calendar: " + err);
  }
}

function deleteGoogleEventById_(googleEventId) {
  if (!googleEventId) return;
  try {
    const cal = getMasterCalendar_();
    const gEv = cal.getEventById(googleEventId);
    if (gEv) {
      gEv.deleteEvent();
      return;
    }
    // Respaldo por si el ID requiere búsqueda en rango
    const now = new Date();
    const events = cal.getEvents(
      new Date(now.getFullYear(), now.getMonth() - 2, 1),
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
  readTeamFromSheet_(getTeamSheet_()).forEach((m) => {
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

  const hasExternalGuest = guests.some(isExternalNonGoogleEmail_);
  const cal = getMasterCalendar_();
  const title = `${ev.tentative ? "[TENTATIVA] " : ""}[${ev.memberId}] ${ev.title}`;
  const desc = `${ev.notes || ""}\n\n(Enviado desde Calendario Training)`;
  const tz = Session.getScriptTimeZone();
  const eventDate = Utilities.parseDate(ev.date, tz, "yyyy-MM-dd");
  const start = ev.allDay ? null : Utilities.parseDate(`${ev.date} ${ev.startTime || "09:30"}`, tz, "yyyy-MM-dd HH:mm");
  const end = ev.allDay ? null : Utilities.parseDate(`${ev.date} ${ev.endTime || "11:30"}`, tz, "yyyy-MM-dd HH:mm");
  if (!ev.allDay && !(end > start)) {
    throw new Error("La hora final debe ser posterior a la inicial");
  }

  let event = prevGoogleId ? cal.getEventById(prevGoogleId) : null;
  if (!event) {
    const opts = {
      description: desc,
      location: ev.location || "",
      guests: guests.join(","),
      // Google Workspace (@salesland.net / Gmail) recibe el evento sin correo;
      // dominios externos como @xiaomi.com (Outlook) necesitan sendInvites: true para que entre en su calendario.
      sendInvites: hasExternalGuest,
    };
    event = ev.allDay
      ? cal.createAllDayEvent(title, eventDate, opts)
      : cal.createEvent(title, start, end, opts);
  } else {
    // Actualiza el mismo evento in-place conservando ID y asistentes
    event.setTitle(title);
    event.setDescription(desc);
    event.setLocation(ev.location || "");
    if (ev.allDay) event.setAllDayDate(eventDate);
    else event.setTime(start, end);

    const existing = event.getGuestList().map((g) => g.getEmail().toLowerCase());
    existing.forEach((email) => {
      if (guests.indexOf(email) < 0) event.removeGuest(email);
    });
    guests.forEach((email) => {
      if (existing.indexOf(email) < 0) event.addGuest(email);
    });
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

function sendCalendarInvite_(ev) {
  return upsertCalendarInvite_(ev, null).googleEventId || "";
}

function readVacationsAndHolidays_() {
  const blocked = {};
  try {
    const ss = SpreadsheetApp.openById(VACATIONS_SHEET_ID);
    const festSheet = ss.getSheetByName("FESTIVOS");
    if (festSheet) {
      const rows = festSheet.getDataRange().getValues();
      for (let r = 1; r < rows.length; r++) {
        const memberId = mapUser_(rows[r][0]) || mapUser_(rows[r][1]);
        if (!memberId) continue;
        for (let c = 3; c < rows[r].length; c++) {
          const val = rows[r][c];
          if (!val) continue;
          [2026, 2027].forEach((yr) => {
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
        const memberId = mapUser_(rows[r][1]);
        if (!memberId) continue;
        const fechaTxt = String(rows[r][2] || "").trim();
        const opcion = String(rows[r][4] || "Vacaciones").toUpperCase();
        const label = opcion.indexOf("EXTRA") >= 0 ? "DÍA EXTRA" : "VACACIONES";
        const rangeMatch = fechaTxt.match(/del\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+al\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
        if (rangeMatch) {
          const s = parseShortDateObj_(rangeMatch[1], 2026);
          const e = parseShortDateObj_(rangeMatch[2], 2026);
          if (s && e) {
            for (let d = new Date(s), g = 0; d <= e && g < 90; d.setDate(d.getDate() + 1), g++) {
              blocked[`${memberId}|${formatDateIso_(d)}`] = { type: label, label };
            }
          }
        } else {
          const iso = parseShortDate_(fechaTxt, 2026);
          if (iso) blocked[`${memberId}|${iso}`] = { type: label, label };
        }
      }
    }
  } catch (err) {
    Logger.log("Error leyendo Usuarios APP: " + err);
  }
  return blocked;
}

function mapUser_(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return null;
  if (s === "tm" || s.indexOf("tomás") >= 0 || s.indexOf("tomas") >= 0) return "TM1";
  if (s === "ts" || s.indexOf("fabio") >= 0) return "TS1";
  if (s === "tn" || s.indexOf("hamza") >= 0) return "TN1";
  if (s === "tb" || s.indexOf("carles") >= 0) return "TB1";
  if (s === "tl" || s.indexOf("francisco") >= 0) return "TL1";
  if (s.indexOf("coordinator") >= 0 || s === "coord" || s.indexOf("victor") >= 0) return "COORD";
  if (s.indexOf("creator") >= 0 || s.indexOf("david") >= 0) return "David";
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
