"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createExpense } from "@/actions/expenses";
import { getRecurringMonthlyTotal, getExpenseTotalForMonth } from "@/lib/expenses";
import { formatCurrency } from "@/lib/utils";
import { EXPENSE_CATEGORIES } from "@/lib/validations";

type Expense = {
  amount: number;
  category: string;
  recurrenceType: string;
  reportingYear: number;
  reportingMonth: number;
  coverageStart: Date | null;
  coverageEnd: Date | null;
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: string }> = {
  ELECTRICITY: { label: "Electricity", icon: "⚡" },
  GAS:         { label: "Gas",         icon: "🔥" },
  WATER:       { label: "Water",       icon: "💧" },
  HEATING:     { label: "Heating",     icon: "🌡️" },
  INTERNET:    { label: "Internet",    icon: "📶" },
  INSURANCE:   { label: "Insurance",   icon: "🛡️" },
  MAINTENANCE: { label: "Maintenance", icon: "🔧" },
  REPAIRS:     { label: "Repairs",     icon: "🔨" },
  CLEANING:    { label: "Cleaning",    icon: "🧹" },
  TAXES:       { label: "Taxes",       icon: "📋" },
  OTHER:       { label: "Other",       icon: "📎" },
};

// ─── Quick Add Modal ──────────────────────────────────────────────────────────

export function QuickAddCostModal({
  propertyId,
  onClose,
  todayInputValue,
}: {
  propertyId: string;
  onClose: () => void;
  todayInputValue: string;
}) {
  const router = useRouter();
  const [costType, setCostType] = useState<"one-off" | "recurring">("one-off");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(todayInputValue);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = e.currentTarget;
    const fd = new FormData(form);

    // Set recurrenceType based on cost type
    fd.set("recurrenceType", costType === "recurring" ? "MONTHLY" : "ONE_OFF");

    // For recurring: paymentDate = start date, coverageStart = start date
    if (costType === "recurring") {
      const startDate = fd.get("startDate") as string;
      fd.set("paymentDate", startDate);
      fd.set("coverageStart", startDate);
      const reportingDate = new Date(startDate);
      fd.set("reportingYear", String(reportingDate.getFullYear()));
      fd.set("reportingMonth", String(reportingDate.getMonth() + 1));
      const endDate = fd.get("endDate") as string;
      if (endDate) fd.set("coverageEnd", endDate);
    } else {
      const d = new Date(date);
      fd.set("reportingYear", String(d.getFullYear()));
      fd.set("reportingMonth", String(d.getMonth() + 1));
    }

    try {
      await createExpense(propertyId, fd);
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div
      data-testid="quick-add-cost-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-card rounded-2xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Add Cost</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-muted-foreground transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {error && (
            <div className="text-xs text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Type toggle */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button
              type="button"
              onClick={() => setCostType("one-off")}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                costType === "one-off"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              One-time
            </button>
            <button
              type="button"
              onClick={() => setCostType("recurring")}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                costType === "recurring"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly recurring
            </button>
          </div>

          {/* Category + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
              <select
                name="category"
                required
                defaultValue="ELECTRICITY"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_CONFIG[cat]?.icon} {CATEGORY_CONFIG[cat]?.label ?? cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {costType === "recurring" ? "Amount / month (€)" : "Amount (€)"}
              </label>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Date fields */}
          {costType === "one-off" ? (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
              <input
                name="paymentDate"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Starts <span className="text-red-500">*</span>
                </label>
                <input
                  name="startDate"
                  type="date"
                  required
                  defaultValue={todayInputValue.slice(0, 7) + "-01"}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Ends
                  <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  name="endDate"
                  type="date"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="bg-primary hover:bg-primary disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {pending ? "Adding…" : "Add cost"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <Link
              href={`/properties/${propertyId}/costs`}
              className="ml-auto text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              More options →
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export function QuickAddCostButton({
  propertyId,
  todayInputValue,
  label = "+ Quick Add Cost",
  className = "w-full text-sm font-medium text-primary border border-blue-200 bg-accent hover:bg-accent rounded-lg py-2 transition-colors",
}: {
  propertyId: string;
  todayInputValue: string;
  label?: string;
  className?: string;
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        type="button"
        data-testid="quick-add-cost-button"
        onClick={() => setShowModal(true)}
        className={className}
      >
        {label}
      </button>

      {showModal && (
        <QuickAddCostModal
          propertyId={propertyId}
          todayInputValue={todayInputValue}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ─── Main summary ─────────────────────────────────────────────────────────────

export function PropertyCostsSummary({
  propertyId,
  expenses,
  currentYear,
  currentMonth,
  todayInputValue,
}: {
  propertyId: string;
  expenses: Expense[];
  currentYear: number;
  currentMonth: number;
  todayInputValue: string;
}) {
  const thisMonthTotal = getExpenseTotalForMonth(expenses, currentYear, currentMonth);
  const recurringMonthly = getRecurringMonthlyTotal(expenses, currentYear, currentMonth);
  const thisYearTotal = Array.from({ length: 12 }, (_, i) => i + 1).reduce(
    (sum, m) => sum + getExpenseTotalForMonth(expenses, currentYear, m),
    0
  );

  return (
    <>
      <div data-testid="property-costs-summary" className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-sm font-semibold text-foreground">Costs</h2>
          <Link
            href={`/properties/${propertyId}/costs`}
            className="text-xs text-primary hover:text-primary font-medium shrink-0"
          >
            View all →
          </Link>
        </div>

        <dl className="grid grid-cols-3 gap-x-6 gap-y-3 mb-4">
          <div className="min-w-0 py-1">
            <dt className="text-xs text-muted-foreground">This month</dt>
            <dd className="mt-1 text-base font-bold text-foreground">{formatCurrency(thisMonthTotal)}</dd>
          </div>
          <div className="min-w-0 py-1">
            <dt className="text-xs text-muted-foreground">Recurring/mo</dt>
            <dd className="mt-1 text-base font-bold text-foreground">{formatCurrency(recurringMonthly)}</dd>
          </div>
          <div className="min-w-0 py-1">
            <dt className="text-xs text-muted-foreground">This year</dt>
            <dd className="mt-1 text-base font-bold text-foreground">{formatCurrency(thisYearTotal)}</dd>
          </div>
        </dl>

        <QuickAddCostButton propertyId={propertyId} todayInputValue={todayInputValue} />
      </div>
    </>
  );
}
