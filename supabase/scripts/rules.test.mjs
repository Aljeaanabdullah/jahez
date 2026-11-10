// Phase 7 tests: the work rules engine (PRD section 6). Times are simulated in October 2026
// (in the past), so every edge case runs without waiting for real time.
// Run with: npm run test:rules
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { serviceClient, signInAs, createTempAccount } from './lib.mjs';

const db = serviceClient();
const k = (s) => `${s}:00+03:00`; // Kuwait wall-clock time -> ISO
const HOLIDAY = '2026-10-20';     // a Tuesday, temporary
const ROT_HOLIDAY = '2026-10-04'; // a rotation work day, temporary

let me, other, hr, meSession, otherSession, hrSession, meId;
const patterns = {};

async function makePattern(key, row) {
  const { data, error } = await db.from('work_patterns').insert({ ...row, name_ar: `اختبار ${key}`, name_en: `Test ${key}` })
    .select('id').single();
  if (error) throw error;
  patterns[key] = data.id;
}

async function usePattern(key, cycleStart = null) {
  await db.from('employees').update({ work_pattern_id: patterns[key], cycle_start_date: cycleStart }).eq('id', meId);
}

async function slot(at) {
  const { data, error } = await db.rpc('punch_slot', { p_employee: meId, p_at: k(at) });
  if (error) throw error;
  return data[0];
}

/** Same steps as the punch function: ask for the slot, save an accepted punch, apply it. */
async function punchAt(at, expectedType) {
  const s = await slot(at);
  assert.equal(s.punch_type, expectedType, `${at}: ${JSON.stringify(s)}`);
  const { data: p, error } = await db.from('attendance_punches').insert({
    employee_id: meId, punch_type: s.punch_type, punched_at: k(at), shift_date: s.shift_date, result: 'accepted',
  }).select('id').single();
  if (error) throw error;
  const { error: applyError } = await db.rpc('attendance_apply_punch', { p_punch_id: p.id, p_shift_start: s.shift_start });
  if (applyError) throw applyError;
  return s;
}

async function dayOf(shiftDate) {
  const { data } = await db.from('attendance_days').select('*').eq('employee_id', meId).eq('shift_date', shiftDate);
  return data;
}

async function history(session, from, to, employee = meId) {
  return session.rpc('attendance_history', { p_employee: employee, p_from: from, p_to: to });
}

before(async () => {
  me = await createTempAccount(799919, 'employee');
  other = await createTempAccount(799920, 'employee');
  hr = await createTempAccount(799921, 'hr');
  meSession = await signInAs(me.file_number, me.password);
  otherSession = await signInAs(other.file_number, other.password);
  hrSession = await signInAs(hr.file_number, hr.password);
  ({ data: { id: meId } } = await db.from('employees').select('id').eq('file_number', 799919).single());
  // Pretend the employee joined before the test month, so absences count.
  await db.from('employees').update({ created_at: '2026-09-01T00:00:00+03:00' }).eq('id', meId);

  await makePattern('morning', { kind: 'morning', shift_start: '07:00', shift_duration: '8 hours', weekly_off_days: [5, 6] });
  await makePattern('evening', { kind: 'evening', shift_start: '22:00', shift_duration: '8 hours', weekly_off_days: [5, 6] });
  await makePattern('late_night', { kind: 'evening', shift_start: '23:59', shift_duration: '8 hours', weekly_off_days: [5, 6] });
  await makePattern('afternoon', { kind: 'afternoon', shift_start: '14:00', shift_duration: '8 hours', weekly_off_days: [5, 6] });
  await makePattern('one_two', { kind: 'one_on_two_off', shift_start: '07:00', shift_duration: '24 hours', cycle_work_days: 1, cycle_off_days: 2 });
  await makePattern('two_four', { kind: 'two_on_four_off', shift_start: '07:00', shift_duration: '48 hours', cycle_work_days: 2, cycle_off_days: 4 });
  for (const d of [HOLIDAY, ROT_HOLIDAY]) {
    const { error } = await db.from('public_holidays').insert({ holiday_date: d, name_ar: 'عطلة اختبار', name_en: 'Test holiday' });
    if (error) throw error;
  }
});

beforeEach(async () => {
  await db.from('attendance_days').delete().eq('employee_id', meId);
  await db.from('attendance_punches').delete().eq('employee_id', meId);
});

after(async () => {
  await db.from('attendance_days').delete().eq('employee_id', meId);
  await db.from('attendance_punches').delete().eq('employee_id', meId);
  await me.remove();
  await other.remove();
  await hr.remove();
  await db.from('work_patterns').delete().in('id', Object.values(patterns));
  await db.from('public_holidays').delete().in('holiday_date', [HOLIDAY, ROT_HOLIDAY]);
});

test('check-in opens exactly 1 hour before the shift', async () => {
  await usePattern('morning');
  assert.equal((await slot('2026-10-12T05:59')).reason, 'no_shift_now');
  const s = await slot('2026-10-12T06:00');
  assert.equal(s.punch_type, 'check_in');
  assert.equal(s.shift_date, '2026-10-12');
});

test('grace hour: minute 59 is on time, minute 61 is 1 minute late', async () => {
  await usePattern('morning');
  await punchAt('2026-10-12T07:59', 'check_in');
  let [d] = await dayOf('2026-10-12');
  assert.equal(d.arrival, 'on_time');
  assert.equal(d.late_minutes, 0);

  await punchAt('2026-10-13T08:01', 'check_in');
  [d] = await dayOf('2026-10-13');
  assert.equal(d.arrival, 'late');
  assert.equal(d.late_minutes, 1);

  await punchAt('2026-10-14T09:30', 'check_in');
  [d] = await dayOf('2026-10-14');
  assert.equal(d.late_minutes, 90);
});

test('early leave is recorded in minutes; a second check-out is refused', async () => {
  await usePattern('morning');
  await punchAt('2026-10-12T07:00', 'check_in');
  await punchAt('2026-10-12T12:00', 'check_out');
  const [d] = await dayOf('2026-10-12');
  assert.equal(d.departure, 'done');
  assert.equal(d.early_leave_minutes, 180); // shift ends 15:00
  assert.equal((await slot('2026-10-12T15:30')).reason, 'already_checked_out');
});

test('check-out is allowed until 1 hour after the shift, then it is a missing check-out', async () => {
  await usePattern('morning');
  await punchAt('2026-10-12T07:00', 'check_in');
  assert.equal((await slot('2026-10-12T16:00')).punch_type, 'check_out');
  assert.equal((await slot('2026-10-12T16:01')).reason, 'no_shift_now');
  await db.rpc('attendance_finalize', { p_at: k('2026-10-12T16:10') });
  const [d] = await dayOf('2026-10-12');
  assert.equal(d.departure, 'missing');
  assert.equal(d.arrival, 'on_time');
});

test('no check-in by the end of the shift = absent; after that check-in is closed', async () => {
  await usePattern('morning');
  assert.equal((await slot('2026-10-15T14:59')).punch_type, 'check_in');
  assert.equal((await slot('2026-10-15T15:30')).reason, 'checkin_window_closed');
  const { data: r1 } = await db.rpc('attendance_finalize', { p_at: k('2026-10-15T15:10') });
  assert.ok(r1.absent >= 1);
  const [d] = await dayOf('2026-10-15');
  assert.equal(d.arrival, 'absent');
  assert.equal(d.departure, 'not_applicable');
  // Running again changes nothing.
  await db.rpc('attendance_finalize', { p_at: k('2026-10-15T15:20') });
  assert.equal((await dayOf('2026-10-15')).length, 1);
});

test('weekend days and public holidays are not work days for fixed patterns', async () => {
  await usePattern('morning');
  assert.equal((await slot('2026-10-16T07:30')).reason, 'no_shift_now'); // Friday
  assert.equal((await slot(`${HOLIDAY}T07:30`)).reason, 'no_shift_now'); // holiday
  await db.rpc('attendance_finalize', { p_at: k('2026-10-21T00:00') });
  assert.equal((await dayOf('2026-10-16')).length, 0);
  assert.equal((await dayOf(HOLIDAY)).length, 0);
  const { data } = await history(meSession, '2026-10-16', '2026-10-20');
  assert.deepEqual(data.map((r) => r.kind), ['off', 'off', 'work', 'work', 'holiday']);
});

test('a shift crossing midnight is one shift with one check-in and one check-out', async () => {
  await usePattern('evening');
  const inSlot = await punchAt('2026-10-12T22:10', 'check_in');
  assert.equal(inSlot.shift_date, '2026-10-12');
  const outSlot = await punchAt('2026-10-13T05:50', 'check_out');
  assert.equal(outSlot.shift_date, '2026-10-12');
  const [d] = await dayOf('2026-10-12');
  assert.equal(d.early_leave_minutes, 10);
  assert.equal(d.late_minutes, 0);
});

test('a 48-hour shift: one check-in, check-out two days later', async () => {
  await usePattern('two_four', '2026-10-12');
  await punchAt('2026-10-12T07:30', 'check_in');
  assert.equal((await slot('2026-10-13T12:00')).punch_type, 'check_out'); // still the same shift
  await punchAt('2026-10-14T07:20', 'check_out');
  const days = await dayOf('2026-10-12');
  assert.equal(days.length, 1);
  assert.equal(days[0].early_leave_minutes, 0);
  assert.equal(days[0].departure, 'done');
  const { data } = await history(meSession, '2026-10-12', '2026-10-19');
  assert.deepEqual(data.map((r) => r.kind), ['work', 'continued', 'continued', 'off', 'off', 'off', 'work', 'continued']);
});

test('rotation cycles over a whole month, working on public holidays', async () => {
  await usePattern('one_two', '2026-10-01');
  let { data } = await history(meSession, '2026-10-01', '2026-10-31');
  const work = data.filter((r) => r.kind === 'work').map((r) => r.day.slice(8));
  assert.deepEqual(work, ['01', '04', '07', '10', '13', '16', '19', '22', '25', '28', '31']);
  assert.ok(work.includes(ROT_HOLIDAY.slice(8)), 'rotation staff work on holidays');

  await usePattern('two_four', '2026-10-01');
  ({ data } = await history(meSession, '2026-10-01', '2026-10-31'));
  assert.deepEqual(data.filter((r) => r.kind === 'work').map((r) => r.day.slice(8)), ['01', '07', '13', '19', '25', '31']);
});

test('work days before the employee was added are not absences', async () => {
  await usePattern('morning');
  await db.from('employees').update({ created_at: '2026-10-14T12:00:00+03:00' }).eq('id', meId);
  try {
    await db.rpc('attendance_finalize', { p_at: k('2026-10-15T16:00') });
    assert.equal((await dayOf('2026-10-13')).length, 0);
    assert.equal((await dayOf('2026-10-15'))[0].arrival, 'absent');
    const { data } = await history(meSession, '2026-10-13', '2026-10-15');
    assert.deepEqual(data.map((r) => [r.kind, r.arrival]), [['before_hire', null], ['before_hire', null], ['work', 'absent']]);
  } finally {
    await db.from('employees').update({ created_at: '2026-09-01T00:00:00+03:00' }).eq('id', meId);
  }
});

test('a shift starting one minute before midnight belongs to the day it starts', async () => {
  await usePattern('late_night');
  const s = await punchAt('2026-10-12T23:00', 'check_in'); // check-in opens 22:59
  assert.equal(s.shift_date, '2026-10-12');
  const late = await slot('2026-10-14T01:00'); // Wednesday's shift started Tuesday 23:59, 61 minutes ago
  assert.equal(late.shift_date, '2026-10-13');
  await punchAt('2026-10-14T01:00', 'check_in');
  const [d] = await dayOf('2026-10-13');
  assert.equal(d.late_minutes, 1); // grace ends 00:59
  await punchAt('2026-10-13T07:59', 'check_out');
  const [first] = await dayOf('2026-10-12');
  assert.equal(first.early_leave_minutes, 0);
  assert.equal(first.departure, 'done');
});

test('a public holiday in the middle of a 48-hour shift does not break it', async () => {
  await usePattern('two_four', '2026-10-19'); // shift Mon 19th 07:00 -> Wed 21st 07:00; Tue 20th is a holiday
  await punchAt('2026-10-19T07:10', 'check_in');
  assert.equal((await slot(`${HOLIDAY}T12:00`)).punch_type, 'check_out');
  await punchAt('2026-10-21T07:00', 'check_out');
  await db.rpc('attendance_finalize', { p_at: k('2026-10-21T09:00') });
  const days = await db.from('attendance_days').select('shift_date, arrival, departure').eq('employee_id', meId);
  assert.deepEqual(days.data, [{ shift_date: '2026-10-19', arrival: 'on_time', departure: 'done' }]);
  const { data } = await history(meSession, '2026-10-19', '2026-10-21');
  assert.deepEqual(data.map((r) => r.kind), ['work', 'continued', 'continued']);
});

test('fixed patterns over a whole month: Sunday to Thursday, minus public holidays', async () => {
  // October 2026: 21 days from Sunday to Thursday, minus the two test holidays (Sun 4th, Tue 20th).
  // The evening shift of Monday 19th runs into the holiday morning, so the 20th shows as "continued".
  for (const [key, holidays] of [['morning', 2], ['afternoon', 2], ['evening', 1]]) {
    await usePattern(key);
    const { data } = await history(meSession, '2026-10-01', '2026-10-31');
    assert.equal(data.filter((r) => r.kind === 'work').length, 19, key);
    assert.equal(data.filter((r) => r.kind === 'holiday').length, holidays, key);
  }
});

test('no work pattern: punching is refused with a clear reason', async () => {
  await db.from('employees').update({ work_pattern_id: null }).eq('id', meId);
  assert.equal((await slot('2026-10-12T07:00')).reason, 'no_work_pattern');
});

test('history: own record and staff only; the table is read-only for clients', async () => {
  await usePattern('morning');
  assert.ok((await history(meSession, '2026-10-01', '2026-10-31')).data.length === 31);
  assert.ok((await history(otherSession, '2026-10-01', '2026-10-31')).error, 'another employee is refused');
  assert.equal((await history(hrSession, '2026-10-01', '2026-10-31')).data.length, 31);

  await punchAt('2026-10-12T07:00', 'check_in');
  const { data: seenByOther } = await otherSession.from('attendance_days').select('id').eq('employee_id', meId);
  assert.equal(seenByOther.length, 0);
  const { data: seenByMe } = await meSession.from('attendance_days').select('id');
  assert.equal(seenByMe.length, 1);
  await meSession.from('attendance_days').update({ late_minutes: 999 }).eq('employee_id', meId);
  await meSession.from('attendance_days').delete().eq('employee_id', meId);
  const { data: still } = await db.from('attendance_days').select('late_minutes').eq('employee_id', meId);
  assert.deepEqual(still.map((r) => r.late_minutes), [0], 'employees cannot change or delete their record');
  for (const fn of ['punch_slot', 'attendance_finalize']) {
    const { error: e } = await meSession.rpc(fn, fn === 'punch_slot' ? { p_employee: meId, p_at: k('2026-10-12T07:00') } : {});
    assert.ok(e, `${fn} must be server-only`);
  }
});
