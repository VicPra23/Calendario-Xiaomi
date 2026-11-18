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

const TEAM_MAP = {
  COORD: "victorprado@salesland.net",
  David: "davidotero@salesland.net",
  TL1: "franciscocerezo@salesland.net",
  TM1: "tomasrubiolo@salesland.net",
  TB1: "carleshinojosa@salesland.net",
  TS1: "fabiogarcia@salesland.net",
  TN1: "hamzagaya@salesland.net",
};

function getEventsSheet_() {
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
  let sheet = ss.getSheetByName(EVENTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(EVENTS_SHEET_NAME);
    sheet.appendRow([
      "id", "title", "memberId", "channelId", "date", "startTime",
      "endTime", "allDay", "location", "notes", "popupMin", "emailMin",
      "groupAttendees", "syncGoogle", "updatedAt", "googleEventId",
    ]);
  }
  return sheet;
}

function doGet() {
  const sheet = getEventsSheet_();
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
      emailMin: String(r[11] || "1440"),
      groupAttendees: r[12] ? JSON.parse(String(r[12])) : [],
      syncGoogle: r[13] !== false && r[13] !== "false",
      googleEventId: r[15] ? String(r[15]) : null,
    });
  }

  const blockedDays = readVacationsAndHolidays_();
  return jsonOut_({ ok: true, events, blockedDays });
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || "{}");
  const action = payload.action;
  const sheet = getEventsSheet_();

  if (action === "upsert" && payload.event) {
    const ev = payload.event;
    const prevGoogleId = findGoogleEventIdByLocalId_(sheet, ev.id) || ev.googleEventId;
    if (prevGoogleId) {
      deleteGoogleEventById_(prevGoogleId);
    }
    let newGoogleId = "";
    if (ev.syncGoogle !== false) {
      newGoogleId = sendCalendarInvite_(ev) || "";
    }
    ev.googleEventId = newGoogleId;
    upsertRow_(sheet, ev);
    return jsonOut_({ ok: true, googleEventId: newGoogleId });
  }

  if (action === "delete" && payload.id) {
    const prevGoogleId = findGoogleEventIdByLocalId_(sheet, payload.id);
    if (prevGoogleId) {
      deleteGoogleEventById_(prevGoogleId);
    }
    deleteRowById_(sheet, payload.id);
    return jsonOut_({ ok: true });
  }

  if (action === "replaceAll" && Array.isArray(payload.events)) {
    const rows = sheet.getDataRange().getValues();
    const nextIds = new Set(payload.events.map((x) => String(x.id)));
    // Eliminar de Google Calendar los eventos que ya no están tras Deshacer/Sustituir
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

  return jsonOut_({ ok: false, error: "Acción no reconocida" });
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
    const cal = CalendarApp.getDefaultCalendar();
    const gEvents = cal.getEvents(minDate, maxDate);
    const byId = {};
    gEvents.forEach((ge) => {
      byId[ge.getId()] = ge;
    });

    const tz = Session.getScriptTimeZone();
    for (let i = 1; i < rows.length; i++) {
      const gId = rows[i][15] ? String(rows[i][15]) : "";
      if (!gId || !byId[gId]) continue;

      const ge = byId[gId];
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
        newStart !== String(rows[i][5] || "") ||
        newEnd !== String(rows[i][6] || "") ||
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
    const cal = CalendarApp.getDefaultCalendar();
    const gEv = cal.getEventById(googleEventId);
    if (gEv) gEv.deleteEvent();
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
    ev.emailMin || "1440",
    JSON.stringify(ev.groupAttendees || []),
    ev.syncGoogle !== false,
    new Date().toISOString(),
    ev.googleEventId || "",
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

function sendCalendarInvite_(ev) {
  try {
    const guests = [];
    if (TEAM_MAP[ev.memberId]) guests.push(TEAM_MAP[ev.memberId]);
    (ev.groupAttendees || []).forEach((id) => {
      if (TEAM_MAP[id] && guests.indexOf(TEAM_MAP[id]) === -1) {
        guests.push(TEAM_MAP[id]);
      }
    });
    if (!guests.length) return "";

    const cal = CalendarApp.getDefaultCalendar();
    const title = `[${ev.memberId}] ${ev.title}`;
    const desc = `${ev.notes || ""}\n\n(Enviado desde Calendario Training)`;
    const opts = {
      description: desc,
      location: ev.location || "",
      guests: guests.join(","),
      sendInvites: false,
    };

    let created;
    if (ev.allDay) {
      const d = Utilities.parseDate(ev.date, Session.getScriptTimeZone(), "yyyy-MM-dd");
      created = cal.createAllDayEvent(title, d, opts);
    } else {
      const tz = Session.getScriptTimeZone();
      const start = Utilities.parseDate(`${ev.date} ${ev.startTime || "09:30"}`, tz, "yyyy-MM-dd HH:mm");
      const end = Utilities.parseDate(`${ev.date} ${ev.endTime || "11:30"}`, tz, "yyyy-MM-dd HH:mm");
      created = cal.createEvent(title, start, end, opts);
    }
    if (created) {
      created.setGuestsCanModify(true);
      created.setGuestsCanInviteOthers(true);
    }
    if (created && ev.popupMin && ev.popupMin !== "none") {
      created.addPopupReminder(Number(ev.popupMin));
    }
    if (created && ev.emailMin && ev.emailMin !== "none") {
      created.addEmailReminder(Number(ev.emailMin));
    }
    return created ? created.getId() : "";
  } catch (err) {
    Logger.log("Error enviando invitación: " + err);
    return "";
  }
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
