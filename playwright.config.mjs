import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: true,
  timeout: 30000,
  use: { baseURL: "http://127.0.0.1:4173", viewport: { width: 1280, height: 900 } },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }, { name: "firefox", use: { browserName: "firefox" } }],
  webServer: { command: "npm run demo", url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI },
  reporter: "list"
});
