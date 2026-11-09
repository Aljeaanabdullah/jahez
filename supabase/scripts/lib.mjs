// Shared helpers for the Supabase scripts. Reads keys from apps/admin/.env.local.
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(here, '../../apps/admin/.env.local');
export const credentialsFile = path.join(here, '.demo-credentials.json');

if (existsSync(envFile)) process.loadEnvFile(envFile);

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

export function requireEnv({ secret = false } = {}) {
  const missing = [];
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!PUBLISHABLE_KEY) missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  if (secret && !SECRET_KEY) missing.push('SUPABASE_SECRET_KEY');
  if (missing.length) {
    throw new Error(`Missing in apps/admin/.env.local: ${missing.join(', ')}`);
  }
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Server-side client that bypasses RLS. Never ship this key to a browser or phone. */
export function serviceClient() {
  requireEnv({ secret: true });
  return createClient(SUPABASE_URL, SECRET_KEY, noSession);
}

/** A client acting as a normal signed-out user. */
export function publicClient() {
  requireEnv();
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, noSession);
}

/** Internal login e-mail for a file number. Users only ever type the file number. */
export const emailFor = (fileNumber) => `${fileNumber}@jahez.local`;

export async function signInAs(fileNumber, password) {
  const client = publicClient();
  const { error } = await client.auth.signInWithPassword({ email: emailFor(fileNumber), password });
  if (error) throw new Error(`Sign-in failed for ${fileNumber}: ${error.message}`);
  return client;
}

/**
 * Creates a throw-away account for a test (random password, kept in memory only)
 * and returns it with a remove() function. Tests use this instead of the real admin.
 */
export async function createTempAccount(fileNumber, role) {
  const { randomBytes } = await import('node:crypto');
  const db = serviceClient();
  await removeAccount(db, fileNumber);
  const password = `T${randomBytes(9).toString('base64url')}7`;
  const { data, error } = await db.auth.admin.createUser({ email: emailFor(fileNumber), password, email_confirm: true });
  if (error) throw new Error(`createUser ${fileNumber}: ${error.message}`);
  const { error: rowError } = await db.from('employees').insert({
    file_number: fileNumber,
    user_id: data.user.id,
    full_name_ar: `حساب اختبار ${role}`,
    full_name_en: `Test ${role}`,
    role,
    must_change_password: false,
    is_demo: false, // not counted as demo data; removed by remove()
  });
  if (rowError) throw new Error(`employee ${fileNumber}: ${rowError.message}`);
  return { file_number: fileNumber, role, password, remove: () => removeAccount(db, fileNumber) };
}

async function removeAccount(db, fileNumber) {
  const { data: row } = await db.from('employees').select('id, user_id').eq('file_number', fileNumber).maybeSingle();
  if (row) {
    await db.from('employees').delete().eq('id', row.id);
    if (row.user_id) await db.auth.admin.deleteUser(row.user_id);
  }
}

export function readCredentials() {
  if (!existsSync(credentialsFile)) return {};
  return JSON.parse(readFileSync(credentialsFile, 'utf8'));
}

export function writeCredentials(data) {
  writeFileSync(credentialsFile, JSON.stringify(data, null, 2) + '\n');
}
