import { test, expect } from "@playwright/test";

// The media clock is controlled here to exercise edge cases deterministically.
// Storage is mocked for both browser engines; a separate Chromium smoke test loads the real extension.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const listeners = [];
    const read = () => JSON.parse(localStorage.getItem("test-extension-storage") || "{}");
    const update = (values, removals = []) => {
      const data = read(), changes = {};
      for (const [key, value] of Object.entries(values)) { changes[key] = { oldValue: data[key], newValue: value }; data[key] = value; }
      for (const key of removals) { changes[key] = { oldValue: data[key] }; delete data[key]; }
      localStorage.setItem("test-extension-storage", JSON.stringify(data));
      listeners.forEach(listener => listener(changes, "local"));
    };
    window.browser = { storage: {
      local: { get: async key => key ? { [key]: read()[key] } : read(), set: async values => update(values), remove: async keys => update({}, Array.isArray(keys) ? keys : [keys]) },
      onChanged: { addListener: listener => listeners.push(listener) }
    } };
  });
  await page.goto("/");
  await installVideo(page);
  await page.addScriptTag({ url: "/core.js" });
  await page.addScriptTag({ url: "/content.js" });
});

async function installVideo(page) {
  await page.evaluate(() => {
    const video = document.querySelector("video");
    let time = 0;
    Object.defineProperties(video, {
      duration: { configurable: true, get: () => 120 },
      currentTime: { configurable: true, get: () => time, set: value => { time = value; video.dispatchEvent(new Event("timeupdate", { bubbles: true })); } },
      currentSrc: { configurable: true, get: () => "https://media.example/episode-1.webm" },
      seekable: { configurable: true, get: () => ({ length: 1, start: () => 0, end: () => 120 }) }
    });
  });
}

const seek = (page, time) => page.evaluate(t => { document.querySelector("video").currentTime = t; }, time);
const skip = page => page.getByRole("button", { name: "Skip intro →", exact: true });

test("chapters offer skip only during the intro and seek on click, never automatically", async ({ page }) => {
  await seek(page, 2);
  await expect(skip(page)).toBeHidden();
  await seek(page, 4);
  await expect(skip(page)).toBeVisible();
  await expect.poll(() => page.locator("video").evaluate(v => v.currentTime)).toBe(4);
  await skip(page).click();
  await expect.poll(() => page.locator("video").evaluate(v => v.currentTime)).toBe(9);
  await expect(skip(page)).toBeHidden();
});

test("manual intervals persist on reload and cannot leak to another SPA episode", async ({ page }) => {
  await page.getByRole("button", { name: "Togli capitoli" }).click();
  await page.locator("video").hover();
  await page.locator("summary").click();
  await page.getByLabel("Inizio (secondi)").fill("12");
  await page.getByLabel("Fine (secondi)").fill("40");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page.locator("skip-intro-overlay #status")).toContainText("salvata");
  await seek(page, 20);
  await expect(skip(page)).toBeVisible();
  await page.reload();
  await installVideo(page);
  await page.addScriptTag({ url: "/core.js" });
  await page.addScriptTag({ url: "/content.js" });
  await seek(page, 20);
  await expect(skip(page)).toBeVisible();
  await skip(page).click();
  await expect.poll(() => page.locator("video").evaluate(v => v.currentTime)).toBe(40);
  await page.evaluate(() => history.pushState({}, "", "/?episode=2"));
  await seek(page, 20);
  await expect(skip(page)).toBeHidden();
});

test("unseekable targets are disabled and disabling the extension hides the overlay", async ({ page }) => {
  await seek(page, 4);
  await expect(skip(page)).toBeVisible();
  await page.evaluate(() => Object.defineProperty(document.querySelector("video"), "seekable", { configurable: true, get: () => ({ length: 1, start: () => 0, end: () => 5 }) }));
  await expect(page.getByRole("button", { name: "Sigla · attendo il video…" })).toBeDisabled();
  await page.evaluate(() => browser.storage.local.set({ enabled: false }));
  await expect(page.locator("skip-intro-overlay")).toBeHidden();
});

test("rejects invalid manual ranges and removes saved ranges", async ({ page }) => {
  await page.getByRole("button", { name: "Togli capitoli" }).click();
  await page.locator("video").hover();
  await page.locator("summary").click();
  await page.getByLabel("Inizio (secondi)").fill("60");
  await page.getByLabel("Fine (secondi)").fill("30");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page.locator("skip-intro-overlay #status")).toContainText("2–300");
  await page.getByLabel("Inizio (secondi)").fill("10");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await seek(page, 20);
  await expect(skip(page)).toBeVisible();
  await page.getByRole("button", { name: "Dimentica", exact: true }).click();
  await expect(skip(page)).toBeHidden();
});

test("follows dynamically replaced players and works inside an iframe", async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector("video").remove();
    const frame = document.createElement("iframe"); frame.src = "/?embedded=1";
    frame.width = "1000"; frame.height = "900"; document.body.prepend(frame);
  });
  await expect(page.locator("skip-intro-overlay")).toBeHidden();
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForSelector("video");
  await installVideo(frame);
  await frame.addScriptTag({ url: "/core.js" });
  await frame.addScriptTag({ url: "/content.js" });
  await seek(frame, 4);
  await expect(skip(frame)).toBeVisible();
  await skip(frame).click();
  await expect.poll(() => frame.locator("video").evaluate(v => v.currentTime)).toBe(9);
});
