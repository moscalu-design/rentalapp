export type QueryValue = string | string[] | undefined;

const PAYMENT_STATUSES = ["PAID", "UNPAID", "PARTIAL", "OVERDUE", "WAIVED"] as const;

function boundedInteger(value: QueryValue, min: number, max: number, fallback: number) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

/** Reject malformed or repeated URL values before they reach the database query. */
export function parseLedgerFilters(
  params: { year?: QueryValue; month?: QueryValue; status?: QueryValue },
  now = new Date(),
) {
  return {
    year: boundedInteger(params.year, 1900, 9999, now.getFullYear()),
    month: boundedInteger(params.month, 1, 12, now.getMonth() + 1),
    status: typeof params.status === "string" && PAYMENT_STATUSES.some((status) => status === params.status)
      ? params.status
      : "",
  };
}

export function paymentYearOptions(availableYears: number[], selectedYear: number, currentYear: number) {
  return [...new Set([...availableYears, selectedYear, currentYear, currentYear - 1])].sort((a, b) => b - a);
}
