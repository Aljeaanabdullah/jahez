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

export function readCredentials() {
  if (!existsSync(credentialsFile)) return {};
  return JSON.parse(readFileSync(credentialsFile, 'utf8'));
}

export function writeCredentials(data) {
  writeFileSync(credentialsFile, JSON.stringify(data, null, 2) + '\n');
}
