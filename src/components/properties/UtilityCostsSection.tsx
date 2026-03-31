"use client";

import { useState } from "react";
import { addUtilityCost, deleteUtilityCost } from "@/actions/utilities";
import { formatCurrency } from "@/lib/utils";

type UtilityCost = {
  id: string;
  type: string;
  provider: string | null;
  amount: number;
  billingCycle: string;
  notes: string | null;
};

const UTILITY_ICONS: Record<string, string> = {
  ELECTRICITY: "⚡",
  GAS: "🔥",
  INTERNET: "📶",
  INSURANCE: "🛡",
  CLEANING: "🧹",
  WATER: "💧",
  TRASH: "🗑",
};

const BILLING_LABELS: Record<string, string> = {
  MONTHLY: "/ month",
  QUARTERLY: "/ quarter",
  ANNUAL: "/ year",
  ONE_OFF: "one-off",
};

function monthlyEquivalent(amount: number, cycle: string): number {
  if (cycle === "QUARTERLY") return amount / 3;
  if (cycle === "ANNUAL") return amount / 12;
  return amount;
}

export function UtilityCostsSection({
  propertyId,
  utilityCosts,
}: {
  propertyId: string;
  utilityCosts: UtilityCost[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);

  const monthlyTotal = utilityCosts
    .filter((c) => c.billingCycle !== "ONE_OFF")
    .reduce((sum, c) => sum + monthlyEquivalent(c.amount, c.billingCycle), 0);

  async function handleAdd(formData: FormData) {
    setPending(true);
    await addUtilityCost(propertyId, formData);
    setPending(false);
    setShowForm(false);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Utility Costs</h2>
          {utilityCosts.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {formatCurrency(monthlyTotal)} / month
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          {showForm ? "Cancel" : "+ Add Cost"}
        </button>
      </div>

      {showForm && (
        <form action={handleAdd} className="px-5 py-4 border-b border-slate-100 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select
                name="type"
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ELECTRICITY">⚡ Electricity</option>
                <option value="GAS">🔥 Gas</option>
                <option value="WATER">💧 Water</option>
                <option value="INTERNET">📶 Internet</option>
                <option value="INSURANCE">🛡 Insurance</option>
                <option value="CLEANING">🧹 Cleaning</option>
                <option value="TRASH">🗑 Trash / City</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Billing Cycle</label>
              <select
                name="billingCycle"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUAL">Annual</option>
                <option value="ONE_OFF">One-off</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount (£)</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Provider (optional)</label>
              <input
                name="provider"
                type="text"
                placeholder="e.g. British Gas"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
            <input
              name="notes"
              type="text"
              placeholder="e.g. Direct debit on the 1st"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {pending ? "Saving..." : "Add Cost"}
          </button>
        </form>
      )}

      {utilityCosts.length === 0 && !showForm ? (
        <p className="text-xs text-slate-400 text-center py-6">No utility costs added yet</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {utilityCosts.map((cost) => (
            <div key={cost.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-base">{UTILITY_ICONS[cost.type] ?? "📋"}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {cost.type.charAt(0) + cost.type.slice(1).toLowerCase()}
                    {cost.provider && (
                      <span className="font-normal text-slate-500"> · {cost.provider}</span>
                    )}
                  </p>
                  {cost.notes && (
                    <p className="text-xs text-slate-400 truncate">{cost.notes}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 ml-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800">
                    {formatCurrency(cost.amount)}
                  </p>
                  <p className="text-xs text-slate-500">{BILLING_LABELS[cost.billingCycle]}</p>
                </div>
                <form action={deleteUtilityCost.bind(null, cost.id, propertyId)}>
                  <button
                    type="submit"
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    ✕
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
