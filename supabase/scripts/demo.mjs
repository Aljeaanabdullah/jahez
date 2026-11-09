// Demo data: one command to create it, one command to remove it.
//   npm run demo:seed   -> 3,500 dummy employees + test log-in accounts
//   npm run demo:reset  -> removes all demo data and demo log-ins (keeps admin 735043)
// Passwords are written to .demo-credentials.json (git-ignored), never printed.
import { randomBytes } from 'node:crypto';
import { serviceClient, emailFor, readCredentials, writeCredentials, credentialsFile } from './lib.mjs';

const ADMIN_FILE_NUMBER = 735043;

const newPassword = () => randomBytes(12).toString('base64url');

async function findAuthUserByEmail(db, email) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((u) => u.email === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
}

async function createLogin(db, employee) {
  const email = emailFor(employee.file_number);
  const password = newPassword();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { file_number: employee.file_number },
  });
  if (error) throw new Error(`createUser ${employee.file_number}: ${error.message}`);
  const { error: linkError } = await db.from('employees').update({ user_id: data.user.id }).eq('id', employee.id);
  if (linkError) throw linkError;
  return { file_number: employee.file_number, role: employee.role, name: employee.full_name_en, password };
}

async function seed() {
  const db = serviceClient();

  const { data: counts, error } = await db.rpc('demo_seed');
  if (error) throw new Error(`demo_seed: ${error.message}`);
  console.log('Demo data created:', counts);

  const credentials = readCredentials();
  credentials.accounts ??= {};

  // System admin: create the login once and keep it across resets.
  const { data: admin, error: adminError } = await db
    .from('employees').select('id, file_number, role, full_name_en, user_id')
    .eq('file_number', ADMIN_FILE_NUMBER).single();
  if (adminError) throw adminError;
  if (!admin.user_id) {
    const existing = await findAuthUserByEmail(db, emailFor(ADMIN_FILE_NUMBER));
    if (existing) {
      await db.from('employees').update({ user_id: existing.id }).eq('id', admin.id);
      console.log('Admin 735043: re-linked existing login (password unchanged).');
    } else {
      credentials.accounts[ADMIN_FILE_NUMBER] = await createLogin(db, admin);
      console.log('Admin 735043: login created.');
    }
  }

  // Test logins: supervisors of the first two departments, and 5 employees from those departments.
  const { data: departments, error: depError } = await db
    .from('departments').select('id, name_en, supervisor_id').eq('is_demo', true).order('name_en').limit(2);
  if (depError) throw depError;
  const depIds = departments.map((d) => d.id);

  const { data: supervisors } = await db
    .from('employees').select('id, file_number, role, full_name_en')
    .in('id', departments.map((d) => d.supervisor_id));
  const { data: staff } = await db
    .from('employees').select('id, file_number, role, full_name_en')
    .in('department_id', depIds).eq('role', 'employee').lt('file_number', 710050)
    .order('file_number').limit(5);

  for (const employee of [...supervisors, ...staff]) {
    credentials.accounts[employee.file_number] = await createLogin(db, employee);
  }
  writeCredentials(credentials);
  console.log(`Test logins: ${supervisors.length} supervisors, ${staff.length} employees.`);
  console.log(`Passwords saved to ${credentialsFile} (not in git).`);
}

async function reset() {
  const db = serviceClient();

  const { data: withLogins, error } = await db
    .from('employees').select('file_number, user_id').eq('is_demo', true).not('user_id', 'is', null);
  if (error) throw error;
  for (const e of withLogins) {
    const { error: delError } = await db.auth.admin.deleteUser(e.user_id);
    if (delError) throw new Error(`deleteUser ${e.file_number}: ${delError.message}`);
  }

  const { data: result, error: resetError } = await db.rpc('demo_reset');
  if (resetError) throw new Error(`demo_reset: ${resetError.message}`);

  const credentials = readCredentials();
  for (const fileNumber of Object.keys(credentials.accounts ?? {})) {
    if (Number(fileNumber) !== ADMIN_FILE_NUMBER) delete credentials.accounts[fileNumber];
  }
  writeCredentials(credentials);
  console.log(`Removed ${withLogins.length} demo logins.`, result);
}

const command = process.argv[2];
const actions = { seed, reset };
if (!actions[command]) {
  console.error('Usage: node demo.mjs seed|reset');
  process.exit(1);
}
actions[command]().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
