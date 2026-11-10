import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authFile, E2E_ACCOUNTS, emailFor, serviceClient } from "./accounts";

// Phase 8: a punch correction goes employee -> supervisor -> HR, then shows in the employee record.
test.describe.configure({ mode: "serial" });

const kuwaitDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuwait" }).format(d);
const yesterday = kuwaitDate(new Date(Date.now() - 86_400_000));

test.beforeAll(async () => {
  const db = serviceClient();
  const ids = Object.fromEntries(
    await Promise.all(
      (["supervisor", "employee"] as const).map(async (r) => [
        r,
        (await db.from("employees").select("id").eq("file_number", E2E_ACCOUNTS[r]).single()).data!.id as string,
      ]),
    ),
  );
  const { data: pattern } = await db
    .from("work_patterns")
    .insert({ kind: "morning", name_ar: "نمط اختبار", name_en: "E2E pattern", shift_start: "07:00", shift_duration: "8 hours", weekly_off_days: [] })
    .select("id")
    .single();
  const { data: dept } = await db
    .from("departments")
    .insert({ name_ar: "قسم اختبار الطلبات", name_en: "E2E requests dept", supervisor_id: ids.supervisor })
    .select("id")
    .single();
  await db
    .from("employees")
    .update({ department_id: dept!.id, work_pattern_id: pattern!.id, created_at: new Date(Date.now() - 10 * 86_400_000).toISOString() })
    .eq("id", ids.employee);

  // The employee submits the request (from the phone app in real life).
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email: emailFor(E2E_ACCOUNTS.employee),
    password: process.env.E2E_EMPLOYEE_PASSWORD!,
  });
  if (signInError) throw signInError;
  const { error } = await client.rpc("submit_request", {
    p_type: "punch_correction",
    p_shift_date: yesterday,
    p_reason: "نسيت البصمة — اختبار",
    p_punch_type: "check_in",
    p_time: `${yesterday}T07:30:00+03:00`,
  });
  if (error) throw error;
});

test.describe("supervisor", () => {
  test.use({ storageState: authFile("supervisor") });

  test("approves first; the request then waits for HR", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "الموافقات" }).click();
    const item = page.getByTestId("inbox-item").filter({ hasText: String(E2E_ACCOUNTS.employee) });
    await expect(item).toContainText("تصحيح بصمة");
    await expect(item).toContainText("بانتظار المشرف");
    await expect(item).toContainText("نسيت البصمة — اختبار");
    await item.getByLabel("ملاحظة (اختيارية)").fill("تم التأكد");
    await item.getByRole("button", { name: "قبول" }).click();
    await expect(page.getByText("تم حفظ القرار.")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("inbox-item").filter({ hasText: String(E2E_ACCOUNTS.employee) })).toHaveCount(0);
  });
});

test.describe("hr", () => {
  test.use({ storageState: authFile("hr") });

  test("gives the final approval; the record shows the corrected check-in", async ({ page }) => {
    await page.goto("/approvals");
    const item = page.getByTestId("inbox-item").filter({ hasText: String(E2E_ACCOUNTS.employee) });
    await expect(item).toContainText("بانتظار الموارد البشرية");
    await item.getByRole("button", { name: "قبول" }).click();
    await expect(page.getByText("تم حفظ القرار.")).toBeVisible();

    await page.getByRole("link", { name: "سجل موظف" }).click();
    await page.getByLabel("رقم الملف الوظيفي").fill(String(E2E_ACCOUNTS.employee));
    await page.getByRole("button", { name: "عرض" }).click();
    await expect(page.getByRole("heading", { name: "حساب اختبار employee" })).toBeVisible();
    await expect(page.getByTestId("attendance-rows")).toContainText("مصححة بطلب");
    await expect(page.getByTestId("request-rows")).toContainText("مقبول");
    await expect(page.getByTestId("punch-rows")).toContainText("مصححة بطلب");
    await expect(page.getByText("صور البصمات يطّلع عليها المشرف ومدير النظام فقط.")).toBeVisible();
    await page.screenshot({ path: "test-results/record-hr.png", fullPage: true });
  });
});

test.describe("supervisor record", () => {
  test.use({ storageState: authFile("supervisor") });

  test("sees the photo column; HR does not", async ({ page }) => {
    await page.goto(`/records?file=${E2E_ACCOUNTS.employee}`);
    await expect(page.getByRole("columnheader", { name: "الصورة" })).toBeVisible();
    await expect(page.getByText("صور البصمات يطّلع عليها المشرف ومدير النظام فقط.")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "الشهر السابق" })).toBeVisible();
  });
});
