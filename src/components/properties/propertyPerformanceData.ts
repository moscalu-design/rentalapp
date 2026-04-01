import { isMortgageActiveInMonth, type MortgageRecord } from "@/lib/mortgage";

export type ChartMonth = {
  label: string;
  costs: number;
  profit: number;
};

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function buildChartData(
  expenses: Array<{ reportingYear: number; reportingMonth: number; amount: number }>,
  payments: Array<{ periodYear: number; periodMonth: number; amountDue: number }>,
  mortgages: MortgageRecord[] = []
): ChartMonth[] {
  const now = new Date();

  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    const expenseCosts = expenses
      .filter((e) => e.reportingYear === year && e.reportingMonth === month)
      .reduce((sum, e) => sum + e.amount, 0);

    const mortgageCosts = mortgages
      .filter((m) => isMortgageActiveInMonth(m, year, month))
      .reduce((sum, m) => sum + m.monthlyPayment, 0);

    const costs = expenseCosts + mortgageCosts;

    const income = payments
      .filter((p) => p.periodYear === year && p.periodMonth === month)
      .reduce((sum, p) => sum + p.amountDue, 0);

    return {
      label: MONTH_SHORT[month - 1],
      costs,
      profit: income - costs,
    };
  });
}
