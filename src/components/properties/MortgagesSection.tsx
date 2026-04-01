"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createMortgage, deleteMortgage, toggleMortgageActive } from "@/actions/mortgages";
import { formatCurrency } from "@/lib/utils";
import {
  getCurrentBalance,
  getElapsedTermMonths,
  getMortgageAnnualData,
  type MortgageRecord,
} from "@/lib/mortgage";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mortgage = MortgageRecord & {
  label: string | null;
  lender: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatRate(rate: number): string {
  return `${rate.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function formatTerm(months: number): string {
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem}mo`;
  if (rem === 0) return `${years}yr`;
  return `${years}yr ${rem}mo`;
}

// ─── Add Mortgage Modal ───────────────────────────────────────────────────────

function AddMortgageModal({
  propertyId,
  onClose,
}: {
  propertyId: string;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createMortgage(propertyId, new FormData(e.currentTarget));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save mortgage");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Add Mortgage</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Payments will automatically count toward property costs
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Label + Lender */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Label <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                name="label"
                type="text"
                placeholder="e.g. Main Mortgage"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Lender <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                name="lender"
                type="text"
                placeholder="e.g. Nationwide"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Start date + Term */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Start Date <span className="text-red-400">*</span>
              </label>
              <input
                name="startDate"
                type="date"
                defaultValue={todayString()}
                required
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">First payment date</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Term (months) <span className="text-red-400">*</span>
              </label>
              <input
                name="termMonths"
                type="number"
                min={1}
                max={600}
                placeholder="e.g. 300"
                required
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">300 = 25 years</p>
            </div>
          </div>

          {/* Balance + Rate + Payment */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Balance (€) <span className="text-red-400">*</span>
              </label>
              <input
                name="initialBalance"
                type="number"
                min={1}
                step="0.01"
                placeholder="200000"
                required
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">At start date</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Rate (%) <span className="text-red-400">*</span>
              </label>
              <input
                name="interestRate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                placeholder="3.5"
                required
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">Annual %</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Monthly (€) <span className="text-red-400">*</span>
              </label>
              <input
                name="monthlyPayment"
                type="number"
                min={1}
                step="0.01"
                placeholder="1200"
                required
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">Fixed payment</p>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add Mortgage"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Details Chart ─────────────────────────────────────────────────────────────

function DetailsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2.5 text-xs">
      <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: entry.color }} />
          <span className="text-slate-500 capitalize">{entry.name}:</span>
          <span className="font-medium ml-auto pl-3" style={{ color: entry.color }}>
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function yFmt(v: number): string {
  if (Math.abs(v) >= 1000) return `€${(v / 1000).toFixed(0)}k`;
  return `€${v}`;
}

// ─── Mortgage Details Modal ───────────────────────────────────────────────────

function MortgageDetailsModal({
  mortgage,
  propertyId,
  onClose,
}: {
  mortgage: Mortgage;
  propertyId: string;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  const annualData = getMortgageAnnualData(mortgage);
  const currentBalance = getCurrentBalance(mortgage);
  const elapsed = getElapsedTermMonths(mortgage);
  const progressPct = mortgage.termMonths > 0
    ? Math.round((elapsed / mortgage.termMonths) * 100)
    : 0;
  const totalPaid = elapsed * mortgage.monthlyPayment;
  const totalCost = mortgage.termMonths * mortgage.monthlyPayment;

  async function handleDelete() {
    if (!confirm("Remove this mortgage? This cannot be undone.")) return;
    setDeleting(true);
    await deleteMortgage(mortgage.id, propertyId);
    onClose();
  }

  async function handleToggle() {
    await toggleMortgageActive(mortgage.id, propertyId, !mortgage.isActive);
    onClose();
  }

  const name = mortgage.label || mortgage.lender || "Mortgage";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">{name}</h2>
            {mortgage.lender && mortgage.label && (
              <p className="text-xs text-slate-400 mt-0.5">{mortgage.lender}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none mt-0.5"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Key stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-lg font-bold text-slate-900">
                {formatCurrency(currentBalance)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Remaining balance</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-lg font-bold text-slate-900">
                {formatCurrency(mortgage.monthlyPayment)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Monthly payment</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-lg font-bold text-slate-900">
                {formatRate(mortgage.interestRate)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Annual rate</p>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>{formatTerm(elapsed)} paid</span>
              <span>{progressPct}% of {formatTerm(mortgage.termMonths)}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Started {new Date(mortgage.startDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span>
              <span>
                {(() => {
                  const end = new Date(mortgage.startDate);
                  end.setMonth(end.getMonth() + mortgage.termMonths);
                  return end.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
                })()}
              </span>
            </div>
          </div>

          {/* Annual chart */}
          {annualData.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-3">
                Annual Breakdown
              </h3>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-blue-400 shrink-0" />
                  Principal
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-amber-400 shrink-0" />
                  Interest
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1.5 rounded-full bg-slate-400 shrink-0" />
                  Balance
                </span>
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart
                  data={annualData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    dy={6}
                  />
                  <YAxis
                    tickFormatter={yFmt}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <Tooltip content={<DetailsTooltip />} cursor={{ fill: "#f8fafc" }} />
                  <Bar
                    dataKey="totalPrincipal"
                    name="principal"
                    stackId="payments"
                    fill="#60a5fa"
                    opacity={0.9}
                    radius={[0, 0, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="totalInterest"
                    name="interest"
                    stackId="payments"
                    fill="#fbbf24"
                    opacity={0.85}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={32}
                  />
                  <Line
                    type="monotone"
                    dataKey="endBalance"
                    name="balance"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#94a3b8", strokeWidth: 0 }}
                    activeDot={{ r: 4, fill: "#94a3b8", strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              {deleting ? "Removing…" : "Remove mortgage"}
            </button>
            <button
              onClick={handleToggle}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              {mortgage.isActive ? "Mark as inactive" : "Mark as active"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mortgage Card ────────────────────────────────────────────────────────────

function MortgageCard({
  mortgage,
  propertyId,
}: {
  mortgage: Mortgage;
  propertyId: string;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const currentBalance = getCurrentBalance(mortgage);
  const elapsed = getElapsedTermMonths(mortgage);
  const progressPct = mortgage.termMonths > 0
    ? Math.round((elapsed / mortgage.termMonths) * 100)
    : 0;
  const name = mortgage.label || mortgage.lender || "Mortgage";

  return (
    <>
      <div className={`bg-white border rounded-xl px-5 py-4 ${mortgage.isActive ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-700 truncate">{name}</p>
              {!mortgage.isActive && (
                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full shrink-0">
                  inactive
                </span>
              )}
            </div>
            {mortgage.lender && mortgage.label && (
              <p className="text-xs text-slate-400 mt-0.5">{mortgage.lender}</p>
            )}
          </div>
          <button
            onClick={() => setShowDetails(true)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0"
          >
            Details
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <p className="text-sm font-bold text-slate-900">
              {formatCurrency(mortgage.monthlyPayment)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">/ month</p>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              {formatCurrency(currentBalance)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">remaining</p>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              {formatRate(mortgage.interestRate)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">annual rate</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {progressPct}% paid · {formatTerm(mortgage.termMonths - elapsed)} remaining
          </p>
        </div>
      </div>

      {showDetails && (
        <MortgageDetailsModal
          mortgage={mortgage}
          propertyId={propertyId}
          onClose={() => setShowDetails(false)}
        />
      )}
    </>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────

export function MortgagesSection({
  propertyId,
  mortgages,
}: {
  propertyId: string;
  mortgages: Mortgage[];
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Mortgages</h2>
            {mortgages.length > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">
                {formatCurrency(
                  mortgages
                    .filter((m) => m.isActive)
                    .reduce((s, m) => s + m.monthlyPayment, 0)
                )}{" "}
                / month across {mortgages.filter((m) => m.isActive).length} active
              </p>
            )}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add Mortgage
          </button>
        </div>

        {mortgages.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-6 text-center">
            <p className="text-xs text-slate-400">No mortgages recorded.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Add first mortgage →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {mortgages.map((m) => (
              <MortgageCard key={m.id} mortgage={m} propertyId={propertyId} />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddMortgageModal propertyId={propertyId} onClose={() => setShowAdd(false)} />
      )}
    </>
  );
}
