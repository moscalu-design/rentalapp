import { describe, expect, it } from "vitest";
import {
  calculateAmortizingMonthlyPayment,
  calculateBulletMonthlyPayment,
  getMonthlyBreakdown,
  getMortgageAnnualData,
  getMortgageBalanceComparisonData,
  getMortgageOverview,
  getMortgageSchedule,
  simulateMortgageOverpayment,
  simulateMortgageScenario,
  type MortgageRecord,
} from "../mortgage";
import { buildChartData } from "@/components/properties/propertyPerformanceData";

function createMortgage(overrides?: Partial<MortgageRecord>): MortgageRecord {
  return {
    id: "mortgage-1",
    type: "amortizing",
    startDate: new Date("2026-01-01"),
    termMonths: 24,
    initialBalance: 12000,
    interestRate: 12,
    monthlyPayment: 564.87,
    isActive: true,
    ...overrides,
  };
}

describe("mortgage calculations", () => {
  it("calculates a standard amortizing monthly payment", () => {
    expect(calculateAmortizingMonthlyPayment(100000, 6, 360)).toBeCloseTo(599.55, 2);
  });

  it("handles zero-interest amortizing mortgages", () => {
    expect(calculateAmortizingMonthlyPayment(12000, 0, 24)).toBe(500);
  });

  it("calculates a bullet mortgage interest-only payment", () => {
    expect(calculateBulletMonthlyPayment(12000, 6)).toBe(60);
  });
});

describe("bullet mortgage breakdowns", () => {
  const bullet = createMortgage({
    type: "bullet",
    interestRate: 6,
    initialBalance: 12000,
    termMonths: 12,
    monthlyPayment: 60,
  });

  it("keeps principal unchanged until maturity", () => {
    const firstMonth = getMonthlyBreakdown(bullet, 2026, 1);
    expect(firstMonth).not.toBeNull();
    expect(firstMonth?.payment).toBe(60);
    expect(firstMonth?.interest).toBe(60);
    expect(firstMonth?.principal).toBe(0);
    expect(firstMonth?.balloonPayment).toBe(0);
    expect(firstMonth?.balanceAfter).toBe(12000);
  });

  it("repays principal as a balloon payment at maturity", () => {
    const finalMonth = getMonthlyBreakdown(bullet, 2026, 12);
    expect(finalMonth).not.toBeNull();
    expect(finalMonth?.interest).toBe(60);
    expect(finalMonth?.principal).toBe(12000);
    expect(finalMonth?.balloonPayment).toBe(12000);
    expect(finalMonth?.payment).toBe(12060);
    expect(finalMonth?.chartPayment).toBe(60);
  });

  it("suppresses the balloon principal from the default annual chart series", () => {
    const annual = getMortgageAnnualData(bullet);
    expect(annual).toHaveLength(1);
    expect(annual[0]).toMatchObject({
      totalInterest: 720,
      totalPrincipal: 12000,
      chartPrincipal: 0,
      chartPayments: 720,
      balloonPrincipalExcluded: 12000,
      endBalance: 0,
    });
  });
});

describe("property cost integration", () => {
  it("includes bullet balloon repayment in the maturity month cost model", () => {
    const now = new Date();
    const maturityMonthMortgage = createMortgage({
      type: "bullet",
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      termMonths: 1,
      initialBalance: 10000,
      interestRate: 12,
      monthlyPayment: 100,
    });

    const data = buildChartData([], [], [maturityMonthMortgage]);
    expect(data.at(-1)?.costs).toBe(10100);
    expect(data.at(-1)?.profit).toBe(-10100);
  });
});

describe("overpayment simulation", () => {
  it("shows an earlier payoff and lower interest when paying more", () => {
    const mortgage = createMortgage({
      startDate: new Date(new Date().getFullYear(), new Date().getMonth() - 6, 1),
      termMonths: 60,
      initialBalance: 25000,
      interestRate: 5,
      monthlyPayment: calculateAmortizingMonthlyPayment(25000, 5, 60),
    });

    const simulation = simulateMortgageOverpayment(mortgage, mortgage.monthlyPayment + 150);
    expect(simulation).not.toBeNull();
    expect(simulation?.simulatedMonthsRemaining).toBeLessThan(
      simulation?.baselineMonthsRemaining ?? 0
    );
    expect(simulation?.simulatedRemainingInterest).toBeLessThan(
      simulation?.baselineRemainingInterest ?? 0
    );
    expect(simulation?.interestSavings).toBeGreaterThan(0);
  });

  it("supports an optional lump-sum prepayment in the simulation", () => {
    const mortgage = createMortgage({
      startDate: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1),
      termMonths: 72,
      initialBalance: 50000,
      interestRate: 4.5,
      monthlyPayment: calculateAmortizingMonthlyPayment(50000, 4.5, 72),
    });

    const baseline = simulateMortgageOverpayment(mortgage, mortgage.monthlyPayment + 100);
    const withLumpSum = simulateMortgageOverpayment(mortgage, mortgage.monthlyPayment + 100, {
      lumpSumPayment: 5000,
      lumpSumMonthOffset: 3,
    });

    expect(baseline).not.toBeNull();
    expect(withLumpSum).not.toBeNull();
    expect(withLumpSum?.monthsSaved).toBeGreaterThan(baseline?.monthsSaved ?? 0);
    expect(withLumpSum?.interestSavings).toBeGreaterThan(baseline?.interestSavings ?? 0);
    expect(withLumpSum?.lumpSumPayment).toBe(5000);
    expect(withLumpSum?.lumpSumMonthOffset).toBe(3);
  });
});

describe("actual prepayments and overlays", () => {
  it("recalculates the actual schedule when a one-off prepayment exists", () => {
    const mortgage = createMortgage({
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      termMonths: 60,
      initialBalance: 30000,
      interestRate: 5,
      monthlyPayment: calculateAmortizingMonthlyPayment(30000, 5, 60),
      prepayments: [
        {
          id: "prep-1",
          mortgageId: "mortgage-1",
          type: "one_off",
          amount: 4000,
          startDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
          isActive: true,
        },
      ],
    });

    const baselineOverview = getMortgageOverview(mortgage, "baseline");
    const actualOverview = getMortgageOverview(mortgage, "actual");

    expect(actualOverview.payoffDate?.getTime()).toBeLessThan(
      baselineOverview.payoffDate?.getTime() ?? Number.MAX_SAFE_INTEGER
    );
    expect(actualOverview.totalProjectedInterest).toBeLessThan(
      baselineOverview.totalProjectedInterest
    );
  });

  it("keeps simulation separate from actual saved prepayments", () => {
    const now = new Date();
    const mortgage = createMortgage({
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      termMonths: 60,
      initialBalance: 30000,
      interestRate: 5,
      monthlyPayment: calculateAmortizingMonthlyPayment(30000, 5, 60),
      prepayments: [
        {
          id: "prep-1",
          mortgageId: "mortgage-1",
          type: "recurring",
          amount: 50,
          startDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
          endDate: null,
          frequency: "monthly",
          isActive: true,
        },
      ],
    });

    const baselineSchedule = getMortgageSchedule(mortgage, "baseline");
    const actualSchedule = getMortgageSchedule(mortgage, "actual");
    const simulation = simulateMortgageScenario(mortgage, {
      mode: "recurring_extra",
      startDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      extraRecurringAmount: 150,
    });
    const comparison = getMortgageBalanceComparisonData(mortgage, simulation?.scenario);

    expect(actualSchedule.at(-1)?.date.getTime()).toBeLessThan(
      baselineSchedule.at(-1)?.date.getTime() ?? Number.MAX_SAFE_INTEGER
    );
    expect(simulation).not.toBeNull();
    expect(simulation?.simulatedPayoffDate?.getTime()).toBeLessThan(
      actualSchedule.at(-1)?.date.getTime() ?? Number.MAX_SAFE_INTEGER
    );
    expect(comparison.some((point) => point.actualBalance !== point.baselineBalance)).toBe(true);
    expect(comparison.some((point) => point.simulatedBalance !== point.actualBalance)).toBe(true);
  });

  it("caps extra prepayments near payoff instead of pushing the balance negative", () => {
    const mortgage = createMortgage({
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      termMonths: 6,
      initialBalance: 600,
      interestRate: 0,
      monthlyPayment: 100,
      prepayments: [
        {
          id: "prep-1",
          mortgageId: "mortgage-1",
          type: "one_off",
          amount: 1000,
          startDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
          isActive: true,
        },
      ],
    });

    const schedule = getMortgageSchedule(mortgage, "actual");
    expect(schedule[1].balanceAfter).toBe(0);
    expect(schedule[1].extraPrepayment).toBe(400);
  });
});
