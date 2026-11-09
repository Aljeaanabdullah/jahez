import { expect, test, type Page } from "@playwright/test";
import { authFile, serviceClient } from "./accounts";

// Three test employees: with log-in and consent, without log-in, and without consent.
const WITH_CONSENT = 799961;
const NO_LOGIN = 799962;
const NO_CONSENT = 799963;
const ids: Record<number, string> = {};
const JPEG = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const db = serviceClient();
  for (const n of [WITH_CONSENT, NO_LOGIN, NO_CONSENT]) {
    let userId: string | null = null;
    if (n !== NO_LOGIN) {
      const { data } = await db.auth.admin.createUser({ email: `${n}@jahez.local`, password: `Tt${n}xyzAB9`, email_confirm: true });
      userId = data.user!.id;
    }
    const { data: emp } = await db
      .from("employees")
      .insert({ file_number: n, full_name_ar: `موظف وجه ${n}`, full_name_en: `E2E Face ${n}`, user_id: userId, is_demo: true, must_change_password: false })
      .select("id")
      .single();
    ids[n] = emp!.id;
  }
  await db.from("consents").insert({ employee_id: ids[WITH_CONSENT], consent_version: "v1" });
});

test.afterAll(async () => {
  const db = serviceClient();
  const { data: files } = await db.storage.from("face-enrollment-photos").list(ids[WITH_CONSENT]);
  if (files?.length) await db.storage.from("face-enrollment-photos").remove(files.map((f) => `${ids[WITH_CONSENT]}/${f.name}`));
});

async function find(page: Page, n: number) {
  await page.goto("/face-enrollment");
  await page.getByLabel("رقم الملف الوظيفي").fill(String(n));
  await page.getByRole("button", { name: "بحث" }).click();
  await expect(page.getByRole("heading", { name: `موظف وجه ${n}` })).toBeVisible();
}

test.describe("HR", () => {
  test.use({ storageState: authFile("hr") });

  test("enrollment needs a log-in and the employee's consent", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "تسجيل الوجه" }).click();
    await expect(page).toHaveURL(/\/face-enrollment$/);

    await find(page, NO_LOGIN);
    await expect(page.locator('p[role="alert"]')).toContainText("ليس للموظف حساب دخول");
    await find(page, NO_CONSENT);
    await expect(page.locator('p[role="alert"]')).toContainText("لم يوافق الموظف بعد");
    await expect(page.getByRole("button", { name: "تشغيل الكاميرا" })).toHaveCount(0);
  });

  test("the camera starts and refuses a picture with no face", async ({ page }) => {
    test.setTimeout(120_000);
    await find(page, WITH_CONSENT);
    await expect(page.getByTestId("consent-status")).toContainText("وافق في");
    await expect(page.getByTestId("enroll-status")).toHaveText("غير مسجّل");

    await page.getByRole("button", { name: "تشغيل الكاميرا" }).click();
    // Chromium's fake camera shows a test pattern, not a face.
    await expect(page.getByTestId("quality")).toHaveText("لا يوجد وجه واضح في الصورة.", { timeout: 60_000 });
    await expect(page.getByRole("button", { name: /التقاط/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: "حفظ التسجيل" })).toBeDisabled();
  });
});

test.describe("supervisor", () => {
  test.use({ storageState: authFile("supervisor") });

  test("cannot open face enrollment", async ({ page }) => {
    await page.goto("/face-enrollment");
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("admin", () => {
  test.use({ storageState: authFile("admin") });

  test("reviews enrollment photos", async ({ page }) => {
    const db = serviceClient();
    const id = ids[WITH_CONSENT];
    const paths = [1, 2, 3].map((i) => `${id}/e2e-${i}.jpg`);
    for (const p of paths) await db.storage.from("face-enrollment-photos").upload(p, JPEG, { upsert: true });
    await db.from("face_templates").upsert(
      {
        employee_id: id,
        embedding: `[${Array(128).fill(0.02).join(",")}]`,
        model_version: "dlib-resnet-v1/align-v1",
        source: "web",
        photo_paths: paths,
      },
      { onConflict: "employee_id" },
    );

    await page.goto("/");
    await page.getByRole("link", { name: "تسجيل الوجه" }).click();
    await expect(page.getByRole("heading", { name: "الوجوه المسجلة" })).toBeVisible();
    const card = page.locator("section", { hasText: `موظف وجه ${WITH_CONSENT}` });
    await expect(card.getByRole("img")).toHaveCount(3);
    const src = await card.getByRole("img").first().getAttribute("src");
    expect(src).toContain("/storage/v1/object/sign/face-enrollment-photos/");
  });
});
