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
    <div data-testid="property-mortgage-summary" className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-sm font-semibold text-slate-800">Mortgages</h2>
        <Link
          href={`/properties/${propertyId}/mortgages`}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0"
        >
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-lg font-bold text-slate-900">{mortgages.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Mortgages</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-lg font-bold text-slate-900">{formatCurrency(totalMonthlyOutflow)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Monthly outflow</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-lg font-bold text-slate-900">{formatCurrency(totalOutstanding)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Outstanding balance</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-lg font-bold text-slate-900">{formatMonthYear(nearestPayoff)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Nearest payoff</p>
        </div>
      </div>
    </div>
  );
}
