import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("real Chromium extension loads and skips a generated local video", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Persistent extension loading is tested in Chromium.");
  test.setTimeout(60000);
  const profile = await mkdtemp(join(tmpdir(), "skip-intro-test-"));
  const path = resolve("dist/chrome");
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: "chromium", headless: true, viewport: { width: 1280, height: 1000 },
      args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`]
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://127.0.0.1:4173");
    await page.getByRole("button", { name: "1. Genera" }).click();
    await expect(page.locator("#status")).toContainText("Clip pronta", { timeout: 25000 });
    await expect.poll(() => page.locator("video").evaluate(v => Number.isFinite(v.duration)), { timeout: 10000 }).toBe(true);
    await page.getByRole("button", { name: "2. Vai" }).click();
    const skip = page.getByRole("button", { name: "Skip intro →", exact: true });
    await expect(skip).toBeVisible();
    await expect(skip).toBeEnabled();
    await page.screenshot({ path: "artifacts/demo-chromium.png", fullPage: true });
    await skip.click();
    await expect.poll(() => page.locator("video").evaluate(v => v.currentTime)).toBe(9);
    await expect(skip).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
});
