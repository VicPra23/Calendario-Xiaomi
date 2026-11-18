# Calendario Training 2026 — Grupo de Trabajo (Sin Servidor · Google Workspace)

Aplicación web estática (**presupuesto 0 €**, sin servidor backend) que mantiene exactamente el estilo visual de tu hoja **Calendario Training 2026** (bloques semanales `MES · WXX`, columnas `L M X J V S D`, filas por rol `COORD`, `David`, `TL1`, `TM1`, `TB1`, `TS1`, `TN1` y leyenda de **Canales** con los mismos colores), añadiendo:

1. **Alertas en móviles y PC**: Al crear/editar un evento, se envía una invitación real de **Google Calendar** al correo de la persona asignada con recordatorios configurables (**notificación push** en móvil/PC + **correo en Gmail**).
2. **Conexión con otros calendarios**: Puedes conectar múltiples calendarios de Google Calendar (calendarios de compañeros, festivos de España, salas, etc.) e importar archivos `.ics` (Outlook, Apple Calendar).
3. **Más allá de Excel/Sheets**: Interfaz web interactiva con filtros por persona/canal, buscador instantáneo, notas, exportación `.ics` con alarmas y soporte **PWA** (instalable en móvil y PC).

---

## Cómo abrirlo ahora mismo (en local)

Para que la autenticación de Google funcione en local, ábrelo desde un servidor estático local (por ejemplo, con Python o VS Code Live Server), no con `file://`:

```powershell
# En la carpeta del proyecto:
python -m http.server 8080
```
Luego abre `http://localhost:8080` en tu navegador.

---

## Cómo alojarlo gratis para todo el equipo (0 € y sin servidor)

Tienes dos opciones gratuitas:
- **GitHub Pages** (recomendado): Sube esta carpeta a un repositorio de GitHub y activa *Settings → Pages → Deploy from branch*. Tendrás una URL `https://tu-usuario.github.io/calendario-training/` gratis para siempre.
- **Cloudflare Pages / Netlify**: Arrastra la carpeta y listo (HTTPS gratuito incluido).

---

## Cómo activar la conexión con Google Workspace (gratis, 3 minutos)

1. Entra en [Google Cloud Console](https://console.cloud.google.com/) con tu cuenta de Google Workspace (no requiere tarjeta de crédito).
2. Crea un proyecto nuevo (ej. `Calendario-Training`).
3. Ve a **APIs y servicios → Biblioteca**, busca y habilita **Google Calendar API** y **Google Sheets API** (esta última para bloquear automáticamente los días de las pestañas `FESTIVOS` y `VACACIONES`).
4. Ve a **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo: **Interno** (si todos usáis el mismo dominio de Google Workspace) o **Externo** (añadiendo los correos del equipo en *Usuarios de prueba*).
5. Ve a **Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - **Orígenes de JavaScript autorizados**: añade `http://localhost:8080` y la URL donde lo publiques (ej. `https://tu-usuario.github.io`).
6. Copia el **ID de cliente** (`...apps.googleusercontent.com`), abre la app, pulsa **📅 Otros calendarios** (o **Conectar Google**), pégalo y guarda.

---

## Automatización extra opcional (0 €)

En `apps-script/Code.gs` tienes un script listo para copiar en [Google Apps Script](https://script.google.com/) si quieres que cada miembro reciba automáticamente a las 08:00 un correo resumen en Gmail con su agenda del día.
