import { expect, type Page } from "@playwright/test";

export async function readJournal(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("fitspoh", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<any>((resolve, reject) => {
        const tx = db.transaction("journal", "readonly");
        tx.onabort = () =>
          reject(tx.error ?? new Error("Journal read aborted."));
        const request = tx.objectStore("journal").get("state");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  });
}

export async function restoreJournal(page: Page, state: unknown) {
  await page.locator("input[type=file]").setInputFiles({
    name: "journal-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await page
    .getByRole("button", { name: "Replace and restore", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Restore your journal?", exact: true }),
  ).not.toBeAttached();
  await expect(page.locator(".storage-status")).toContainText(
    "Saved on this device",
  );
}
