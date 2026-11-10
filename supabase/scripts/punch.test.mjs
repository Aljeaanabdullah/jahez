// Phase 6–7 tests: the punch Edge Function rules. Made-up descriptors and a temporary site.
// Run with: npm run test:punch
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { serviceClient, signInAs, createTempAccount, SUPABASE_URL, PUBLISHABLE_KEY } from './lib.mjs';

const db = serviceClient();
const MODEL = 'dlib-resnet-v1/align-v1';
const PHONE = 'punch-test-phone-0001';
const SITE = { lat: 29.3, lng: 47.9 };
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0xff, 0xd9]).toString('base64');

let account, session, employeeId, siteId, patternId;
let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
const enrolled = Array.from({ length: 128 }, () => rand() * 0.2);
const sameFace = () => enrolled.map((v) => v + rand() * 0.005);
const otherFace = () => Array.from({ length: 128 }, () => rand() * 0.2);

const goodBody = (over = {}) => ({
  device_identifier: PHONE,
  location: { lat: SITE.lat + 0.0005, lng: SITE.lng, accuracy: 12 }, // ~55 m from the centre
  report: { vpn: false, mock_location: false, rooted: false, liveness: { challenge: 'blink', passed: true } },
  descriptor: sameFace(),
  model_version: MODEL,
  photo: JPEG,
  ...over,
});

async function punch(body) {
  const { data } = await session.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/punch`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function clearPunches() {
  const { data: files } = await db.storage.from('punch-photos').list(employeeId, { limit: 1000 });
  if (files?.length) await db.storage.from('punch-photos').remove(files.map((f) => `${employeeId}/${f.name}`));
  await db.from('attendance_days').delete().eq('employee_id', employeeId);
  await db.from('attendance_punches').delete().eq('employee_id', employeeId);
}

/** Kuwait wall-clock time (HH:MM) of an instant. */
const kuwaitTime = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuwait', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);

before(async () => {
  account = await createTempAccount(799918, 'employee');
  session = await signInAs(account.file_number, account.password);
  ({ data: { id: employeeId } } = await db.from('employees').select('id').eq('file_number', 799918).single());
  const { data: site } = await db.from('sites')
    .insert({ name_ar: 'موقع اختبار التبصيم', name_en: 'Punch test site', latitude: SITE.lat, longitude: SITE.lng, radius_m: 200, is_demo: true })
    .select('id').single();
  siteId = site.id;
  // A shift that started 30 minutes ago, every day, so punching is open now (rules engine, Phase 7).
  const { data: pattern } = await db.from('work_patterns').insert({
    kind: 'morning', name_ar: 'نمط اختبار التبصيم', name_en: 'Punch test pattern',
    shift_start: kuwaitTime(new Date(Date.now() - 30 * 60_000)), shift_duration: '8 hours', weekly_off_days: [],
  }).select('id').single();
  patternId = pattern.id;
  await db.from('employees').update({ work_pattern_id: patternId }).eq('id', employeeId);
  await db.from('employee_sites').insert({ employee_id: employeeId, site_id: siteId });
  await db.from('devices').insert({ employee_id: employeeId, device_identifier: PHONE, platform: 'android', model: 'Test' });
  await db.from('consents').insert({ employee_id: employeeId, consent_version: 'v1' });
  await db.from('face_templates').insert({
    employee_id: employeeId, embedding: `[${enrolled.join(',')}]`, model_version: MODEL, source: 'web',
  });
});

beforeEach(clearPunches);

after(async () => {
  await clearPunches();
  await db.from('face_templates').delete().eq('employee_id', employeeId);
  await account.remove();
  await db.from('sites').delete().eq('id', siteId);
  await db.from('work_patterns').delete().eq('id', patternId);
});

test('inside the site with the right face: accepted as check-in, then check-out', async () => {
  const first = await punch(goodBody());
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.result, 'accepted');
  assert.equal(first.body.punch_type, 'check_in');
  assert.equal(first.body.site.name_en, 'Punch test site');
  assert.ok(Math.abs(new Date(first.body.punched_at).getTime() - Date.now()) < 60_000, 'server time');

  assert.equal(first.body.day.arrival, 'on_time'); // 30 minutes into the shift, inside the grace hour
  assert.equal(first.body.day.late_minutes, 0);

  const { data: shift } = await session.rpc('my_shift_now');
  assert.equal(shift[0].arrival, 'on_time');
  assert.ok(shift[0].check_in_at);

  const second = await punch(goodBody());
  assert.equal(second.body.result, 'accepted');
  assert.equal(second.body.punch_type, 'check_out');
  assert.equal(second.body.day.departure, 'done');
  assert.ok(second.body.day.early_leave_minutes > 400, 'early leave recorded for reference');

  const third = await punch(goodBody());
  assert.equal(third.body.result, 'rejected');
  assert.equal(third.body.reason, 'already_checked_out');
});

test('no shift now: refused, but still recorded with its photo', async () => {
  await db.from('employees').update({ work_pattern_id: null }).eq('id', employeeId);
  try {
    const res = await punch(goodBody());
    assert.equal(res.body.result, 'rejected');
    assert.equal(res.body.reason, 'no_work_pattern');
    const { data: rows } = await db.from('attendance_punches').select('photo_path').eq('employee_id', employeeId);
    assert.equal(rows.length, 1);
  } finally {
    await db.from('employees').update({ work_pattern_id: patternId }).eq('id', employeeId);
  }
});

test('every attempt is recorded with its photo', async () => {
  await punch(goodBody());
  await punch(goodBody({ report: { ...goodBody().report, vpn: true } }));
  const { data: rows } = await db.from('attendance_punches').select('result, reject_reason, photo_path, client_report').eq('employee_id', employeeId);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.photo_path), 'photo kept for every attempt');
  assert.equal(rows.find((r) => r.result === 'rejected').reject_reason, 'vpn');
  const { data: files } = await db.storage.from('punch-photos').list(employeeId);
  assert.equal(files.length, 2);
});

test('outside the 200 m circle is refused, with the distance', async () => {
  const res = await punch(goodBody({ location: { lat: SITE.lat + 0.01, lng: SITE.lng, accuracy: 10 } })); // ~1.1 km
  assert.equal(res.body.result, 'rejected');
  assert.equal(res.body.reason, 'outside_site');
  assert.ok(res.body.distance_m > 1000 && res.body.distance_m < 1200, String(res.body.distance_m));
});

test('another person\'s face is refused', async () => {
  const res = await punch(goodBody({ descriptor: otherFace() }));
  assert.equal(res.body.reason, 'face_mismatch');
});

test('phone and integrity checks are refused with a clear reason', async () => {
  const base = goodBody().report;
  const cases = [
    [{ device_identifier: 'someone-elses-phone-99' }, 'wrong_device'],
    [{ report: { ...base, vpn: true } }, 'vpn'],
    [{ report: { ...base, mock_location: true } }, 'mock_location'],
    [{ report: { ...base, rooted: true } }, 'rooted'],
    [{ report: { ...base, liveness: { challenge: 'blink', passed: false } } }, 'liveness_failed'],
  ];
  for (const [over, reason] of cases) {
    await clearPunches(); // keep each case independent of the lock-out rule
    const res = await punch(goodBody(over));
    assert.equal(res.body.reason, reason, JSON.stringify(over));
  }
});

test('imprecise GPS is refused', async () => {
  const res = await punch(goodBody({ location: { lat: SITE.lat, lng: SITE.lng, accuracy: 250 } }));
  assert.equal(res.body.reason, 'weak_gps');
});

test('a disabled site does not accept punches', async () => {
  await db.from('sites').update({ is_active: false }).eq('id', siteId);
  try {
    const res = await punch(goodBody());
    assert.equal(res.body.reason, 'no_site');
  } finally {
    await db.from('sites').update({ is_active: true }).eq('id', siteId);
  }
});

test('5 refused attempts in a row lock punching for 5 minutes', async () => {
  for (let i = 0; i < 5; i++) {
    const res = await punch(goodBody({ descriptor: otherFace() }));
    assert.equal(res.status, 200);
  }
  const locked = await punch(goodBody());
  assert.equal(locked.status, 429);
  assert.equal(locked.body.error, 'locked');
  assert.ok(new Date(locked.body.unlock_at) > new Date());
});

test('employees cannot read other people\'s punches or call the server helpers', async () => {
  const { data } = await session.from('attendance_punches').select('employee_id');
  assert.ok(data.every((r) => r.employee_id === employeeId));
  const { error } = await session.rpc('face_distance', { p_employee_id: employeeId, p_embedding: `[${enrolled.join(',')}]` });
  assert.ok(error);
  const { error: sitesError } = await session.rpc('sites_near', { p_employee_id: employeeId, p_lat: 0, p_lng: 0, p_on: '2026-11-10' });
  assert.ok(sitesError);
  assert.match(sitesError.message, /permission denied/);
});
