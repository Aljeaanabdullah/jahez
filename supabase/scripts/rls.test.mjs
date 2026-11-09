// Permission tests: sign in as each role and check what it can and cannot do.
// Needs `npm run demo:seed` first. Run with: npm run test:rls
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serviceClient, publicClient, signInAs, readCredentials, createTempAccount } from './lib.mjs';

const db = serviceClient();
const accounts = Object.values(readCredentials().accounts ?? {});
const byRole = (role) => accounts.filter((a) => a.role === role);

// A throw-away admin, so the tests never depend on the real admin's password.
let admin;
const supervisor = byRole('supervisor')[0];
const [employeeA, , , , hrCandidate] = byRole('employee');

const sessions = {};
let employeeARow;

const count = async (client, table) => {
  const { count: n, error } = await client.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return n;
};

before(async () => {
  assert.ok(supervisor && employeeA && hrCandidate, 'run `npm run demo:seed` first');
  admin = await createTempAccount(799911, 'admin');
  sessions.admin = await signInAs(admin.file_number, admin.password);
  sessions.supervisor = await signInAs(supervisor.file_number, supervisor.password);
  sessions.employee = await signInAs(employeeA.file_number, employeeA.password);
  ({ data: employeeARow } = await db.from('employees').select('id').eq('file_number', employeeA.file_number).single());
});

after(async () => {
  // Undo anything the tests changed.
  await db.from('employees').update({ role: 'employee' }).eq('file_number', hrCandidate.file_number);
  await db.from('consents').delete().eq('consent_version', 'test');
  await db.from('notifications').delete().eq('kind', 'test');
  await db.from('departments').delete().eq('name_en', 'RLS test department');
  await db.from('face_templates').delete().eq('model_version', 'test');
  await admin?.remove();
});

// ---------------------------------------------------------------- demo data
test('demo data: 3,500 employees numbered 710000-713499, no duplicates', async () => {
  // The API returns at most 1,000 rows per request, so read in pages.
  const numbers = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('employees').select('file_number')
      .eq('is_demo', true).order('file_number').range(from, from + 999);
    if (error) throw error;
    numbers.push(...data.map((r) => r.file_number));
    if (data.length < 1000) break;
  }
  assert.equal(numbers.length, 3500);
  assert.equal(new Set(numbers).size, 3500);
  assert.equal(Math.min(...numbers), 710000);
  assert.equal(Math.max(...numbers), 713499);
});

test('demo data: 735043 is the system admin', async () => {
  const { data } = await db.from('employees').select('role').eq('file_number', 735043).single();
  assert.equal(data.role, 'admin');
});

test('demo data: every department has a supervisor and every employee has a site', async () => {
  const { data: deps } = await db.from('departments').select('supervisor_id').eq('is_demo', true);
  assert.equal(deps.length, 8);
  assert.ok(deps.every((d) => d.supervisor_id));
  const { count: withSite, error } = await db
    .from('employees').select('id, employee_sites!inner(site_id)', { count: 'exact', head: true })
    .eq('is_demo', true);
  if (error) throw error;
  assert.equal(withSite, 3500);
});

// ---------------------------------------------------------------- anonymous
test('anonymous: sees no employees', async () => {
  const { data, error } = await publicClient().from('employees').select('id').limit(1);
  assert.ok(error || data.length === 0);
});

// ---------------------------------------------------------------- employee
test('employee: sees only own employee row', async () => {
  const { data } = await sessions.employee.from('employees').select('file_number');
  assert.deepEqual(data.map((r) => r.file_number), [employeeA.file_number]);
});

test('employee: sees only own punches and own sites', async () => {
  const { data: punches } = await sessions.employee.from('attendance_punches').select('employee_id');
  assert.ok(punches.length > 0, 'expected demo punches for this employee');
  assert.ok(punches.every((p) => p.employee_id === employeeARow.id));
  const { data: sites } = await sessions.employee.from('employee_sites').select('employee_id');
  assert.ok(sites.length > 0 && sites.every((s) => s.employee_id === employeeARow.id));
});

test('employee: cannot write a punch', async () => {
  const { error } = await sessions.employee.from('attendance_punches').insert({
    employee_id: employeeARow.id, punch_type: 'check_in', shift_date: '2026-11-09', result: 'accepted',
  });
  assert.ok(error, 'insert should be refused');
});

test('employee: cannot change organisation data', async () => {
  const { error } = await sessions.employee.from('departments').insert({ name_ar: 'x', name_en: 'RLS test department' });
  assert.ok(error);
});

test('employee: can record own consent, not someone else\'s', async () => {
  const own = await sessions.employee.from('consents').insert({ employee_id: employeeARow.id, consent_version: 'test' });
  assert.equal(own.error, null);
  const { data: other } = await db.from('employees').select('id').eq('file_number', 710100).single();
  const theirs = await sessions.employee.from('consents').insert({ employee_id: other.id, consent_version: 'test' });
  assert.ok(theirs.error);
});

test('employee: can mark own notification read but not edit its text', async () => {
  const { data: n } = await db.from('notifications')
    .insert({ employee_id: employeeARow.id, kind: 'test', title_ar: 'اختبار', title_en: 'test' })
    .select('id').single();
  const read = await sessions.employee.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
  assert.equal(read.error, null);
  const edit = await sessions.employee.from('notifications').update({ title_en: 'changed' }).eq('id', n.id);
  assert.ok(edit.error);
});

test('employee: cannot run the demo seed', async () => {
  const { error } = await sessions.employee.rpc('demo_seed');
  assert.ok(error);
});

// ---------------------------------------------------------------- supervisor
test('supervisor: sees all employees and all punches', async () => {
  assert.equal(await count(sessions.supervisor, 'employees'), await count(db, 'employees'));
  assert.equal(await count(sessions.supervisor, 'attendance_punches'), await count(db, 'attendance_punches'));
});

test('supervisor: cannot change organisation data or read the audit log', async () => {
  const { error } = await sessions.supervisor.from('sites').update({ radius_m: 999 }).eq('is_demo', true).select();
  const { data: sites } = await db.from('sites').select('radius_m').eq('is_demo', true);
  assert.ok(error || sites.every((s) => s.radius_m === 200));
  assert.equal(await count(sessions.supervisor, 'audit_log'), 0);
});

// ---------------------------------------------------------------- hr
test('hr: admin can make an employee HR; HR reads everything but cannot change organisation', async () => {
  const promote = await sessions.admin.from('employees').update({ role: 'hr' }).eq('file_number', hrCandidate.file_number);
  assert.equal(promote.error, null);
  const hr = await signInAs(hrCandidate.file_number, hrCandidate.password);
  assert.equal(await count(hr, 'employees'), await count(db, 'employees'));
  const { error } = await hr.from('departments').insert({ name_ar: 'x', name_en: 'RLS test department' });
  assert.ok(error);
});

// ---------------------------------------------------------------- admin
test('admin: can change organisation data and read the audit log', async () => {
  const { error } = await sessions.admin.from('departments').insert({ name_ar: 'قسم اختبار', name_en: 'RLS test department' });
  assert.equal(error, null);
  assert.ok((await count(sessions.admin, 'audit_log')) > 0);
});

// ---------------------------------------------------------------- face data
test('face templates: only admin sees enrollment details, and nobody reads the embedding', async () => {
  const { error: seedError } = await db.from('face_templates').insert({
    employee_id: employeeARow.id, embedding: [0.1, 0.2, 0.3], model_version: 'test', source: 'web',
    photo_paths: [`${employeeARow.id}/test.jpg`],
  });
  assert.equal(seedError, null);

  for (const role of ['employee', 'supervisor']) {
    const { data, error } = await sessions[role].from('face_templates').select('id').limit(1);
    assert.ok(error || data.length === 0, `${role} must not see face templates`);
  }

  const details = await sessions.admin.from('face_templates')
    .select('employee_id, source, enrolled_at, photo_paths').eq('model_version', 'test');
  assert.equal(details.error, null);
  assert.equal(details.data.length, 1);

  const embedding = await sessions.admin.from('face_templates').select('embedding').limit(1);
  assert.ok(embedding.error, 'admin must not read the embedding');
});

test('enrollment photos: admin can open them, supervisor and employee cannot', async () => {
  const path = `${employeeARow.id}/test.jpg`;
  const jpeg = new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
  const upload = await db.storage.from('face-enrollment-photos').upload(path, jpeg, { upsert: true });
  assert.equal(upload.error, null);
  try {
    const asAdmin = await sessions.admin.storage.from('face-enrollment-photos').download(path);
    assert.equal(asAdmin.error, null);
    for (const role of ['supervisor', 'employee']) {
      const denied = await sessions[role].storage.from('face-enrollment-photos').download(path);
      assert.ok(denied.error, `${role} must not open enrollment photos`);
    }
  } finally {
    await db.storage.from('face-enrollment-photos').remove([path]);
  }
});

test('punch photos: supervisors and admin can open them, employees cannot', async () => {
  const path = `${employeeARow.id}/test-punch.jpg`;
  const jpeg = new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
  const upload = await db.storage.from('punch-photos').upload(path, jpeg, { upsert: true });
  assert.equal(upload.error, null);
  try {
    for (const role of ['supervisor', 'admin']) {
      const allowed = await sessions[role].storage.from('punch-photos').download(path);
      assert.equal(allowed.error, null, `${role} should open punch photos`);
    }
    const denied = await sessions.employee.storage.from('punch-photos').download(path);
    assert.ok(denied.error);
  } finally {
    await db.storage.from('punch-photos').remove([path]);
  }
});
