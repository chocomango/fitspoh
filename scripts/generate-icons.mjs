import { chromium } from "@playwright/test";
import fs from "node:fs";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.FITSPOH_BROWSER ??
    (process.platform === "win32"
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : undefined),
});
try {
  const page = await browser.newPage();
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${fs.readFileSync("public/icon.svg", "utf8")}`,
    );
    await page.screenshot({
      path: `public/icon-${size}.png`,
      omitBackground: true,
    });
  }
  console.log("Generated install icons.");
} finally {
  await browser.close();
}
