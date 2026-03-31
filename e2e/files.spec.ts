import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { createTenant, deleteTenant, requireDestructive } from "./helpers/crud";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

test("document upload flow supports upload, refresh, delete, and re-upload on a test tenant", async ({ page }) => {
  test.setTimeout(90_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  let tenantUrl: string | null = null;

  await login(page);
  monitor.reset();

  const tenant = await createTenant(page);
  tenantUrl = tenant.url;

  try {
    monitor.reset();
    await page.goto(tenantUrl, { waitUntil: "networkidle" });
    const slot = page.getByTestId("document-slot-idDocument");
    const fileInput = page.getByTestId("document-input-idDocument");

    await fileInput.setInputFiles({
      name: `crud-file-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from("crud file"),
    });
    await expect(slot.getByText(/crud-file-/)).toBeVisible({ timeout: 15_000 });
    await assertAppHealthy(page, monitor, "document uploaded");

    monitor.reset();
    await page.reload({ waitUntil: "networkidle" });
    await expect(slot.getByText(/crud-file-/)).toBeVisible({ timeout: 15_000 });
    await assertAppHealthy(page, monitor, "document persisted after reload");

    monitor.reset();
    await slot.getByTitle("Delete").click();
    await slot.getByRole("button", { name: "Yes" }).click();
    await expect(slot.getByText(/crud-file-/)).toHaveCount(0, { timeout: 15_000 });
    await assertAppHealthy(page, monitor, "document deleted");

    monitor.reset();
    await fileInput.setInputFiles({
      name: `crud-file-${Date.now()}-again.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from("crud file again"),
    });
    await expect(slot.getByText(/again\.pdf$/)).toBeVisible({ timeout: 15_000 });
    await assertAppHealthy(page, monitor, "document re-uploaded");
  } finally {
    if (tenantUrl) {
      monitor.reset();
      await page.goto(tenantUrl, { waitUntil: "networkidle" });
      const slot = page.getByTestId("document-slot-idDocument");
      if (await slot.getByTitle("Delete").count()) {
        await slot.getByTitle("Delete").click();
        await slot.getByRole("button", { name: "Yes" }).click();
        await expect(slot.getByTitle("Delete")).toHaveCount(0, { timeout: 15_000 });
      }

      monitor.reset();
      await deleteTenant(page, tenantUrl);
      await assertAppHealthy(page, monitor, "tenant deleted after file flow");
    }
  }
});
