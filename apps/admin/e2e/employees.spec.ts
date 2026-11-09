import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { authFile, E2E_ACCOUNTS, serviceClient } from "./accounts";

test.use({ storageState: authFile("admin") });
test.describe.configure({ mode: "serial" });

const FILE = "799950";
const PASSWORD = "Jahez2026x";
const alert = (page: Page) => page.locator('p[role="alert"]');

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});

test("employees list: search by file number and by name, filter by status", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "الموظفون" }).click();
  await expect(page.getByTestId("result-count")).toContainText("موظف");

  await page.getByLabel("بحث برقم الملف أو الاسم").fill("710013");
  await page.getByRole("button", { name: "بحث" }).click();
  await expect(page.getByTestId("result-count")).toHaveText("1 موظف");
  await expect(page.getByRole("row", { name: /710013/ })).toBeVisible();

  await page.goto("/employees?status=no_login");
  await expect(page.getByRole("row", { name: /710000/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "التالي" })).toBeVisible(); // more than one page
});

test("add an employee; duplicate file numbers are refused", async ({ page }) => {
  await page.goto("/employees/new");
  const form = page.getByTestId("new-employee");
  await form.getByLabel("رقم الملف").fill("710000");
  await form.getByLabel("الاسم بالعربي").fill("موظف اختبار");
  await form.getByLabel("الاسم بالإنجليزي").fill("E2E Employee");
  await form.getByRole("button", { name: "حفظ" }).click();
  await expect(alert(page)).toHaveText("رقم الملف مستخدم لموظف آخر.");
  await expect(form.getByLabel("الاسم بالعربي")).toHaveValue("موظف اختبار"); // kept after the error

  await form.getByLabel("رقم الملف").fill(FILE);
  await form.getByLabel("الجوال").fill("99887766");
  await form.getByLabel("القسم").selectOption({ label: "تقنية المعلومات" });
  await form.getByLabel("نمط العمل").selectOption({ label: "صباحي" });
  await form.getByRole("button", { name: "حفظ" }).click();
  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "موظف اختبار" })).toBeVisible();
  await expect(page.getByText("لا يوجد حساب دخول بعد")).toBeVisible();
});

async function openTestEmployee(page: Page) {
  await page.goto(`/employees?q=${FILE}`);
  await page.getByRole("row", { name: new RegExp(FILE) }).getByRole("link", { name: "فتح" }).click();
  await expect(page.getByRole("heading", { name: "موظف اختبار" })).toBeVisible();
}

test("role and password: rules are enforced, then the new HR account must change its password", async ({ page, browser }) => {
  await openTestEmployee(page);

  const role = page.getByTestId("role");
  await role.getByLabel("الدور").selectOption("hr");
  await role.getByRole("button", { name: "حفظ الدور" }).click();
  await expect(role.getByRole("status")).toHaveText("تم الحفظ.");

  const pw = page.getByTestId("password");
  await pw.getByLabel("كلمة المرور الأولية").fill(`a${FILE}b`);
  await pw.getByLabel("تأكيد كلمة المرور").fill(`a${FILE}b`);
  await pw.getByRole("button", { name: "حفظ كلمة المرور" }).click();
  await expect(pw.locator('p[role="alert"]')).toHaveText("لا تستخدم رقم الملف داخل كلمة المرور.");

  await pw.getByLabel("كلمة المرور الأولية").fill(PASSWORD);
  await pw.getByLabel("تأكيد كلمة المرور").fill(PASSWORD);
  await pw.getByRole("button", { name: "حفظ كلمة المرور" }).click();
  await expect(pw.getByRole("status")).toHaveText("تم حفظ كلمة المرور. أعطها للموظف، ولن تظهر مرة أخرى.");
  await expect(pw.getByLabel("كلمة المرور الأولية")).toHaveValue(""); // cleared, not kept on screen

  // The employee signs in with it and is sent to change it.
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const other = await ctx.newPage();
  await other.goto("/login");
  await other.getByLabel("رقم الملف الوظيفي").fill(FILE);
  await other.getByLabel("كلمة المرور").fill(PASSWORD);
  await other.getByRole("button", { name: "تسجيل الدخول" }).click();
  await expect(other).toHaveURL(/\/change-password$/);
  await ctx.close();
});

test("a supervisor of a department cannot lose the supervisor role", async ({ page }) => {
  await page.goto("/employees?role=supervisor");
  await page.getByRole("link", { name: "فتح" }).first().click();
  const role = page.getByTestId("role");
  await role.getByLabel("الدور").selectOption("employee");
  await role.getByRole("button", { name: "حفظ الدور" }).click();
  await expect(role.locator('p[role="alert"]')).toHaveText(
    "هذا الموظف مشرف على قسم. عيّن مشرفاً آخر للقسم أولاً من شاشة الأقسام.",
  );
});

test("sites can be enabled one by one", async ({ page }) => {
  await openTestEmployee(page);
  const sites = page.getByTestId("sites");
  const boxes = sites.getByRole("checkbox");
  await expect(boxes).not.toHaveCount(0);
  await boxes.first().check();
  await sites.getByRole("button", { name: "حفظ المواقع" }).click();
  await expect(sites.getByRole("status")).toHaveText("تم الحفظ.");
  await page.reload();
  await expect(page.getByTestId("sites").getByRole("checkbox").first()).toBeChecked();
});

test("a bound phone can be unbound", async ({ page }) => {
  const db = serviceClient();
  const { data: emp } = await db.from("employees").select("id").eq("file_number", Number(FILE)).single();
  await db.from("devices").insert({ employee_id: emp!.id, device_identifier: `e2e-${Date.now()}`, platform: "android", model: "E2E Phone" });

  await openTestEmployee(page);
  await expect(page.getByTestId("device-info")).toContainText("E2E Phone");
  await page.getByRole("button", { name: "فك الربط" }).click();
  await expect(page.getByText("لا يوجد جوال مرتبط")).toBeVisible();
});

test("a suspended account cannot sign in until re-enabled", async ({ page, browser }) => {
  await openTestEmployee(page);
  await page.getByRole("button", { name: "إيقاف الحساب" }).click();
  await expect(page.getByRole("button", { name: "إعادة تشغيل الحساب" })).toBeVisible();

  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const other = await ctx.newPage();
  await other.goto("/login");
  await other.getByLabel("رقم الملف الوظيفي").fill(FILE);
  await other.getByLabel("كلمة المرور").fill(PASSWORD);
  await other.getByRole("button", { name: "تسجيل الدخول" }).click();
  await expect(other.locator('p[role="alert"]')).toBeVisible();
  await expect(other).toHaveURL(/\/login$/);
  await ctx.close();

  await page.getByRole("button", { name: "إعادة تشغيل الحساب" }).click();
  await expect(page.getByRole("button", { name: "إيقاف الحساب" })).toBeVisible();
});

test("the admin cannot change their own account", async ({ page }) => {
  await page.goto(`/employees?q=${E2E_ACCOUNTS.admin}`);
  await page.getByRole("link", { name: "فتح" }).click();
  await expect(page.getByText("هذا حسابك.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "إيقاف الحساب" })).toHaveCount(0);
  await expect(page.getByTestId("password")).toHaveCount(0);
});

test("end of service: both files must be downloaded, then everything is deleted", async ({ page }) => {
  const db = serviceClient();
  const { data: before } = await db.from("employees").select("id, user_id").eq("file_number", Number(FILE)).single();
  // A punch photo that must be removed too.
  await db.storage.from("punch-photos").upload(`${before!.id}/e2e.jpg`, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }), { upsert: true });

  await openTestEmployee(page);
  await page.getByRole("link", { name: "إنهاء الخدمة" }).click();
  const deleteButton = page.getByRole("button", { name: "حذف الموظف نهائياً" });
  await expect(deleteButton).toBeDisabled();

  const [xlsx] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-xlsx").click()]);
  expect(xlsx.suggestedFilename()).toBe(`jahez-employee-${FILE}.xlsx`);
  const xlsxPath = `test-results/${xlsx.suggestedFilename()}`;
  await xlsx.saveAs(xlsxPath);
  expect(readFileSync(xlsxPath).subarray(0, 2).toString()).toBe("PK"); // Excel files are zip archives

  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-pdf").click()]);
  expect(pdf.suggestedFilename()).toBe(`jahez-employee-${FILE}.pdf`);
  const pdfPath = `test-results/${pdf.suggestedFilename()}`;
  await pdf.saveAs(pdfPath);
  expect(readFileSync(pdfPath).subarray(0, 4).toString()).toBe("%PDF");

  await page.getByLabel("اكتب رقم الملف للتأكيد").fill("799951");
  await expect(deleteButton).toBeDisabled();
  await page.getByLabel("اكتب رقم الملف للتأكيد").fill(FILE);
  await deleteButton.click();
  await expect(page).toHaveURL(/\/employees\?terminated=799950$/);
  await expect(page.getByRole("status")).toContainText("تم إنهاء خدمة الموظف رقم 799950");

  const { data: after } = await db.from("employees").select("id").eq("file_number", Number(FILE));
  expect(after).toHaveLength(0);
  const { data: user } = await db.auth.admin.getUserById(before!.user_id!);
  expect(user.user).toBeNull();
  const { data: photos } = await db.storage.from("punch-photos").list(before!.id);
  expect(photos ?? []).toHaveLength(0);
  const { count } = await db.from("audit_log").select("id", { count: "exact", head: true }).eq("record_id", before!.id);
  expect(count).toBeGreaterThan(0); // the audit log is kept
});
