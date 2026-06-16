import { test, expect } from "@playwright/test";

test("theme toggle flips and persists the theme", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const before = await html.getAttribute("data-theme");

  await page.locator("#theme-toggle").click();
  const after = await html.getAttribute("data-theme");
  expect(after).not.toBe(before);
  expect(["light", "dark"]).toContain(after);

  // survives a reload
  await page.reload();
  expect(await html.getAttribute("data-theme")).toBe(after);
});
