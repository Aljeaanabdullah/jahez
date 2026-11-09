// Phase 5 tests: consent and face enrollment rules (enroll-face Edge Function).
// Uses made-up descriptors: these tests check the rules, not face recognition itself.
// Run with: npm run test:enroll
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serviceClient, signInAs, createTempAccount, SUPABASE_URL, PUBLISHABLE_KEY } from './lib.mjs';

const db = serviceClient();
const MODEL = 'dlib-resnet-v1/align-v1';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0xff, 0xd9]).toString('base64');
const accounts = {};
const sessions = {};
const ids = {};

// A "face": a fixed random direction; photos of the same face add tiny noise.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
const face = () => Array.from({ length: 128 }, () => rand() * 0.2);
const photoOf = (f, noise = 0.005) => f.map((v) => v + rand() * noise);

async function enroll(session, body) {
  const { data } = await session.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/enroll-face`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'web', model_version: MODEL, photos: [JPEG, JPEG, JPEG], ...body }),
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  accounts.hr = await createTempAccount(799913, 'hr');
  accounts.admin = await createTempAccount(799914, 'admin');
  accounts.a = await createTempAccount(799915, 'employee');
  accounts.b = await createTempAccount(799916, 'employee');
  for (const [k, a] of Object.entries(accounts)) {
    sessions[k] = await signInAs(a.file_number, a.password);
    const { data } = await db.from('employees').select('id').eq('file_number', a.file_number).single();
    ids[k] = data.id;
  }
});

after(async () => {
  for (const k of ['a', 'b']) {
    const { data: files } = await db.storage.from('face-enrollment-photos').list(ids[k]);
    if (files?.length) await db.storage.from('face-enrollment-photos').remove(files.map((f) => `${ids[k]}/${f.name}`));
  }
  for (const a of Object.values(accounts)) await a.remove();
});

test('consent: an employee records their own consent in the app', async () => {
  const { error } = await sessions.a.from('consents').insert({ employee_id: ids.a, consent_version: 'v1' });
  assert.equal(error, null);
});

test('only HR can enroll faces (admin is refused)', async () => {
  const f = face();
  const res = await enroll(sessions.admin, { employee_id: ids.a, descriptors: [photoOf(f), photoOf(f), photoOf(f)] });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'hr_only');
});

test('enrollment needs the employee\'s consent first', async () => {
  const f = face();
  const res = await enroll(sessions.hr, { employee_id: ids.b, descriptors: [photoOf(f), photoOf(f), photoOf(f)] });
  assert.equal(res.body.error, 'no_consent');
});

test('the three photos must be the same person, valid, and from the current model', async () => {
  const notSame = await enroll(sessions.hr, { employee_id: ids.a, descriptors: [face(), face(), face()] });
  assert.equal(notSame.body.error, 'photos_not_same_person');
  const f = face();
  const badPhoto = await enroll(sessions.hr, { employee_id: ids.a, descriptors: [f, f, f], photos: [JPEG, JPEG, 'aGVsbG8='] });
  assert.equal(badPhoto.body.error, 'invalid_photos');
  const oldModel = await enroll(sessions.hr, { employee_id: ids.a, descriptors: [f, f, f], model_version: 'other' });
  assert.equal(oldModel.body.error, 'wrong_model_version');
  const short = await enroll(sessions.hr, { employee_id: ids.a, descriptors: [[1, 2], f, f] });
  assert.equal(short.body.error, 'invalid_descriptors');
});

let faceA;
test('HR enrolls a face; HR sees the status but never the descriptor', async () => {
  faceA = face();
  const res = await enroll(sessions.hr, { employee_id: ids.a, descriptors: [photoOf(faceA), photoOf(faceA), photoOf(faceA)] });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const { data: status, error } = await sessions.hr.rpc('face_enrollment_status', { p_employee_id: ids.a });
  assert.equal(error, null);
  assert.equal(status[0].enrolled, true);
  assert.equal(status[0].has_consent, true);
  assert.equal(status[0].source, 'web');

  const embedding = await sessions.hr.from('face_templates').select('embedding');
  assert.ok(embedding.error || embedding.data.length === 0, 'HR must not read the descriptor');

  const { data: files } = await db.storage.from('face-enrollment-photos').list(ids.a);
  assert.equal(files.length, 3);
});

test('employees cannot ask for enrollment status', async () => {
  const { error } = await sessions.a.rpc('face_enrollment_status', { p_employee_id: ids.a });
  assert.ok(error);
});

test('re-enrollment replaces the template and the old photos', async () => {
  const { data: before } = await db.from('face_templates').select('photo_paths').eq('employee_id', ids.a).single();
  await new Promise((r) => setTimeout(r, 5));
  const res = await enroll(sessions.hr, {
    employee_id: ids.a,
    source: 'mobile',
    descriptors: [photoOf(faceA), photoOf(faceA), photoOf(faceA)],
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { data: after } = await db.from('face_templates').select('photo_paths, source').eq('employee_id', ids.a).single();
  assert.equal(after.source, 'mobile');
  assert.notDeepEqual(after.photo_paths, before.photo_paths);
  const { data: files } = await db.storage.from('face-enrollment-photos').list(ids.a);
  assert.deepEqual(files.map((f) => `${ids.a}/${f.name}`).sort(), [...after.photo_paths].sort());
});

test('the same face cannot be enrolled under another file number', async () => {
  await db.from('consents').insert({ employee_id: ids.b, consent_version: 'v1' });
  const res = await enroll(sessions.hr, { employee_id: ids.b, descriptors: [photoOf(faceA), photoOf(faceA), photoOf(faceA)] });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'face_already_enrolled');
  assert.equal(res.body.file_number, accounts.a.file_number);
});
