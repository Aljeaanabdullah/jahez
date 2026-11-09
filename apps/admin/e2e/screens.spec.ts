import { test } from "@playwright/test";
import { authFile } from "./accounts";

// Optional: saves screenshots of the organisation screens for a visual check.
// Run with:  SCREENSHOTS=1 npx playwright test screens
test.skip(!process.env.SCREENSHOTS, "screenshots only on request");
test.use({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });

const pages = [
  ["departments", "/organisation/departments"],
  ["sites", "/organisation/sites"],
  ["work-patterns", "/organisation/work-patterns"],
  ["holidays", "/organisation/holidays?year=2027"],
] as const;

test("capture organisation screens", async ({ page, context }) => {
  for (const [name, url] of pages) {
    await page.goto(url);
    await page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true });
  }

  await page.goto("/organisation/sites");
  await page.getByRole("row", { name: /موقع تجريبي ١/ }).getByRole("link").click();
  await page.locator(".leaflet-tile-loaded").first().waitFor();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/screens/site-detail.png", fullPage: true });

  await context.addCookies([
    { name: "jahez_theme", value: "dark", url: "http://localhost:3000" },
    { name: "jahez_lang", value: "en", url: "http://localhost:3000" },
  ]);
  await page.goto("/organisation/work-patterns/new");
  await page.screenshot({ path: "test-results/screens/new-pattern-dark-en.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await context.addCookies([
    { name: "jahez_theme", value: "light", url: "http://localhost:3000" },
    { name: "jahez_lang", value: "ar", url: "http://localhost:3000" },
  ]);
  await page.goto("/organisation/departments");
  await page.screenshot({ path: "test-results/screens/departments-phone.png", fullPage: true });
});

test("capture an employee record PDF with punches", async ({ page }) => {
  await page.goto("/employees?q=710013");
  await page.getByRole("link", { name: "فتح" }).click();
  await page.waitForURL(/\/employees\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop();
  const res = await page.request.get(`/employees/${id}/export/pdf`);
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync("test-results/screens", { recursive: true });
  writeFileSync("test-results/screens/record-710013.pdf", await res.body());
});

test("capture the employee screens", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/employees");
  await page.screenshot({ path: "test-results/screens/employees.png" });
  await page.goto("/employees?q=710013");
  await page.getByRole("link", { name: "فتح" }).click();
  await page.waitForURL(/\/employees\/[0-9a-f-]{36}$/);
  await page.screenshot({ path: "test-results/screens/employee-detail.png", fullPage: true });
});
