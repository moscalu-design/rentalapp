import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { archiveProperty, createProperty, escapeRegExp, requireDestructive } from "./helpers/crud";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

test("property CRUD flow creates, edits, validates, manages utility costs, and archives safely", async ({ page }) => {
  test.setTimeout(90_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  let propertyUrl: string | null = null;
  let propertyName = "";

  await login(page);
  monitor.reset();

  await page.goto("/properties/new", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Create Property" }).click();
  await expect
    .poll(async () => page.locator('input[name="name"]').evaluate((node) => !(node as HTMLInputElement).checkValidity()))
    .toBe(true);

  const created = await createProperty(page);
  propertyUrl = created.url;
  propertyName = created.name;
  await assertAppHealthy(page, monitor, "property created");

  try {
    monitor.reset();
    await page.goto("/properties", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: new RegExp(escapeRegExp(propertyName)) })).toBeVisible();
    await assertAppHealthy(page, monitor, "properties list after create");

    monitor.reset();
    await page.goto(`${propertyUrl}/edit`, { waitUntil: "networkidle" });
    await page.locator('textarea[name="notes"]').fill(`${created.notes}\nEdited by property CRUD test`);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Edited by property CRUD test")).toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText("Edited by property CRUD test")).toBeVisible();
    await assertAppHealthy(page, monitor, "property edit persisted");

    monitor.reset();
    await page.getByRole("button", { name: "+ Add Cost" }).click();
    await page.locator('select[name="type"]').selectOption("INTERNET");
    await page.locator('select[name="billingCycle"]').selectOption("MONTHLY");
    await page.locator('input[name="amount"]').fill("45");
    await page.locator('input[name="provider"]').fill("E2E ISP");
    await page.locator('input[name="notes"]').fill("crud utility");
    await page.getByRole("button", { name: "Add Cost" }).click();
    await expect(page.getByText("Internet · E2E ISP")).toBeVisible();
    await assertAppHealthy(page, monitor, "utility cost added");

    monitor.reset();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByTitle("Delete").click();
    await expect(page.getByText("Internet · E2E ISP")).toHaveCount(0);
    await assertAppHealthy(page, monitor, "utility cost deleted");

    monitor.reset();
    await page.goto(`${propertyUrl}/edit`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(new URL(propertyUrl).pathname)}$`));
    await assertAppHealthy(page, monitor, "property edit cancel");
  } finally {
    if (propertyUrl) {
      monitor.reset();
      await archiveProperty(page, propertyUrl);
      await expect(page.getByRole("link", { name: new RegExp(escapeRegExp(propertyName)) })).toHaveCount(0);
      await assertAppHealthy(page, monitor, "property archived");
    }
  }
});
