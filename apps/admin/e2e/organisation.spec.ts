import { expect, test, type Page } from "@playwright/test";
import { authFile } from "./accounts";

test.use({ storageState: authFile("admin") });

// Accept the "Are you sure?" dialog on delete buttons.
test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});

const form = (page: Page, testId: string) => page.getByTestId(testId);

test("admin reaches the organisation screens from the menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "الهيكل التنظيمي" }).click();
  await expect(page).toHaveURL(/\/organisation\/departments$/);
  await expect(page.getByRole("heading", { name: "الهيكل التنظيمي" })).toBeVisible();
});

test("departments: add, rename, delete; a department with employees cannot be deleted", async ({ page }) => {
  await page.goto("/organisation/departments");
  const add = form(page, "new-department");
  await add.getByLabel("الاسم بالعربي").fill("قسم اختبار");
  await add.getByLabel("الاسم بالإنجليزي").fill("E2E Department");
  await add.getByRole("button", { name: "إضافة" }).click();
  await expect(add.getByRole("status")).toHaveText("تم الحفظ.");
  await expect(add.getByLabel("الاسم بالعربي")).toHaveValue(""); // form cleared

  const row = page.getByRole("row", { name: /قسم اختبار/ });
  await row.getByRole("link", { name: "تعديل" }).click();
  const edit = form(page, "edit-department");
  await edit.getByLabel("الاسم بالعربي").fill("قسم اختبار معدّل");
  await edit.getByRole("button", { name: "حفظ" }).click();
  await expect(edit.getByRole("status")).toHaveText("تم الحفظ.");

  await page.getByRole("button", { name: "حذف" }).click();
  await expect(page).toHaveURL(/\/organisation\/departments$/);
  await expect(page.getByRole("row", { name: /قسم اختبار/ })).toHaveCount(0);

  // Demo department with employees.
  await page.getByRole("row", { name: /الموارد البشرية/ }).getByRole("link", { name: "تعديل" }).click();
  await page.getByRole("button", { name: "حذف" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText("لا يمكن حذف قسم فيه موظفون.");
});

test("holidays: add, refuse a duplicate date, delete", async ({ page }) => {
  await page.goto("/organisation/holidays?year=2099");
  const add = form(page, "new-holiday");
  const fill = async () => {
    await add.getByLabel("التاريخ").fill("2099-12-31");
    await add.getByLabel("الاسم بالعربي").fill("عطلة اختبار");
    await add.getByLabel("الاسم بالإنجليزي").fill("E2E Holiday");
    await add.getByRole("button", { name: "إضافة" }).click();
  };
  await fill();
  await expect(add.getByRole("status")).toHaveText("تم الحفظ.");
  await expect(page.getByRole("row", { name: /عطلة اختبار/ })).toBeVisible();

  await fill();
  await expect(add.locator('p[role="alert"]')).toHaveText("توجد عطلة مسجّلة في هذا التاريخ.");

  await page.getByRole("row", { name: /عطلة اختبار/ }).getByRole("button", { name: "حذف" }).click();
  await expect(page.getByRole("row", { name: /عطلة اختبار/ })).toHaveCount(0);
});

test("sites: create on the map, add a building, disable, delete", async ({ page }) => {
  await page.goto("/organisation/sites/new");
  const add = form(page, "new-site");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await add.getByLabel("الاسم بالعربي").fill("موقع اختبار");
  await add.getByLabel("الاسم بالإنجليزي").fill("E2E Site");

  // Server-side check: impossible coordinates.
  await add.getByLabel("خط العرض").fill("95");
  await add.getByLabel("خط الطول").fill("47.98");
  await add.getByRole("button", { name: "حفظ" }).click();
  await expect(add.locator('p[role="alert"]')).toHaveText("الإحداثيات غير صحيحة.");

  // Clicking the map fills the coordinates.
  await add.getByLabel("خط العرض").fill("");
  await add.getByLabel("خط الطول").fill("");
  await page.locator(".leaflet-container").click({ position: { x: 200, y: 150 } });
  await expect(add.getByLabel("خط العرض")).not.toHaveValue("");
  await expect(add.getByLabel("خط الطول")).not.toHaveValue("");

  await add.getByLabel("خط العرض").fill("29.3800");
  await add.getByLabel("خط الطول").fill("47.9900");
  await add.getByRole("button", { name: "حفظ" }).click();
  await expect(page).toHaveURL(/\/organisation\/sites\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "موقع اختبار" })).toBeVisible();
  await expect(page.locator(".leaflet-container")).toHaveCount(2); // site + new-building maps

  const building = form(page, "new-building");
  await building.getByLabel("الاسم بالعربي").fill("مبنى اختبار");
  await building.getByLabel("الاسم بالإنجليزي").fill("E2E Building");
  await building.getByLabel("خط العرض").fill("29.3801");
  await building.getByLabel("خط الطول").fill("47.9901");
  await building.getByRole("button", { name: "إضافة" }).click();
  await expect(building.getByRole("status")).toHaveText("تم الحفظ.");
  await expect(page.getByRole("row", { name: /مبنى اختبار/ })).toBeVisible();

  await page.getByRole("button", { name: "إيقاف الموقع" }).click();
  await expect(page.getByText("موقوف", { exact: true })).toBeVisible();

  await page.getByRole("row", { name: /مبنى اختبار/ }).getByRole("button", { name: "حذف" }).click();
  await expect(page.getByRole("row", { name: /مبنى اختبار/ })).toHaveCount(0);

  await page.getByRole("button", { name: "حذف" }).last().click();
  await expect(page).toHaveURL(/\/organisation\/sites$/);
  await expect(page.getByRole("row", { name: /موقع اختبار/ })).toHaveCount(0);
});

test("a site with enabled employees cannot be deleted", async ({ page }) => {
  await page.goto("/organisation/sites");
  await page.getByRole("row", { name: /موقع تجريبي ١/ }).getByRole("link", { name: "تعديل" }).click();
  await page.getByRole("button", { name: "حذف" }).last().click();
  await expect(page.locator('p[role="alert"]').last()).toHaveText(
    "لا يمكن حذف موقع عليه بصمات أو موظفون مفعّلون. أوقفه بدلاً من ذلك.",
  );
});

test("work patterns: create a 48-hour rotation, edit, delete; a pattern in use cannot be deleted", async ({ page }) => {
  await page.goto("/organisation/work-patterns/new");
  const add = form(page, "new-pattern");
  await add.getByLabel("الاسم بالعربي").fill("نمط اختبار");
  await add.getByLabel("الاسم بالإنجليزي").fill("E2E Pattern");
  await add.getByLabel("النوع").selectOption("two_on_four_off");
  await expect(add.getByLabel("أيام العمل في الدورة")).toHaveValue("2");
  await add.getByLabel("مدة الوردية (ساعات)").fill("48");
  await add.getByRole("button", { name: "حفظ" }).click();
  await expect(page).toHaveURL(/\/organisation\/work-patterns$/);

  const row = page.getByRole("row", { name: /نمط اختبار/ });
  await expect(row).toContainText("48");
  await expect(row).toContainText("يومين بأربعة");
  await row.getByRole("link", { name: "تعديل" }).click();

  const edit = form(page, "edit-pattern");
  await expect(edit.getByLabel("مدة الوردية (ساعات)")).toHaveValue("48");
  await edit.getByLabel("مهلة السماح بدون تأخير (دقيقة)").fill("45");
  await edit.getByRole("button", { name: "حفظ" }).click();
  await expect(edit.getByRole("status")).toHaveText("تم الحفظ.");
  await page.reload();
  await expect(form(page, "edit-pattern").getByLabel("مهلة السماح بدون تأخير (دقيقة)")).toHaveValue("45");

  await page.getByRole("button", { name: "حذف" }).click();
  await expect(page).toHaveURL(/\/organisation\/work-patterns$/);
  await expect(page.getByRole("row", { name: /نمط اختبار/ })).toHaveCount(0);

  await page.getByRole("row", { name: /^صباحي/ }).getByRole("link", { name: "تعديل" }).click();
  await page.getByRole("button", { name: "حذف" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText("لا يمكن حذف نمط مستخدم لموظفين.");
});

test("organisation screens switch to English", async ({ page, context }) => {
  await context.addCookies([{ name: "jahez_lang", value: "en", url: "http://localhost:3000" }]);
  await page.goto("/organisation/sites");
  await expect(page.getByRole("heading", { name: "Organisation" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});
