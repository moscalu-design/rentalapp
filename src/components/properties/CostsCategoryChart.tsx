"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildCostCategoryChartData, type CostCategoryPoint, type ExpenseForCalc } from "@/lib/expenses";
import { formatCurrency } from "@/lib/utils";

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, p) => sum + p.value, 0);
  const nonZero = payload.filter((p) => p.value > 0);

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm px-3 py-2.5 text-xs">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {nonZero.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.fill }} />
          <span className="text-muted-foreground capitalize">{entry.name}:</span>
          <span className="font-medium ml-auto pl-3 text-foreground">{formatCurrency(entry.value)}</span>
        </div>
      ))}
      {nonZero.length > 1 && (
        <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-border">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-semibold ml-auto text-foreground">{formatCurrency(total)}</span>
        </div>
      )}
    </div>
  );
}

function yAxisFormatter(value: number): string {
  if (value === 0) return "€0";
  if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(0)}k`;
  return `€${value}`;
}

export function CostsCategoryChart({ expenses }: { expenses: ExpenseForCalc[] }) {
  const data: CostCategoryPoint[] = buildCostCategoryChartData(expenses);
  const hasData = data.some((d) => d.electricity > 0 || d.water > 0 || d.other > 0);

  if (!hasData) {
    return (
      <div className="bg-card border border-border rounded-xl px-5 py-8 text-center">
        <p className="text-xs text-muted-foreground">
          No cost data yet. Add cost entries to see your spend by category.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl px-5 pt-4 pb-3">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Cost breakdown</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Last 12 months</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 shrink-0" />
            Electricity
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-400 shrink-0" />
            Water
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 shrink-0" />
            Other
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            dy={6}
          />
          <YAxis
            tickFormatter={yAxisFormatter}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
          <Bar dataKey="electricity" name="Electricity" stackId="a" fill="var(--chart-3)" maxBarSize={36} />
          <Bar dataKey="water" name="Water" stackId="a" fill="var(--chart-1)" maxBarSize={36} />
          <Bar
            dataKey="other"
            name="Other"
            stackId="a"
            fill="var(--chart-5)"
            maxBarSize={36}
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
