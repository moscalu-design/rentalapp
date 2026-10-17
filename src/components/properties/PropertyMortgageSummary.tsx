import Link from "next/link";
import {
  getCurrentBalance,
  getMonthlyCostForMonth,
  getMortgageOverview,
  type MortgageRecord,
} from "@/lib/mortgage";
import { formatCurrency } from "@/lib/utils";

function nearestPayoffDate(mortgages: MortgageRecord[]): Date | null {
  const dates = mortgages
    .filter((mortgage) => mortgage.isActive)
    .map((mortgage) => getMortgageOverview(mortgage, "actual").payoffDate)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => a.getTime() - b.getTime());

  return dates[0] ?? null;
}

function formatMonthYear(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function PropertyMortgageSummary({
  propertyId,
  mortgages,
}: {
  propertyId: string;
  mortgages: MortgageRecord[];
}) {
  const now = new Date();
  const totalMonthlyOutflow = mortgages.reduce(
    (sum, mortgage) =>
      sum + getMonthlyCostForMonth(mortgage, now.getFullYear(), now.getMonth() + 1),
    0
  );
  const totalOutstanding = mortgages.reduce(
    (sum, mortgage) => sum + getCurrentBalance(mortgage, "actual"),
    0
  );
  const nearestPayoff = nearestPayoffDate(mortgages);

  return (
    <div data-testid="property-mortgage-summary" className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-sm font-semibold text-foreground">Mortgages</h2>
        <Link
          href={`/properties/${propertyId}/mortgages`}
          className="text-xs text-primary hover:text-primary font-medium shrink-0"
        >
          View all →
        </Link>
      </div>

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 mt-4">
        <div className="min-w-0 py-1">
          <dt className="text-xs text-muted-foreground">Mortgages</dt>
          <dd className="mt-1 text-lg font-bold text-foreground">{mortgages.length}</dd>
        </div>
        <div className="min-w-0 py-1">
          <dt className="text-xs text-muted-foreground">Monthly outflow</dt>
          <dd className="mt-1 text-lg font-bold text-foreground">{formatCurrency(totalMonthlyOutflow)}</dd>
        </div>
        <div className="min-w-0 py-1">
          <dt className="text-xs text-muted-foreground">Outstanding balance</dt>
          <dd className="mt-1 text-lg font-bold text-foreground">{formatCurrency(totalOutstanding)}</dd>
        </div>
        <div className="min-w-0 py-1">
          <dt className="text-xs text-muted-foreground">Nearest payoff</dt>
          <dd className="mt-1 text-lg font-bold text-foreground">{formatMonthYear(nearestPayoff)}</dd>
        </div>
      </dl>
    </div>
  );
}
