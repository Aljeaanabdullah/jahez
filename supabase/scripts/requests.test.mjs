// Phase 8 tests: requests and the approval path (PRD 7).
// employee -> department supervisor -> HR; no skipping; nobody approves their own request.
// Run with: npm run test:requests
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { serviceClient, signInAs, createTempAccount } from './lib.mjs';

const db = serviceClient();
const kuwaitDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait' }).format(d);
const daysAgo = (n) => kuwaitDate(new Date(Date.now() - n * 86_400_000));
const at = (date, hm) => `${date}T${hm}:00+03:00`;

const people = {
  emp: [799930, 'employee'],     // in department A (supervisor: sup)
  sup: [799931, 'supervisor'],   // supervises department A, and is in it
  sup2: [799932, 'supervisor'],  // supervises department B
  hr: [799933, 'hr'],            // in department A
  hr2: [799934, 'hr'],
  admin: [799935, 'admin'],
  lone: [799936, 'employee'],    // in department C, which has no supervisor
};
const acc = {};
const s = {};  // signed-in clients
const id = {}; // employee ids
let deptA, deptB, deptC, patternId, siteX;

const submit = (who, args) => s[who].rpc('submit_request', args);
const decide = (who, request, approve, note) => s[who].rpc('decide_request', { p_request: request, p_approve: approve, p_note: note ?? null });
const statusOf = async (request) => (await db.from('requests').select('status').eq('id', request).single()).data.status;

async function correction(who = 'emp', type = 'check_in', hm = '07:30', date = daysAgo(1)) {
  const { data, error } = await submit(who, {
    p_type: 'punch_correction', p_shift_date: date, p_reason: 'نسيت البصمة', p_punch_type: type, p_time: at(date, hm),
  });
  assert.ifError(error);
  return data;
}

async function dayRecord(who, date) {
  const { data } = await s[who].rpc('attendance_history', { p_employee: id[who], p_from: date, p_to: date });
  return data[0];
}

before(async () => {
  const { data: p } = await db.from('work_patterns')
    .insert({ kind: 'morning', name_ar: 'نمط اختبار الطلبات', name_en: 'Requests test pattern', shift_start: '07:00', shift_duration: '8 hours', weekly_off_days: [] })
    .select('id').single();
  patternId = p.id;
  for (const [key, [file, role]] of Object.entries(people)) {
    acc[key] = await createTempAccount(file, role);
    s[key] = await signInAs(file, acc[key].password);
    id[key] = (await db.from('employees').select('id').eq('file_number', file).single()).data.id;
  }
  const mk = async (name, supervisor) => (await db.from('departments')
    .insert({ name_ar: `قسم اختبار ${name}`, name_en: `E2E dept ${name}`, supervisor_id: supervisor }).select('id').single()).data.id;
  deptA = await mk('A', id.sup);
  deptB = await mk('B', id.sup2);
  deptC = await mk('C', null);
  const inDept = { emp: deptA, sup: deptA, hr: deptA, hr2: deptB, sup2: deptB, admin: deptB, lone: deptC };
  for (const [key, dept] of Object.entries(inDept)) {
    await db.from('employees').update({ department_id: dept, work_pattern_id: patternId, created_at: at(daysAgo(20), '00:00') }).eq('id', id[key]);
  }
  siteX = (await db.from('sites').insert({ name_ar: 'موقع مهمة اختبار', name_en: 'Mission test site', latitude: 29.1, longitude: 48.1, radius_m: 200 })
    .select('id').single()).data.id;
});

beforeEach(async () => {
  const ids = Object.values(id);
  await db.from('attendance_days').delete().in('employee_id', ids);
  await db.from('attendance_punches').delete().in('employee_id', ids);
  await db.from('requests').delete().in('employee_id', ids);
});

after(async () => {
  const ids = Object.values(id);
  await db.from('attendance_days').delete().in('employee_id', ids);
  await db.from('attendance_punches').delete().in('employee_id', ids);
  await db.from('requests').delete().in('employee_id', ids);
  for (const a of Object.values(acc)) await a.remove();
  await db.from('departments').delete().in('id', [deptA, deptB, deptC]);
  await db.from('work_patterns').delete().eq('id', patternId);
  await db.from('sites').delete().eq('id', siteX);
});

test('the path is employee -> supervisor -> HR, and no stage can be skipped', async () => {
  const r = await correction();
  assert.equal(await statusOf(r), 'pending_supervisor');

  // HR and the admin cannot take the supervisor's turn; another department's supervisor cannot either.
  for (const who of ['hr', 'admin', 'sup2']) {
    const { error } = await decide(who, r, true);
    assert.ok(error, `${who} must not decide at the supervisor stage`);
  }
  assert.equal(await statusOf(r), 'pending_supervisor');

  assert.ifError((await decide('sup', r, true, 'تمام')).error);
  assert.equal(await statusOf(r), 'pending_hr');
  assert.ok((await decide('sup', r, true)).error, 'the supervisor cannot also give the final approval');
  assert.ok((await decide('admin', r, true)).error, 'the admin does not give the final approval for normal employees');

  const { data: final, error } = await decide('hr', r, true);
  assert.ifError(error);
  assert.equal(final, 'approved');
  assert.ok((await decide('hr2', r, true)).error, 'an approved request cannot be decided again');

  const { data: timeline } = await s.emp.rpc('request_timeline', { p_request: r });
  assert.deepEqual(timeline.map((t) => [t.stage, t.decision]), [['supervisor', 'approved'], ['hr', 'approved']]);
  assert.equal(timeline[0].note, 'تمام');
  assert.equal(timeline[0].approver_en, 'Test supervisor');
});

test('clients cannot write requests or approvals directly', async () => {
  const { error: insertError } = await s.emp.from('requests').insert({
    employee_id: id.emp, request_type: 'punch_correction', shift_date: daysAgo(1), corrected_punch_type: 'check_in',
    corrected_time: at(daysAgo(1), '07:30'), reason: 'direct', status: 'approved',
  });
  assert.ok(insertError);
  const r = await correction();
  await s.emp.from('requests').update({ status: 'approved' }).eq('id', r);
  await s.sup.from('requests').update({ status: 'approved' }).eq('id', r);
  const { error: apprError } = await s.sup.from('request_approvals').insert({ request_id: r, stage: 'hr', approver_id: id.sup, decision: 'approved' });
  assert.ok(apprError);
  assert.equal(await statusOf(r), 'pending_supervisor');
});

test('an approved check-in correction changes the record; a check-out correction completes it', async () => {
  const date = daysAgo(1);
  const before = await dayRecord('emp', date);
  assert.notEqual(before.arrival, 'on_time');

  const r1 = await correction('emp', 'check_in', '08:10'); // 10 minutes after the grace hour
  await decide('sup', r1, true);
  await decide('hr', r1, true);
  let day = await dayRecord('emp', date);
  assert.equal(day.arrival, 'late');
  assert.equal(day.late_minutes, 10);
  assert.equal(day.check_in_corrected, true);
  assert.equal(day.departure, 'missing'); // the check-out window of yesterday is closed

  const r2 = await correction('emp', 'check_out', '15:00');
  await decide('sup', r2, true);
  await decide('hr', r2, true);
  day = await dayRecord('emp', date);
  assert.equal(day.departure, 'done');
  assert.equal(day.check_out_corrected, true);
  assert.equal(day.early_leave_minutes, 0);

  const { data: punches } = await db.from('attendance_punches').select('source, request_id').eq('employee_id', id.emp);
  assert.deepEqual(punches.map((p) => p.source).sort(), ['correction', 'correction']);
  assert.ok(punches.every((p) => p.request_id));
});

test('a correction turns an absence into attendance', async () => {
  const date = daysAgo(2);
  await db.rpc('attendance_finalize', { p_at: new Date().toISOString() });
  assert.equal((await dayRecord('emp', date)).arrival, 'absent');
  const r = await correction('emp', 'check_in', '07:05', date);
  await decide('sup', r, true);
  await decide('hr', r, true);
  const day = await dayRecord('emp', date);
  assert.equal(day.arrival, 'on_time');
  assert.equal(day.departure, 'missing');
});

test('a rejection stops the request, and nothing changes in the record', async () => {
  const r = await correction();
  assert.ifError((await decide('sup', r, false, 'غير صحيح')).error);
  assert.equal(await statusOf(r), 'rejected');
  assert.ok((await decide('hr', r, true)).error);
  assert.ok((await s.emp.rpc('cancel_request', { p_request: r })).error, 'a decided request cannot be cancelled');
  assert.notEqual((await dayRecord('emp', daysAgo(1))).check_in_corrected, true);
});

test('the employee can cancel a pending request; it leaves the inbox', async () => {
  const r = await correction();
  let { data: inbox } = await s.sup.rpc('approval_inbox');
  assert.ok(inbox.some((x) => x.id === r));
  assert.ok((await s.sup.rpc('cancel_request', { p_request: r })).error, 'only the employee can cancel');
  assert.ifError((await s.emp.rpc('cancel_request', { p_request: r })).error);
  assert.equal(await statusOf(r), 'cancelled');
  ({ data: inbox } = await s.sup.rpc('approval_inbox'));
  assert.ok(!inbox.some((x) => x.id === r));
});

test('the inbox shows each approver only what they can decide', async () => {
  const r = await correction();
  const ids = async (who) => ((await s[who].rpc('approval_inbox')).data ?? []).map((x) => x.id);
  assert.ok((await ids('sup')).includes(r));
  for (const who of ['sup2', 'hr', 'hr2', 'admin', 'emp']) assert.ok(!(await ids(who)).includes(r), who);
  await decide('sup', r, true);
  assert.ok((await ids('hr')).includes(r));
  assert.ok((await ids('hr2')).includes(r));
  assert.ok(!(await ids('sup')).includes(r));
  const [row] = (await s.hr.rpc('approval_inbox')).data.filter((x) => x.id === r);
  assert.equal(row.file_number, 799930);
  assert.equal(row.department_en, 'E2E dept A');
});

test('department without a supervisor: the admin gives the first approval', async () => {
  const r = await correction('lone');
  assert.ok((await decide('sup', r, true)).error);
  assert.ok((await decide('sup2', r, true)).error);
  assert.ifError((await decide('admin', r, true)).error);
  assert.equal(await statusOf(r), 'pending_hr');
  assert.ifError((await decide('hr', r, true)).error);
  assert.equal(await statusOf(r), 'approved');
});

test('the supervisor\'s own request: the admin gives the first approval', async () => {
  const r = await correction('sup');
  assert.ok((await decide('sup', r, true)).error, 'nobody approves their own request');
  assert.ifError((await decide('admin', r, true)).error);
  assert.ifError((await decide('hr', r, true)).error);
  assert.equal(await statusOf(r), 'approved');
});

test('an HR employee\'s request: final approval by the admin only', async () => {
  const r = await correction('hr');
  assert.ifError((await decide('sup', r, true)).error);
  assert.ok((await decide('hr', r, true)).error, 'not on their own request');
  assert.ok((await decide('hr2', r, true)).error, 'not another HR either (owner decision)');
  assert.ifError((await decide('admin', r, true)).error);
  assert.equal(await statusOf(r), 'approved');
});

test('correction rules: last 7 days, inside the shift, not in the future, check-in first, no duplicates', async () => {
  const bad = async (args, code) => {
    const { error } = await submit('emp', { p_type: 'punch_correction', p_reason: 'سبب', ...args });
    assert.ok(error, code);
    assert.match(error.message, new RegExp(code));
  };
  const d1 = daysAgo(1);
  await bad({ p_shift_date: daysAgo(8), p_punch_type: 'check_in', p_time: at(daysAgo(8), '07:30') }, 'correction_too_old');
  await bad({ p_shift_date: d1, p_punch_type: 'check_in', p_time: at(d1, '05:00') }, 'time_outside_shift');
  await bad({ p_shift_date: d1, p_punch_type: 'check_out', p_time: at(d1, '17:00') }, 'time_outside_shift');
  await bad({ p_shift_date: d1, p_punch_type: 'check_out', p_time: at(d1, '15:00') }, 'check_in_first');
  await bad({ p_shift_date: d1, p_punch_type: 'check_in', p_time: at(d1, '07:30'), p_reason: 'x' }, 'reason_required');
  const tomorrow = kuwaitDate(new Date(Date.now() + 86_400_000));
  await bad({ p_shift_date: tomorrow, p_punch_type: 'check_in', p_time: at(tomorrow, '07:30') }, 'correction_too_old');
  await correction('emp', 'check_in', '07:30', d1);
  await bad({ p_shift_date: d1, p_punch_type: 'check_in', p_time: at(d1, '07:40') }, 'duplicate_request');
  // a check-out may follow a pending check-in correction
  await correction('emp', 'check_out', '15:00', d1);
  assert.ok(await correction('emp', 'check_in', '07:30', daysAgo(7)), 'seven days back is allowed');
});

test('missions: only a site not enabled, today to 30 days ahead; approval opens that site on that date only', async () => {
  const bad = async (args, code) => {
    const { error } = await submit('emp', { p_type: 'external_mission', p_reason: 'مهمة عمل', ...args });
    assert.match(error?.message ?? '', new RegExp(code));
  };
  await bad({ p_shift_date: daysAgo(1), p_site: siteX }, 'mission_date_out_of_range');
  await bad({ p_shift_date: kuwaitDate(new Date(Date.now() + 31 * 86_400_000)), p_site: siteX }, 'mission_date_out_of_range');
  await db.from('employee_sites').insert({ employee_id: id.emp, site_id: siteX });
  await bad({ p_shift_date: daysAgo(0), p_site: siteX }, 'site_already_enabled');
  await db.from('employee_sites').delete().eq('employee_id', id.emp);

  const today = daysAgo(0);
  const { data: r, error } = await submit('emp', { p_type: 'external_mission', p_shift_date: today, p_reason: 'مهمة عمل', p_site: siteX });
  assert.ifError(error);
  const near = async (on) => (await db.rpc('sites_near', { p_employee_id: id.emp, p_lat: 29.1, p_lng: 48.1, p_on: on })).data;
  assert.equal((await near(today)).length, 0, 'not before approval');
  await decide('sup', r, true);
  assert.equal((await near(today)).length, 0, 'not after the first approval only');
  await decide('hr', r, true);
  const allowed = await near(today);
  assert.equal(allowed.length, 1);
  assert.equal(allowed[0].by_mission, true);
  assert.equal((await near(kuwaitDate(new Date(Date.now() + 86_400_000)))).length, 0, 'only on the mission date');
  const { data: lone } = await db.rpc('sites_near', { p_employee_id: id.lone, p_lat: 29.1, p_lng: 48.1, p_on: today });
  assert.equal(lone.length, 0, 'only for that employee');
});

test('employees see only their own requests; staff see all', async () => {
  const r = await correction('emp');
  const { data: mine } = await s.lone.from('requests').select('id');
  assert.ok(!mine.some((x) => x.id === r));
  assert.ok((await s.lone.rpc('request_timeline', { p_request: r })).error);
  const { data: staff } = await s.sup2.from('requests').select('id');
  assert.ok(staff.some((x) => x.id === r));
});
