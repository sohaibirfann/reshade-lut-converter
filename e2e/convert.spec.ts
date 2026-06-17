import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(dir, "fixtures", name);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("detects a strip LUT", async ({ page }) => {
  await page.setInputFiles("#lut-file", fixture("strip.png"));
  await expect(page.locator("#file-meta")).toContainText("ReShade strip · 16³");
  await expect(page.locator("#view")).toBeVisible();
  await expect(page.locator("#bands-wrap")).toBeHidden();
});

test("detects a MultiLUT atlas and lists selectable bands", async ({ page }) => {
  await page.setInputFiles("#lut-file", fixture("atlas.png"));
  await expect(page.locator("#file-meta")).toContainText("MultiLUT atlas · 3 × 8³");
  const bands = page.locator(".band");
  await expect(bands).toHaveCount(3);
  await bands.nth(1).click();
  await expect(bands.nth(1)).toHaveAttribute("aria-selected", "true");
});

test("detects a HALD CLUT", async ({ page }) => {
  await page.setInputFiles("#lut-file", fixture("hald.png"));
  await expect(page.locator("#file-meta")).toContainText("HALD CLUT · 16³");
});

test("offers a zip of all bands for an atlas only", async ({ page }) => {
  await page.setInputFiles("#lut-file", fixture("strip.png"));
  await expect(page.locator("#download-all")).toBeHidden();

  await page.setInputFiles("#lut-file", fixture("atlas.png"));
  await expect(page.locator("#download-all")).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#download-all").click(),
  ]);
  expect(download.suggestedFilename()).toBe("atlas-luts.zip");
});

test("rejects an unrecognized image", async ({ page }) => {
  await page.setInputFiles("#lut-file", fixture("square.png"));
  await expect(page.locator("#message")).toBeVisible();
  await expect(page.locator("#message")).toContainText(/HALD/i);
  await expect(page.locator("#view")).toBeHidden();
});

test("downloads a .cube named after the source", async ({ page }) => {
  await page.setInputFiles("#lut-file", fixture("strip.png"));
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#download").click(),
  ]);
  expect(download.suggestedFilename()).toBe("strip.cube");
});
