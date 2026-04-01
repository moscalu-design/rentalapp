import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers/auth";
import { archiveProperty, createProperty, createRoom, requireDestructive } from "./helpers/crud";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

type MortgageInput = {
  label: string;
  type: "amortizing" | "bullet";
  startDate: string;
  termMonths: number;
  initialBalance: number;
  interestRate: number;
  lender?: string;
  notes?: string;
};

function isoMonthDate(offsetMonths: number): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offsetMonths);
  return date.toISOString().slice(0, 10);
}

function parseEuroAmount(value: string) {
  const match = value.match(/-?€[\d,]+(?:\.\d+)?/);
  if (!match) throw new Error(`Could not find euro amount in: ${value}`);
  return Number(match[0].replace("€", "").replaceAll(",", ""));
}

function calculatePayment(input: MortgageInput) {
  if (input.type === "bullet") {
    return Number((input.initialBalance * (input.interestRate / 100 / 12)).toFixed(2));
  }

  if (input.interestRate === 0) {
    return Number((input.initialBalance / input.termMonths).toFixed(2));
  }

  const monthlyRate = input.interestRate / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, input.termMonths);
  return Number(
    (
      (input.initialBalance * monthlyRate * factor) /
      (factor - 1)
    ).toFixed(2)
  );
}

function monthsUntil(startDate: string, months: number) {
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + months - 1);
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

async function editorModal(page: Page) {
  const edit = page.getByTestId("mortgage-edit-modal");
  if (await edit.count()) return edit;
  return page.getByTestId("mortgage-add-modal");
}

async function fillMortgageForm(page: Page, input: MortgageInput) {
  const modal = await editorModal(page);
  await modal.locator('input[name="label"]').fill(input.label);
  await modal.locator('select[name="type"]').selectOption(input.type);
  await modal.locator('input[name="startDate"]').fill(input.startDate);
  await modal.locator('input[name="termMonths"]').fill(String(input.termMonths));
  await modal.locator('input[name="initialBalance"]').fill(String(input.initialBalance));
  await modal.locator('input[name="interestRate"]').fill(String(input.interestRate));
  await modal.locator('input[name="lender"]').fill(input.lender ?? "");
  await modal.locator('textarea[name="notes"]').fill(input.notes ?? "");
}

async function addMortgage(page: Page, input: MortgageInput) {
  await page.getByRole("button", { name: "+ Add Mortgage" }).click();
  const modal = await editorModal(page);
  await expect(modal).toBeVisible();
  await fillMortgageForm(page, input);
  await expect(modal.locator('input[name="monthlyPaymentDisplay"]')).toHaveValue(
    new RegExp(`€${calculatePayment(input).toFixed(0)}|€${calculatePayment(input)}`)
  );
  await modal.getByRole("button", { name: "Add Mortgage" }).click();
  await expect(modal).toHaveCount(0);
}

async function mortgageCard(page: Page, label: string) {
  return page.locator('[data-testid^="mortgage-card-"]').filter({ hasText: label }).first();
}

async function openMortgageDetails(page: Page, label: string) {
  const card = await mortgageCard(page, label);
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Details" }).click();
  await expect(page.getByTestId("mortgage-details-modal")).toBeVisible();
}

async function openMortgageEdit(page: Page, label: string) {
  const card = await mortgageCard(page, label);
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByTestId("mortgage-edit-modal")).toBeVisible();
}

async function closeMortgageDetails(page: Page) {
  await page.getByTestId("mortgage-details-modal").getByRole("button", { name: "×" }).click();
  await expect(page.getByTestId("mortgage-details-modal")).toHaveCount(0);
}

async function expectProfit(page: Page, amount: number) {
  await expect
    .poll(async () => parseEuroAmount(await page.getByTestId("property-summary-profit-value").innerText()))
    .toBe(amount);
}

async function addCurrentMonthExpense(page: Page, amount: number, title: string) {
  const now = new Date();
  await page.getByTestId("expense-add-toggle").click();
  await page.getByTestId("expense-title-input").fill(title);
  await page.getByTestId("expense-category-select").selectOption("INSURANCE");
  await page.getByTestId("expense-amount-input").fill(String(amount));
  await page.getByTestId("expense-payment-date-input").fill(isoMonthDate(0));
  await page.getByTestId("expense-reporting-month-select").selectOption(String(now.getMonth() + 1));
  await page.getByTestId("expense-reporting-year-select").selectOption(String(now.getFullYear()));
  await page.getByTestId("expense-add-button").click();
}

test("mortgage module supports auto-payment, bullet logic, editing, simulation, and property finance integration", async ({
  page,
}) => {
  test.setTimeout(180_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  let propertyUrl: string | null = null;

  const now = Date.now();
  const amortizing: MortgageInput = {
    label: `E2E Main Mortgage ${now}`,
    type: "amortizing",
    startDate: isoMonthDate(0),
    termMonths: 24,
    initialBalance: 12000,
    interestRate: 12,
    lender: "E2E Bank A",
    notes: "Baseline amortizing mortgage",
  };
  const bullet: MortgageInput = {
    label: `E2E Bullet Mortgage ${now}`,
    type: "bullet",
    startDate: isoMonthDate(0),
    termMonths: 12,
    initialBalance: 12000,
    interestRate: 6,
    lender: "E2E Bullet Bank",
    notes: "Interest-only until maturity",
  };
  const futureBullet: MortgageInput = {
    label: `E2E Future Bullet ${now}`,
    type: "bullet",
    startDate: isoMonthDate(1),
    termMonths: 6,
    initialBalance: 6000,
    interestRate: 6,
  };

  const amortizingPayment = calculatePayment(amortizing);
  const bulletPayment = calculatePayment(bullet);

  await login(page);
  monitor.reset();

  const property = await createProperty(page, {
    name: `E2E Mortgage Property ${now}`,
    notes: "mortgage workflow fixture",
  });
  propertyUrl = property.url;

  try {
    await createRoom(page, property.id, {
      name: `E2E Mortgage Room ${now}`,
      monthlyRent: "1234",
      depositAmount: "1234",
    });

    monitor.reset();
    await page.goto(propertyUrl, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Mortgages" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add Mortgage" })).toBeVisible();
    await assertAppHealthy(page, monitor, "property page before mortgages");

    monitor.reset();
    await addMortgage(page, amortizing);
    await expect(await mortgageCard(page, amortizing.label)).toContainText("Amortizing");
    await expect(await mortgageCard(page, amortizing.label)).toContainText(`€${amortizingPayment}`);
    await expectProfit(page, -amortizingPayment);
    await assertAppHealthy(page, monitor, "after amortizing mortgage");

    monitor.reset();
    await addMortgage(page, bullet);
    await expect(await mortgageCard(page, bullet.label)).toContainText("Bullet");
    await expect(await mortgageCard(page, bullet.label)).toContainText("interest / month");
    await expectProfit(page, -(amortizingPayment + bulletPayment));
    await assertAppHealthy(page, monitor, "after bullet mortgage");

    monitor.reset();
    await openMortgageDetails(page, bullet.label);
    const details = page.getByTestId("mortgage-details-modal");
    const downloadPromise = page.waitForEvent("download");
    await details.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("schedule.csv");
    await expect(details).toContainText("Bullet");
    await expect(details).toContainText("Bullet");
    await expect(details).toContainText("Annual payment breakdown");
    await expect(details.locator("svg").first()).toBeVisible();
    await expect(details).toContainText("Chart note");
    await closeMortgageDetails(page);
    await assertAppHealthy(page, monitor, "bullet details");

    monitor.reset();
    await openMortgageEdit(page, amortizing.label);
    const edit = page.getByTestId("mortgage-edit-modal");
    await edit.locator('input[name="interestRate"]').fill("8.5");
    await edit.locator('input[name="termMonths"]').fill("36");
    await edit.locator('textarea[name="notes"]').fill("Edited during E2E");
    await expect(edit.locator('input[name="monthlyPaymentDisplay"]')).not.toHaveValue("");
    await edit.getByRole("button", { name: "Save Changes" }).click();
    await expect(edit).toHaveCount(0);
    await expect(await mortgageCard(page, amortizing.label)).toContainText("8.5%");
    await assertAppHealthy(page, monitor, "mortgage edit persisted");

    monitor.reset();
    await openMortgageDetails(page, amortizing.label);
    const startingProfit = parseEuroAmount(
      await page.getByTestId("property-summary-profit-value").innerText()
    );
    await page.getByTestId("open-simulation-button").click();
    await expect(page.getByTestId("mortgage-simulation-panel")).toBeVisible();
    await page.getByTestId("mortgage-balance-chart").scrollIntoViewIfNeeded();
    await page.getByTestId("mortgage-overpayment-input").fill("700");
    await expect(page.getByTestId("mortgage-balance-chart")).toBeVisible();
    await expect(page.getByText("Interest saved")).toBeVisible();
    await expectProfit(page, startingProfit);

    await page.getByTestId("mortgage-simulation-type").selectOption("recurring_extra");
    await page.getByTestId("mortgage-recurring-extra-input").fill("125");
    await page.getByTestId("mortgage-simulation-start-date").fill(isoMonthDate(0));
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByTestId("apply-simulation-button").click();
    await expect(page.getByTestId("mortgage-details-modal")).toContainText("Recurring plan");
    await closeMortgageDetails(page);
    await expectProfit(page, startingProfit - 125);
    await assertAppHealthy(page, monitor, "simulation apply and actual prepayment");

    monitor.reset();
    await openMortgageDetails(page, amortizing.label);
    await page.getByTestId("record-prepayment-button").click();
    const prepaymentModal = page.getByTestId("mortgage-prepayment-modal");
    await expect(prepaymentModal).toBeVisible();
    await prepaymentModal.locator('select').selectOption("one_off");
    await prepaymentModal.getByTestId("mortgage-prepayment-amount-input").fill("250");
    await prepaymentModal.getByTestId("mortgage-prepayment-start-date").fill(isoMonthDate(0));
    await prepaymentModal.getByRole("button", { name: "Record Prepayment" }).click();
    await expect(prepaymentModal).toHaveCount(0);
    await expect(page.getByTestId("mortgage-details-modal")).toContainText("One-off");
    await closeMortgageDetails(page);
    await expectProfit(page, startingProfit - 375);
    await assertAppHealthy(page, monitor, "overpayment simulator");

    monitor.reset();
    await addCurrentMonthExpense(page, 42, `E2E Mortgage Expense ${now}`);
    await expect(page.getByTestId("property-expenses-section")).toContainText("€42");
    await assertAppHealthy(page, monitor, "expense still works");

    monitor.reset();
    await addMortgage(page, futureBullet);
    await expect(await mortgageCard(page, futureBullet.label)).toContainText("Bullet");
    await assertAppHealthy(page, monitor, "future bullet mortgage");

    monitor.reset();
    await page.reload({ waitUntil: "networkidle" });
    await expect(await mortgageCard(page, bullet.label)).toContainText("Bullet");
    await expect(await mortgageCard(page, futureBullet.label)).toContainText("Bullet");
    await expect(page.getByTestId("property-rooms-section")).toBeVisible();
    await expect(page.getByTestId("property-expenses-section")).toBeVisible();
    await expectProfit(page, startingProfit - 417);
    await assertAppHealthy(page, monitor, "after reload");

    monitor.reset();
    await openMortgageDetails(page, bullet.label);
    await expect(page.getByTestId("mortgage-details-modal")).toContainText(monthsUntil(bullet.startDate, bullet.termMonths));
    await page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Remove mortgage" }).click();
    await expect(await mortgageCard(page, bullet.label)).toHaveCount(0);
    await assertAppHealthy(page, monitor, "bullet deleted");
  } finally {
    if (propertyUrl) {
      await archiveProperty(page, propertyUrl);
    }
  }
});
