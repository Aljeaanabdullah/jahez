import { chromium, type FullConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { authFile, cleanUp, E2E_ACCOUNTS, emailFor, serviceClient, type E2ERole } from "./accounts";

// Creates the temporary accounts and signs in as admin and supervisor once,
// saving their browser sessions for the tests. Passwords live only in memory
// (and in process.env for the employee sign-in test); they are never printed.
export default async function globalSetup(config: FullConfig) {
  await cleanUp();
  const db = serviceClient();
  const passwords = {} as Record<E2ERole, string>;

  for (const [role, fileNumber] of Object.entries(E2E_ACCOUNTS) as [E2ERole, number][]) {
    const password = `E2e${randomBytes(9).toString("base64url")}7`;
    const { data, error } = await db.auth.admin.createUser({
      email: emailFor(fileNumber),
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser ${fileNumber}: ${error.message}`);
    const { error: insertError } = await db.from("employees").insert({
      file_number: fileNumber,
      user_id: data.user.id,
      full_name_ar: `حساب اختبار ${role}`,
      full_name_en: `E2E ${role}`,
      role,
      must_change_password: false,
      is_demo: true,
    });
    if (insertError) throw new Error(`employee ${fileNumber}: ${insertError.message}`);
    passwords[role] = password;
  }
  process.env.E2E_EMPLOYEE_PASSWORD = passwords.employee;

  mkdirSync(path.dirname(authFile("admin")), { recursive: true });
  const baseURL = config.projects[0].use.baseURL!;
  const browser = await chromium.launch();
  for (const role of ["admin", "supervisor", "hr"] as const) {
    const page = await browser.newPage({ baseURL });
    await page.goto("/login");
    await page.locator('input[name="fileNumber"]').fill(String(E2E_ACCOUNTS[role]));
    await page.locator('input[name="password"]').fill(passwords[role]);
    await page.locator('button[type="submit"]').last().click();
    await page.waitForURL((url) => url.pathname === "/");
    await page.context().storageState({ path: authFile(role) });
    await page.close();
  }
  await browser.close();
}
