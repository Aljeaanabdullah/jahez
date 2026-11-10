import { expect, test } from "@playwright/test";
import { authFile, serviceClient } from "./accounts";

test.use({ storageState: authFile("admin") });

// Phase 7: the employee page shows the last 31 days from the rules engine.
test("employee page shows the last 31 days of attendance", async ({ page }) => {
  const db = serviceClient();
  const { data: emp } = await db
    .from("employees")
    .select("id, work_patterns!inner(kind)")
    .eq("is_demo", true)
    .eq("work_patterns.kind", "morning")
    .order("file_number")
    .limit(1)
    .single();
  await page.goto(`/employees/${emp!.id}`);
  await expect(page.getByRole("heading", { name: "سجل الحضور — آخر 31 يوماً" })).toBeVisible();
  await expect(page.getByTestId("attendance-rows").getByRole("row")).toHaveCount(31);
  await expect(page.getByTestId("attendance-totals")).toContainText("غياب:");
  // Morning pattern: Friday and Saturday are days off.
  await expect(page.getByTestId("attendance-rows").getByText("راحة").first()).toBeVisible();
  // Demo employees were added recently: older work days are not counted as absences.
  await expect(page.getByTestId("attendance-rows").getByText("قبل إضافة الموظف").first()).toBeVisible();
  await page.getByTestId("attendance-rows").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/attendance.png", fullPage: true });
});
