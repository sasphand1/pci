import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hubReadings, hubSourceId } from '../../src/modules/satellite/hub-map.ts';
const at = '2026-11-25T12:00:00.000Z';
test('satellite records become comparable hub readings with decimal scale', () => {
  assert.equal(hubSourceId('airquality'), 'sat_airquality.api');
  const aq = hubReadings('airquality', [{ metric: 'air_quality', location: 'lahore', observationKey: 'lahore', observedAt: at, payload: { values: { us_aqi: 210, pm2_5: 170.4, nitrogen_dioxide: null } } }]);
  assert.deepEqual(aq.map(x => [x.entityId, x.metric, x.value, x.scale]), [['city:lahore', 'us_aqi', 210, 0], ['city:lahore', 'pm2_5', 170.4, 1]]);
  const w = hubReadings('weather', [{ metric: 'weather', location: 'quetta', observationKey: 'quetta', observedAt: at, payload: { current: { temperatureC: -3.4 }, heatDays: 0 } }]);
  assert.equal(w.find(x => x.metric === 'temperature_c')?.value, -3.4);
  const fires = hubReadings('firms', [1, 2, 3].map(i => ({ metric: 'fire', location: 'bounding-box', observationKey: String(i), observedAt: at, payload: {} })));
  assert.deepEqual(fires.map(x => [x.entityId, x.metric, x.value]), [['region:pakistan', 'fire_hotspots_3d', 3]]);
  const alert = hubReadings('gdacs', [{ metric: 'disaster_alert', location: 'bounding-box', observationKey: 'k', observedAt: at, payload: { eventType: 'TC', eventId: '9', alertLevel: 'Orange', alertScore: 2 } }]);
  assert.equal(alert[0].text, 'Orange'); assert.equal(alert[0].entityId, 'gdacs:TC:9');
  const river = hubReadings('flood', [{ metric: 'river_flow', location: 'indus-sukkur', observationKey: 'k', observedAt: at, payload: { dischargeM3s: 1100, peak30: { date: '2026-11-27', max: 2400 } } }]);
  assert.deepEqual(river.map(x => x.metric), ['discharge_m3s', 'peak_30d_m3s']);
});
