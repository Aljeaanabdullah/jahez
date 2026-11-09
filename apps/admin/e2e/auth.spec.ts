import { expect, test } from "@playwright/test";
import { authFile, E2E_ACCOUNTS } from "./accounts";

test.describe("sign-in rules", () => {
  test("signed-out visitors are sent to the sign-in page", async ({ page }) => {
    await page.goto("/organisation/sites");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("an employee account cannot use the web panel", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("رقم الملف الوظيفي").fill(String(E2E_ACCOUNTS.employee));
    await page.getByLabel("كلمة المرور").fill(process.env.E2E_EMPLOYEE_PASSWORD!);
    await page.getByRole("button", { name: "تسجيل الدخول" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText("حسابك حساب موظف. استخدم تطبيق الجوال للتبصيم.");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("supervisor", () => {
  test.use({ storageState: authFile("supervisor") });

  test("has no organisation menu and is sent home from its pages", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "الهيكل التنظيمي" })).toHaveCount(0);
    await page.goto("/organisation/departments");
    await expect(page).toHaveURL(/\/$/);
  });
});
