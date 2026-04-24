import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers/auth";
import {
  archiveProperty,
  createProperty,
  createRoom,
  createTenant,
  deleteTenant,
  requireDestructive,
} from "./helpers/crud";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

// Date helpers compute dates relative to "today" in a timezone-safe way.
// Dates always use day 15 so that toISOString() on a positive-UTC-offset
// machine doesn't drift back into the previous month.
function monthOffsetISO(months: number): string {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() + months, 15);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-15`;
}

function monthOffsetLabel(months: number): string {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() + months, 15);
  return target.toLocaleString("en-GB", { month: "long", year: "numeric" });
}

async function endTenancy(page: Page, roomUrl: string) {
  await page.goto(roomUrl, { waitUntil: "networkidle" });
  if ((await page.getByTestId("end-tenancy-btn").count()) === 0) return;
  await page.getByTestId("end-tenancy-btn").click();
  await page.getByTestId("confirm-end-tenancy-btn").click();
  await expect(page.getByTestId("room-vacant-state")).toBeVisible({ timeout: 15_000 });
}

async function assignTenant(
  page: Page,
  opts: {
    tenantId: string;
    leaseStart: string;
    moveInDate?: string;
  },
) {
  await page.getByTestId("room-add-tenant-button").click();
  await expect(page.getByTestId("add-tenant-modal")).toBeVisible();

  await page.getByTestId("assign-tenant-select").selectOption(opts.tenantId);

  const modal = page.getByTestId("add-tenant-modal");
  await modal.locator('input[name="leaseStart"]').fill(opts.leaseStart);
  if (opts.moveInDate) {
    await modal.locator('input[name="moveInDate"]').fill(opts.moveInDate);
  }

  await page.getByTestId("assign-tenant-submit").click();
  await expect(page.getByRole("heading", { name: "Current Tenant" })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("payment flow — effective billing start", () => {
  test("standard aligned lease: backfills past months and records a payment for the current period", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    requireDestructive();
    const monitor = attachAppMonitor(page);

    await login(page);
    monitor.reset();

    const property = await createProperty(page);
    const room = await createRoom(page, property.id, {
      monthlyRent: "900",
      depositAmount: "900",
    });
    const tenant = await createTenant(page);

    try {
      await page.goto(room.url, { waitUntil: "networkidle" });
      await assignTenant(page, {
        tenantId: tenant.id,
        leaseStart: monthOffsetISO(-2), // two months ago
      });
      await assertAppHealthy(page, monitor, "standard assign tenant");

      // Payment history should contain the two past months + the current month + one upcoming month.
      await expect(page.getByRole("heading", { name: "Payment History" })).toBeVisible();
      await expect(page.locator("tbody tr")).toHaveCount(4);

      // Record Payment defaults to current month (a payment record exists for it).
      const amountInput = page.locator('input[name="amountPaid"]');
      await expect(amountInput).toBeVisible();
      await amountInput.fill("900");
      await page.locator('select[name="paymentMethod"]').selectOption("BANK_TRANSFER");
      await page.getByRole("button", { name: "Record Payment" }).click();

      // The current-month row should now be Paid even though an upcoming month is also visible.
      const currentRow = page.locator("tbody tr").filter({ hasText: monthOffsetLabel(0) });
      await expect(currentRow.getByTestId("payment-history-paid")).toContainText("€900", {
        timeout: 15_000,
      });
      await expect(currentRow).toContainText("Paid");
      await page.reload({ waitUntil: "networkidle" });
      await expect(page.locator('input[name="amountPaid"]')).toHaveValue("900");
      await assertAppHealthy(page, monitor, "standard payment recorded");
    } finally {
      await endTenancy(page, room.url).catch(() => undefined);
      await deleteTenant(page, tenant.url).catch(() => undefined);
      await archiveProperty(page, property.url).catch(() => undefined);
    }
  });

  test("move-in date does not create an earlier billing period than lease start", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    requireDestructive();
    const monitor = attachAppMonitor(page);

    await login(page);
    monitor.reset();

    const property = await createProperty(page);
    const room = await createRoom(page, property.id, {
      monthlyRent: "1000",
      depositAmount: "1000",
    });
    const tenant = await createTenant(page);

    try {
      await page.goto(room.url, { waitUntil: "networkidle" });
      await assignTenant(page, {
        tenantId: tenant.id,
        leaseStart: monthOffsetISO(1),
        moveInDate: monthOffsetISO(0),
      });
      await assertAppHealthy(page, monitor, "lease-start billing assign tenant");

      // Exactly one payment should exist — for the lease-start month only.
      await expect(page.locator("tbody tr")).toHaveCount(1);
      await expect(page.locator("tbody tr").first()).toContainText(monthOffsetLabel(1));

      // Record-payment form defaults to that upcoming lease-start period.
      const amountInput = page.locator('input[name="amountPaid"]');
      await expect(amountInput).toBeVisible();
      await amountInput.fill("1000");
      await page.locator('select[name="paymentMethod"]').selectOption("BANK_TRANSFER");
      await page.getByRole("button", { name: "Record Payment" }).click();

      const firstRow = page.locator("tbody tr").first();
      await expect(firstRow.getByTestId("payment-history-paid")).toContainText("€1,000", {
        timeout: 15_000,
      });
      await expect(firstRow).toContainText("Paid");
      await assertAppHealthy(page, monitor, "lease-start billing payment recorded");
    } finally {
      await endTenancy(page, room.url).catch(() => undefined);
      await deleteTenant(page, tenant.url).catch(() => undefined);
      await archiveProperty(page, property.url).catch(() => undefined);
    }
  });

  test("future-start lease: creates a single upcoming payment, no record for today", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    requireDestructive();
    const monitor = attachAppMonitor(page);

    await login(page);
    monitor.reset();

    const property = await createProperty(page);
    const room = await createRoom(page, property.id, {
      monthlyRent: "1100",
      depositAmount: "1100",
    });
    const tenant = await createTenant(page);

    try {
      await page.goto(room.url, { waitUntil: "networkidle" });
      await assignTenant(page, {
        tenantId: tenant.id,
        // Lease starts three months in the future, no move-in date yet.
        leaseStart: monthOffsetISO(3),
      });
      await assertAppHealthy(page, monitor, "future lease assign tenant");

      // Exactly one payment record should exist, for the future lease-start period.
      await expect(page.locator("tbody tr")).toHaveCount(1);
      const onlyRow = page.locator("tbody tr").first();
      await expect(onlyRow).toContainText(monthOffsetLabel(3));
      await expect(onlyRow).toContainText("Unpaid");

      // Record Payment auto-selects the future period (only selectable record).
      const periodSelect = page.locator("select").first();
      await expect(periodSelect).toBeVisible();
      const selectedLabel = (
        await periodSelect.locator("option:checked").textContent()
      )?.trim();
      expect(selectedLabel).toBe(monthOffsetLabel(3));
      await expect(page.locator('input[name="amountPaid"]')).toBeVisible();

      // Selecting the current month should explicitly show "no record" — the
      // lease has not yet started, so no payment exists for today.
      await periodSelect.selectOption({ label: monthOffsetLabel(0) });
      await expect(
        page.getByText("No payment record found for this period."),
      ).toBeVisible();
      await expect(page.locator('input[name="amountPaid"]')).toHaveCount(0);

      await assertAppHealthy(page, monitor, "future lease assertions");
    } finally {
      await endTenancy(page, room.url).catch(() => undefined);
      await deleteTenant(page, tenant.url).catch(() => undefined);
      await archiveProperty(page, property.url).catch(() => undefined);
    }
  });

  test("early payment can be assigned to the upcoming period without leaving it unpaid", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    requireDestructive();
    const monitor = attachAppMonitor(page);

    await login(page);
    monitor.reset();

    const property = await createProperty(page);
    const room = await createRoom(page, property.id, {
      monthlyRent: "950",
      depositAmount: "950",
    });
    const tenant = await createTenant(page);

    try {
      await page.goto(room.url, { waitUntil: "networkidle" });
      await assignTenant(page, {
        tenantId: tenant.id,
        leaseStart: monthOffsetISO(0),
      });
      await assertAppHealthy(page, monitor, "early payment tenancy assign");

      const amountInput = page.locator('input[name="amountPaid"]');
      await amountInput.fill("950");
      await page.locator('select[name="paymentMethod"]').selectOption("BANK_TRANSFER");
      await page.getByRole("button", { name: "Record Payment" }).click();

      const periodSelect = page.locator('select').first();
      await periodSelect.selectOption({ label: monthOffsetLabel(1) });
      await expect(page.getByTestId("selected-payment-summary")).toContainText(monthOffsetLabel(1));

      await page.locator('input[name="amountPaid"]').fill("950");
      await page.locator('input[name="paidAt"]').fill(monthOffsetISO(0));
      await page.getByRole("button", { name: "Record Payment" }).click();

      await expect(page.locator("tbody tr").filter({ hasText: monthOffsetLabel(1) })).toContainText("Paid");
      await assertAppHealthy(page, monitor, "early payment upcoming period recorded");
    } finally {
      await endTenancy(page, room.url).catch(() => undefined);
      await deleteTenant(page, tenant.url).catch(() => undefined);
      await archiveProperty(page, property.url).catch(() => undefined);
    }
  });
});
