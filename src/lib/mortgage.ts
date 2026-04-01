// Mortgage amortization engine — all calculations are dynamic, nothing stored.
//
// Model assumption: fixed-rate mortgage with equal monthly payments.
// startDate = first payment date; balance at that date = initialBalance.
// termMonths defines the end: mortgage is active from month 0 to month (termMonths - 1).

export type MortgageRecord = {
  id: string;
  startDate: Date;
  termMonths: number;
  initialBalance: number;
  interestRate: number; // annual %, e.g. 3.5
  monthlyPayment: number;
  isActive: boolean;
};

// How many payment periods have elapsed from startDate to a given (year, month).
// Returns 0 if year/month == startDate's year/month (first payment).
// Returns negative if year/month is before startDate.
function elapsedMonths(startDate: Date, year: number, month: number): number {
  return (year - startDate.getFullYear()) * 12 + (month - (startDate.getMonth() + 1));
}

// Whether this mortgage generates a payment in the given month.
export function isMortgageActiveInMonth(
  mortgage: MortgageRecord,
  year: number,
  month: number
): boolean {
  if (!mortgage.isActive) return false;
  const elapsed = elapsedMonths(mortgage.startDate, year, month);
  return elapsed >= 0 && elapsed < mortgage.termMonths;
}

// Remaining balance at the START of a given payment period (before that month's payment).
// Uses iterative amortization from startDate — O(elapsed) but fast enough for any realistic term.
export function getBalanceBefore(
  mortgage: MortgageRecord,
  year: number,
  month: number
): number {
  const elapsed = elapsedMonths(mortgage.startDate, year, month);
  if (elapsed <= 0) return mortgage.initialBalance;

  const monthlyRate = mortgage.interestRate / 100 / 12;
  let balance = mortgage.initialBalance;

  const steps = Math.min(elapsed, mortgage.termMonths);
  for (let i = 0; i < steps; i++) {
    if (balance <= 0) break;
    const interest = balance * monthlyRate;
    const principal = Math.min(mortgage.monthlyPayment - interest, balance);
    balance = Math.max(0, balance - principal);
  }

  return balance;
}

// Full monthly breakdown for a given month. Returns null if not active.
export type MonthlyBreakdown = {
  payment: number;
  interest: number;
  principal: number;
  balanceBefore: number;
  balanceAfter: number;
};

export function getMonthlyBreakdown(
  mortgage: MortgageRecord,
  year: number,
  month: number
): MonthlyBreakdown | null {
  if (!isMortgageActiveInMonth(mortgage, year, month)) return null;

  const monthlyRate = mortgage.interestRate / 100 / 12;
  const balanceBefore = getBalanceBefore(mortgage, year, month);

  const interest = balanceBefore * monthlyRate;
  const principal = Math.min(mortgage.monthlyPayment - interest, balanceBefore);
  const payment = interest + principal;
  const balanceAfter = Math.max(0, balanceBefore - principal);

  return {
    payment: round2(payment),
    interest: round2(interest),
    principal: round2(principal),
    balanceBefore: round2(balanceBefore),
    balanceAfter: round2(balanceAfter),
  };
}

// Current remaining balance as of today (before this month's payment).
export function getCurrentBalance(mortgage: MortgageRecord): number {
  const now = new Date();
  return getBalanceBefore(mortgage, now.getFullYear(), now.getMonth() + 1);
}

// How many months of the term have elapsed from startDate to today.
// Clamped to [0, termMonths].
export function getElapsedTermMonths(mortgage: MortgageRecord): number {
  const now = new Date();
  const elapsed = elapsedMonths(mortgage.startDate, now.getFullYear(), now.getMonth() + 1);
  return Math.max(0, Math.min(elapsed, mortgage.termMonths));
}

// ─── Annual aggregation (for the details chart) ───────────────────────────────

export type MortgageYearData = {
  year: number;
  label: string;
  totalInterest: number;
  totalPrincipal: number;
  endBalance: number;
};

// Iterates the full amortization schedule and groups results by calendar year.
export function getMortgageAnnualData(mortgage: MortgageRecord): MortgageYearData[] {
  const monthlyRate = mortgage.interestRate / 100 / 12;
  let balance = mortgage.initialBalance;

  // year → accumulator
  const map = new Map<number, { interest: number; principal: number; endBalance: number }>();

  for (let i = 0; i < mortgage.termMonths; i++) {
    if (balance <= 0) break;

    const d = new Date(
      mortgage.startDate.getFullYear(),
      mortgage.startDate.getMonth() + i,
      1
    );
    const year = d.getFullYear();

    const interest = balance * monthlyRate;
    const principal = Math.min(mortgage.monthlyPayment - interest, balance);
    balance = Math.max(0, balance - principal);

    const prev = map.get(year) ?? { interest: 0, principal: 0, endBalance: 0 };
    map.set(year, {
      interest: prev.interest + interest,
      principal: prev.principal + principal,
      endBalance: balance, // updated each month → ends up as December balance
    });
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, d]) => ({
      year,
      label: String(year),
      totalInterest: round2(d.interest),
      totalPrincipal: round2(d.principal),
      endBalance: round2(d.endBalance),
    }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
