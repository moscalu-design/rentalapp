import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import {
  archiveProperty,
  createProperty,
  createRoom,
  createTenant,
  deleteRoom,
  deleteTenant,
  requireDestructive,
} from "./helpers/crud";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

test("payment flow creates relationship-backed payments and records updates safely", async ({ page }) => {
  test.setTimeout(120_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  let propertyUrl: string | null = null;
  let roomUrl: string | null = null;
  let tenantUrl: string | null = null;
  let tenantName = "";

  await login(page);
  monitor.reset();

  const property = await createProperty(page);
  propertyUrl = property.url;
  const room = await createRoom(page, property.id, { monthlyRent: "1111", depositAmount: "1111" });
  roomUrl = room.url;
  const tenant = await createTenant(page);
  tenantUrl = tenant.url;
  tenantName = `${tenant.firstName} ${tenant.lastName}`;

  try {
    monitor.reset();
    await page.goto(roomUrl, { waitUntil: "networkidle" });
    await page.locator('select[name="tenantId"]').selectOption(tenant.id);
    await page.getByRole("button", { name: "Assign Tenant" }).click();
    await expect(page.getByRole("heading", { name: "Current Tenant" })).toBeVisible();
    await expect(page.getByText(tenantName)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Record Payment" })).toBeVisible();
    await expect(page.getByTestId("delete-room-button")).toHaveCount(0);
    await assertAppHealthy(page, monitor, "tenant assigned and payment created");

    monitor.reset();
    await page.goto("/payments", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: new RegExp(tenantName) })).toBeVisible();
    await assertAppHealthy(page, monitor, "payments list shows created occupancy payment");

    monitor.reset();
    await page.goto(roomUrl, { waitUntil: "networkidle" });
    const amountInput = page.locator('input[name="amountPaid"]');
    await amountInput.fill("1111");
    await page.locator('select[name="paymentMethod"]').selectOption("BANK_TRANSFER");
    await page.getByRole("button", { name: "Record Payment" }).click();
    await expect
      .poll(async () => page.locator('input[name="amountPaid"]').inputValue())
      .toBe("1111");
    await expect(page.locator("tbody tr").first()).toContainText("£1,111");
    await expect(page.locator("tbody tr").first()).toContainText("Paid");
    await assertAppHealthy(page, monitor, "payment recorded");

    monitor.reset();
    await page.goto(tenantUrl, { waitUntil: "networkidle" });
    await expect(page.getByText(property.name)).toBeVisible();
    await expect(page.getByText(room.name)).toBeVisible();
    await assertAppHealthy(page, monitor, "tenant detail relationship integrity");
  } finally {
    if (roomUrl) {
      monitor.reset();
      await page.goto(roomUrl, { waitUntil: "networkidle" });
      if (await page.getByRole("button", { name: "End Tenancy" }).count()) {
        page.once("dialog", (dialog) => dialog.accept());
        await page.getByRole("button", { name: "End Tenancy" }).click();
        await expect(page.getByRole("heading", { name: "Assign Tenant" })).toBeVisible();
      }
      await assertAppHealthy(page, monitor, "tenancy ended for cleanup");

      monitor.reset();
      await deleteRoom(page, roomUrl);
      await assertAppHealthy(page, monitor, "room deleted after payment flow");
    }

    if (tenantUrl) {
      monitor.reset();
      await deleteTenant(page, tenantUrl);
      await assertAppHealthy(page, monitor, "tenant deleted after payment flow");
    }

    if (propertyUrl) {
      monitor.reset();
      await archiveProperty(page, propertyUrl);
      await assertAppHealthy(page, monitor, "property archived after payment flow");
    }
  }
});
