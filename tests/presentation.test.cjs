const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function app() {
  const context = vm.createContext({ document: { addEventListener() {} }, console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8') +
    '\nthis.api = { state, CHANNELS, getChannel, getVisibleChannels, getQuarterTheme, dayHeaderHtml, weekBannerHtml, applyQuarterTheme };', context);
  return context.api;
}

test('Los doce meses se agrupan en cuatro colores, sin cambiar dentro del trimestre', () => {
  const api = app();
  const colors = Array.from({ length: 12 }, (_, month) => api.getQuarterTheme(new Date(2026, month, 15)).bg);
  assert.equal(new Set(colors).size, 4);
  for (let month = 0; month < 12; month += 3) {
    assert.equal(colors[month], colors[month + 1]);
    assert.equal(colors[month], colors[month + 2]);
  }
});

test('Una semana que cruza de marzo a abril conserva ambos meses y sus colores', () => {
  const api = app();
  const days = Array.from({ length: 7 }, (_, i) => new Date(2026, 2, 30 + i));
  const html = api.weekBannerHtml(days, 14);
  assert.match(html, /Marzo/i);
  assert.match(html, /Abril/i);
  assert.ok(html.includes(api.getQuarterTheme(days[0]).bg));
  assert.ok(html.includes(api.getQuarterTheme(days[6]).bg));
  assert.match(html, /W14/);
});

test('Cabeceras compactas con S y D y el día del mes', () => {
  const api = app();
  assert.match(api.dayHeaderHtml(new Date(2026, 10, 21)), />S<.*>21</);
  assert.match(api.dayHeaderHtml(new Date(2026, 10, 22)), />D<.*>22</);
  assert.match(api.dayHeaderHtml(new Date(2026, 10, 16)), />Lun<.*>16</);
});

test('MediaMarkt y ECI son canales distintos; eventos antiguos open_market se muestran como Otros', () => {
  const api = app();
  assert.ok(api.CHANNELS.some(c => c.id === 'media_markt'));
  assert.ok(api.CHANNELS.some(c => c.id === 'eci'));
  assert.ok(!api.getVisibleChannels().some(c => c.id === 'open_market'));
  api.state.events.push({ id: 'existing-1', channelId: 'open_market' });
  const before = JSON.stringify(api.state.events);
  assert.ok(!api.getVisibleChannels().some(c => c.id === 'open_market'));
  assert.equal(api.getChannel('open_market').id, 'otros');
  assert.equal(JSON.stringify(api.state.events), before);
});

test('La leyenda no añade chips extra para eventos antiguos en externalEvents u outbox', () => {
  for (const source of ['externalEvents', 'outbox']) {
    const api = app();
    const event = { id: 'pending', channelId: 'open_market' };
    if (source === 'outbox') api.state.outbox.pending = { event };
    else api.state.externalEvents.push(event);
    assert.ok(!api.getVisibleChannels().some(c => c.id === 'open_market'));
    assert.equal(api.getChannel(event.channelId).id, 'otros');
  }
});
