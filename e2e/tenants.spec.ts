import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { createTenant, deleteTenant, escapeRegExp, requireDestructive } from "./helpers/crud";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

test("tenant CRUD flow creates, edits, refreshes, and deletes safely", async ({ page }) => {
  test.setTimeout(90_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  let tenantUrl: string | null = null;
  let fullName = "";

  await login(page);
  monitor.reset();

  await page.goto("/tenants/new", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Create Tenant" }).click();
  await expect
    .poll(async () => page.locator('input[name="firstName"]').evaluate((node) => !(node as HTMLInputElement).checkValidity()))
    .toBe(true);

  const tenant = await createTenant(page);
  tenantUrl = tenant.url;
  fullName = `${tenant.firstName} ${tenant.lastName}`;
  await assertAppHealthy(page, monitor, "tenant created");

  try {
    monitor.reset();
    await page.goto("/tenants", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: new RegExp(escapeRegExp(fullName)) })).toBeVisible();
    await assertAppHealthy(page, monitor, "tenants list after create");

    monitor.reset();
    await page.goto(`${tenantUrl}/edit`, { waitUntil: "networkidle" });
    await page.locator('input[name="phone"]').fill("+44 7700 123456");
    await page.locator('select[name="status"]').selectOption("PENDING");
    await page.locator('textarea[name="notes"]').fill(`${tenant.notes}\nEdited by tenant CRUD test`);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Edited by tenant CRUD test")).toBeVisible();
    await expect(page.getByText("+44 7700 123456")).toBeVisible();
    await expect(page.getByText("Pending")).toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText("Edited by tenant CRUD test")).toBeVisible();
    await assertAppHealthy(page, monitor, "tenant edit persisted");

    monitor.reset();
    await page.goto(`${tenantUrl}/edit`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(new URL(tenantUrl).pathname)}$`));
    await assertAppHealthy(page, monitor, "tenant edit cancel");
  } finally {
    if (tenantUrl) {
      monitor.reset();
      await deleteTenant(page, tenantUrl);
      await expect(page.getByRole("link", { name: new RegExp(escapeRegExp(fullName)) })).toHaveCount(0);
      await assertAppHealthy(page, monitor, "tenant deleted");
    }
  }
});
