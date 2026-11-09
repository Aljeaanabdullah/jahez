// Phase 2 tests: password change rules and one-phone binding.
// Needs `npm run demo:seed` first. Run with: npm run test:auth
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { serviceClient, signInAs, readCredentials, writeCredentials, createTempAccount, SUPABASE_URL, PUBLISHABLE_KEY } from './lib.mjs';

const db = serviceClient();
const credentials = readCredentials();
const employees = Object.values(credentials.accounts ?? {}).filter((a) => a.role === 'employee');
// Use the 2nd and 3rd test employees so the permission tests' employee stays untouched.
const [, userB, userC] = employees;

const ids = {};
const sessions = {};
const PHONE_1 = 'test-device-' + randomBytes(6).toString('hex');
const PHONE_2 = 'test-device-' + randomBytes(6).toString('hex');

async function callChangePassword(session, newPassword) {
  const { data } = await session.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/change-password`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      apikey: PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ new_password: newPassword }),
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  assert.ok(userB && userC, 'run `npm run demo:seed` first');
  for (const u of [userB, userC]) {
    const { data } = await db.from('employees').select('id').eq('file_number', u.file_number).single();
    ids[u.file_number] = data.id;
  }
  sessions.B = await signInAs(userB.file_number, userB.password);
  sessions.C = await signInAs(userC.file_number, userC.password);
});

after(async () => {
  await db.from('devices').delete().in('employee_id', Object.values(ids));
  await db.from('employees').update({ must_change_password: true }).in('id', Object.values(ids));
});

// ---------------------------------------------------------------- password
test('new accounts must change their password', async () => {
  const { data } = await sessions.B.from('employees').select('must_change_password').single();
  assert.equal(data.must_change_password, true);
});

test('password change: weak passwords are refused with a clear reason', async () => {
  const cases = [
    ['abc12', 'too_short'],
    ['abcdefgh', 'needs_digit'],
    ['12345678', 'needs_letter'],
    [`a${userB.file_number}x`, 'contains_file_number'],
  ];
  for (const [password, reason] of cases) {
    const res = await callChangePassword(sessions.B, password);
    assert.equal(res.status, 400, password);
    assert.equal(res.body.error, reason, password);
  }
});

test('password change: a good password works, clears the flag, and the new password signs in', async () => {
  const newPassword = 'Jz' + randomBytes(6).toString('hex') + '7';
  const res = await callChangePassword(sessions.B, newPassword);
  assert.equal(res.status, 200, JSON.stringify(res.body));

  credentials.accounts[userB.file_number].password = newPassword;
  writeCredentials(credentials);

  const fresh = await signInAs(userB.file_number, newPassword);
  const { data } = await fresh.from('employees').select('must_change_password').single();
  assert.equal(data.must_change_password, false);
});

test('password change: refused without signing in', async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/change-password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_password: 'Abcdefg123' }),
  });
  assert.equal(res.status, 401);
});

// ---------------------------------------------------------------- devices
test('device: first phone is bound, the same phone is accepted again', async () => {
  const first = await sessions.C.rpc('bind_device', { p_device_identifier: PHONE_1, p_platform: 'android', p_model: 'Test' });
  assert.equal(first.error, null);
  assert.equal(first.data, 'bound');
  const again = await sessions.C.rpc('bind_device', { p_device_identifier: PHONE_1, p_platform: 'android' });
  assert.equal(again.data, 'ok');
});

test('device: a different phone for the same employee is refused', async () => {
  const other = await sessions.C.rpc('bind_device', { p_device_identifier: PHONE_2, p_platform: 'ios' });
  assert.equal(other.data, 'other_device');
});

test('device: a phone bound to one employee cannot be used by another', async () => {
  const taken = await sessions.B.rpc('bind_device', { p_device_identifier: PHONE_1, p_platform: 'android' });
  assert.equal(taken.data, 'device_taken');
});

test('device: after the admin unbinds, a new phone can be bound', async () => {
  const admin = await createTempAccount(799912, 'admin');
  try {
    const adminSession = await signInAs(admin.file_number, admin.password);
    const unbind = await adminSession.from('devices').delete().eq('employee_id', ids[userC.file_number]);
    assert.equal(unbind.error, null);
  } finally {
    await admin.remove();
  }
  const rebound = await sessions.C.rpc('bind_device', { p_device_identifier: PHONE_2, p_platform: 'ios' });
  assert.equal(rebound.data, 'bound');
});

test('device: bad input is refused', async () => {
  const { error } = await sessions.B.rpc('bind_device', { p_device_identifier: 'short', p_platform: 'android' });
  assert.ok(error);
  const { error: platformError } = await sessions.B.rpc('bind_device', { p_device_identifier: PHONE_2 + 'x', p_platform: 'windows' });
  assert.ok(platformError);
});
