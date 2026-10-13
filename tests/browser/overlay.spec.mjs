import { test, expect } from "@playwright/test";

// Controlled media clocks verify signal handling; no commercial media is fetched.
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
  await page.locator("video").scrollIntoViewIfNeeded();
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
const skip = page => page.locator("skip-intro-overlay").getByRole("button", { name: "Skip intro", exact: true });

test("only shows the button within a detected intro and only seeks on click", async ({ page }) => {
  await seek(page, 2); await expect(skip(page)).toBeHidden();
  await seek(page, 4); await expect(skip(page)).toBeVisible();
  expect(await page.locator("video").evaluate(v => v.currentTime)).toBe(4);
  await skip(page).click();
  await expect.poll(() => page.locator("video").evaluate(v => v.currentTime)).toBe(9);
  await expect(skip(page)).toBeHidden();
});

test("no signal means no hover UI, forms, or stored-timing fallback", async ({ page }) => {
  await page.getByLabel("Test signal").selectOption("none");
  await page.evaluate(() => browser.storage.local.set({ "intro:legacy": { start: 0, end: 90 } }));
  await seek(page, 4); await page.locator("video").hover();
  await expect(skip(page)).toBeHidden();
  await expect(page.locator("skip-intro-overlay input,skip-intro-overlay form,skip-intro-overlay details")).toHaveCount(0);
});

test("delegates a visible native intro button and ignores ads or hidden buttons", async ({ page }) => {
  await page.getByLabel("Test signal").selectOption("native");
  await seek(page, 4); await expect(skip(page)).toBeVisible();
  await skip(page).click();
  await expect.poll(() => page.locator("video").evaluate(v => v.currentTime)).toBe(9);
  await expect(skip(page)).toBeHidden();
  await page.locator("#native-intro").evaluate(button => { button.textContent = "Skip ad"; });
  await seek(page, 4); await expect(skip(page)).toBeHidden();
  await page.locator("#native-intro").evaluate(button => { button.textContent = "Skip intro"; button.style.opacity = "0"; });
  await expect(skip(page)).toBeHidden();
});

test("structured metadata must match the selected media source", async ({ page }) => {
  await page.getByLabel("Test signal").selectOption("structured");
  await seek(page, 4); await expect(skip(page)).toBeVisible();
  await page.locator("#video-metadata").evaluate(script => { const value = JSON.parse(script.textContent); value.contentUrl = "https://media.example/another-episode.webm"; script.textContent = JSON.stringify(value); });
  await expect(skip(page)).toBeHidden();
});

test("unseekable ends and the disabled setting hide the button", async ({ page }) => {
  await seek(page, 4); await expect(skip(page)).toBeVisible();
  await page.evaluate(() => Object.defineProperty(document.querySelector("video"), "seekable", { configurable: true, get: () => ({ length: 1, start: () => 0, end: () => 5 }) }));
  await expect(skip(page)).toBeHidden();
  await page.evaluate(() => browser.storage.local.set({ enabled: false }));
  await expect(skip(page)).toBeHidden();
});

test("discovers a player moved into an open shadow root", async ({ page }) => {
  await page.evaluate(() => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const video = document.querySelector("video");
    root.append(video); video.style.cssText = "width:900px;height:500px;display:block";
    document.querySelector("#player").append(host);
    video.currentTime = 4;
  });
  await expect(skip(page)).toBeVisible();
  await skip(page).click();
  await expect.poll(() => page.locator("video").evaluate(v => v.currentTime)).toBe(9);
});

test("works inside a newly inserted frame and removes stale overlays", async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector("video").remove();
    const frame = document.createElement("iframe"); frame.src = "/?embedded=1";
    frame.width = "1000"; frame.height = "1100"; document.body.prepend(frame);
  });
  await expect(skip(page)).toBeHidden();
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForSelector("video");
  await installVideo(frame);
  await frame.addScriptTag({ url: "/core.js" });
  await frame.addScriptTag({ url: "/content.js" });
  await frame.locator("video").scrollIntoViewIfNeeded();
  await seek(frame, 4); await expect(skip(frame)).toBeVisible();
  await skip(frame).click();
  await expect.poll(() => frame.locator("video").evaluate(v => v.currentTime)).toBe(9);
});

test("popup uses the English automatic-only design", async ({ page }) => {
  await page.goto("/popup.html");
  await expect(page.getByRole("switch")).toBeChecked();
  await page.locator("label.toggle").click();
  await expect(page.locator("#state")).toHaveText("Detection is paused");
  await page.locator("label.toggle").click();
  await page.setViewportSize({ width: 352, height: 490 });
  await page.screenshot({ path: "artifacts/popup.png" });
});
