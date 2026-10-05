import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173/fitspoh/",
    headless: true,
    launchOptions: {
      executablePath:
        process.env.FITSPOH_BROWSER ??
        (process.platform === "win32"
          ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
          : undefined),
    },
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "node scripts/preview.mjs",
    url: "http://127.0.0.1:4173/fitspoh/",
    reuseExistingServer: true,
  },
});
