import { expect, test, type Locator, type Page } from "@playwright/test";
import { login } from "./helpers/auth";
import { E2E_BASE_URL } from "./helpers/env";
import { archiveProperty, createProperty, createRoom, createTenant, deleteTenant, requireDestructive } from "./helpers/crud";

async function submitPayment(page: Page, button: Locator) {
  const origin = new URL(page.url()).origin;
  const response = page.waitForResponse((result) =>
    result.request().method() === "POST" && new URL(result.url()).origin === origin,
    { timeout: 15_000 },
  );
  await button.click();
  expect((await response).ok()).toBe(true);
  await expect(button).toBeEnabled();
}

// This creates disposable fixtures and must never run against a hosted account.
test("payment forms keep periods separate and preserve cumulative receipts", async ({ page }) => {
  test.skip(!["127.0.0.1", "localhost", "[::1]"].includes(new URL(E2E_BASE_URL).hostname), "Local database only.");
  requireDestructive();
  test.setTimeout(180_000);
  await login(page);
  const property = await createProperty(page);
  const room = await createRoom(page, property.id, { monthlyRent: "1000", depositAmount: "1000" });
  const tenant = await createTenant(page);
  const today = new Date();
  const month = new Date(today.getFullYear(), today.getMonth(), 1);
  const leaseStart = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;
  const currentPeriod = `${month.getFullYear()}-${month.getMonth() + 1}`;
  const upcoming = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const upcomingPeriod = `${upcoming.getFullYear()}-${upcoming.getMonth() + 1}`;
  const currentLabel = month.toLocaleString("en-GB", { month: "long", year: "numeric" });

  try {
    await page.goto(room.url);
    await page.getByTestId("room-add-tenant-button").click();
    const modal = page.getByTestId("add-tenant-modal");
    await modal.getByTestId("assign-tenant-select").selectOption(tenant.id);
    await modal.locator('input[name="leaseStart"]').fill(leaseStart);
    await modal.getByTestId("assign-tenant-submit").click();
    const period = page.getByLabel("Rent period", { exact: true });
    await expect(period).toBeVisible();
    await period.selectOption(currentPeriod);
    await page.getByLabel("Total received (€)", { exact: true }).fill("123");
    await page.getByLabel("Notes", { exact: true }).fill("Draft for this month only");

    // Switching period must discard uncontrolled input state from the old payment.
    await period.selectOption(upcomingPeriod);
    await expect(page.getByLabel("Total received (€)", { exact: true })).toHaveValue("1000");
    await expect(page.getByLabel("Notes", { exact: true })).toHaveValue("");
    await period.selectOption(currentPeriod);
    await page.getByLabel("Total received (€)", { exact: true }).fill("400");
    await page.getByLabel("Payment method", { exact: true }).selectOption("BANK_TRANSFER");
    await page.getByLabel("Notes", { exact: true }).fill("First installment");
    await submitPayment(page, page.getByTestId("record-payment-submit"));
    await expect(page.locator("tbody tr").filter({ hasText: currentLabel })).toContainText("€400");

    await page.goto(`/properties/${property.id}/payments`);
    await page.getByTestId("property-payments-filter-partial").click();
    const row = page.getByTestId("property-payment-row").filter({ hasText: currentLabel });
    await row.getByTestId("property-payment-record").click();
    // €1,000 due minus €400 received is €600 outstanding; the saved field is
    // cumulative receipts, so its safe default must remain €400, never €600.
    await expect(row.getByLabel("Total received (€)", { exact: true })).toHaveValue("400");
    await expect(row.getByLabel("Payment method", { exact: true })).toHaveValue("BANK_TRANSFER");
    await expect(row.getByLabel("Notes", { exact: true })).toHaveValue("First installment");
    await row.getByLabel("Reference", { exact: true }).fill("RENT-INITIAL");
    await submitPayment(page, row.getByTestId("property-payment-save"));
    await expect(row).toContainText("€400");
    await page.reload();
    await page.getByTestId("property-payments-filter-partial").click();
    await expect(row).toContainText("€400");
    await expect(row).toContainText("€600");

    // Updating the same rent period through the room form retains receipt metadata.
    await page.goto(room.url);
    await page.getByLabel("Rent period", { exact: true }).selectOption(currentPeriod);
    await expect(page.getByLabel("Total received (€)", { exact: true })).toHaveValue("400");
    await expect(page.getByLabel("Payment method", { exact: true })).toHaveValue("BANK_TRANSFER");
    await expect(page.getByLabel("Notes", { exact: true })).toHaveValue("First installment");
    await expect(page.locator('input[name="reference"]')).toHaveValue("RENT-INITIAL");
    await page.getByLabel("Total received (€)", { exact: true }).fill("1000");
    await submitPayment(page, page.getByTestId("record-payment-submit"));
    await expect(page.locator("tbody tr").filter({ hasText: currentLabel })).toContainText("Paid");
    await page.goto(`/properties/${property.id}/payments`);
    const paidRow = page.getByTestId("property-payment-row").filter({ hasText: currentLabel });
    await expect(paidRow).toContainText("€1,000");
    await expect(paidRow).toContainText("Paid");
  } finally {
    await page.goto(room.url).catch(() => undefined);
    if (!page.isClosed() && await page.getByTestId("end-tenancy-btn").count().catch(() => 0)) {
      await page.getByTestId("end-tenancy-btn").click();
      await page.getByTestId("confirm-end-tenancy-btn").click();
      await expect(page.getByTestId("room-vacant-state")).toBeVisible();
    }
    await deleteTenant(page, tenant.url).catch(() => undefined);
    await archiveProperty(page, property.url).catch(() => undefined);
  }
});
