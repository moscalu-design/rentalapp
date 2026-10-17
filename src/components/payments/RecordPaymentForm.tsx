"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { recordPayment } from "@/actions/payments";
import { formatCurrency, formatDateShort, formatMonthYear, computePaymentStatus, toDateInputValue } from "@/lib/utils";
import type { Payment } from "@/generated/prisma/client";
import { PaymentStatusBadge } from "@/components/shared/StatusBadge";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid="record-payment-submit"
      disabled={pending}
      className="w-full bg-primary hover:bg-primary disabled:opacity-60 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
    >
      {pending ? "Recording…" : "Record Payment Now"}
    </button>
  );
}

interface RecordPaymentFormProps {
  currentYear: number;
  currentMonth: number;
  todayInputValue: string;
  payments: Payment[];
}

type Period = { year: number; month: number };

function periodKey({ year, month }: Period) {
  return `${year}-${month}`;
}

function sortPeriodsAsc(a: Period, b: Period) {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function RecordPaymentForm({
  currentYear,
  currentMonth,
  todayInputValue,
  payments,
}: RecordPaymentFormProps) {
  const formId = useId();

  // Build a rolling 6-month window around today. Always selectable so operators
  // can see "no record" explicitly for a period that doesn't have one.
  const rollingWindow: Period[] = [];
  for (let i = 5; i >= 0; i--) {
    let year = currentYear;
    let month = currentMonth - i;
    if (month <= 0) {
      month += 12;
      year -= 1;
    }
    rollingWindow.push({ year, month });
  }

  // Union the rolling window with every period that actually has a payment record.
  // This covers early move-in (period slightly outside today) and future-start leases
  // (single pre-generated period far ahead of today).
  const byKey = new Map<string, Period>();
  for (const period of rollingWindow) byKey.set(periodKey(period), period);
  for (const payment of payments) {
    const period: Period = { year: payment.periodYear, month: payment.periodMonth };
    byKey.set(periodKey(period), period);
  }
  const options = Array.from(byKey.values()).sort(sortPeriodsAsc);

  // Default to current month if it's selectable, otherwise the earliest period that
  // actually has a payment record (e.g. a future-start lease).
  const sortedPayments = [...payments].sort((a, b) =>
    sortPeriodsAsc(
      { year: a.periodYear, month: a.periodMonth },
      { year: b.periodYear, month: b.periodMonth },
    ),
  );
  const currentPayment = sortedPayments.find(
    (p) => p.periodYear === currentYear && p.periodMonth === currentMonth,
  );
  const nextUnpaidUpcoming = sortedPayments.find((payment) => {
    const status = computePaymentStatus(payment);
    const isFuturePeriod =
      payment.periodYear > currentYear ||
      (payment.periodYear === currentYear && payment.periodMonth > currentMonth);

    return isFuturePeriod && !["PAID", "WAIVED"].includes(status);
  });
  const firstPayment = sortedPayments[0];
  const initial: Period =
    currentPayment && !["PAID", "WAIVED"].includes(computePaymentStatus(currentPayment))
      ? { year: currentPayment.periodYear, month: currentPayment.periodMonth }
      : nextUnpaidUpcoming
      ? { year: nextUnpaidUpcoming.periodYear, month: nextUnpaidUpcoming.periodMonth }
      : firstPayment
      ? { year: firstPayment.periodYear, month: firstPayment.periodMonth }
      : { year: currentYear, month: currentMonth };

  const [selectedYear, setSelectedYear] = useState(initial.year);
  const [selectedMonth, setSelectedMonth] = useState(initial.month);

  const selectedPayment = payments.find(
    (p) => p.periodYear === selectedYear && p.periodMonth === selectedMonth
  );
  const selectedStatus = selectedPayment ? computePaymentStatus(selectedPayment) : null;

  const action = selectedPayment
    ? recordPayment.bind(null, selectedPayment.id)
    : null;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div>
        <label htmlFor={`${formId}-period`} className="block text-xs font-medium text-muted-foreground mb-1.5">Rent period</label>
        <select
          id={`${formId}-period`}
          value={`${selectedYear}-${selectedMonth}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split("-").map(Number);
            setSelectedYear(y);
            setSelectedMonth(m);
          }}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {options.map(({ year, month }) => (
            <option key={`${year}-${month}`} value={`${year}-${month}`}>
              {formatMonthYear(year, month)}
            </option>
          ))}
        </select>
      </div>

      {selectedPayment && (
        <div
          data-testid="selected-payment-summary"
          className="bg-background rounded-lg px-3 py-2.5 space-y-2 text-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-foreground font-medium">
              Applying payment to {formatMonthYear(selectedPayment.periodYear, selectedPayment.periodMonth)}
            </span>
            <PaymentStatusBadge status={selectedStatus ?? selectedPayment.status} size="sm" />
          </div>
          <div className="flex items-center justify-between gap-3 text-muted-foreground">
            <span>Due: {formatCurrency(selectedPayment.amountDue)}</span>
            <span>Due date: {formatDateShort(selectedPayment.dueDate)}</span>
          </div>
        </div>
      )}

      {action && selectedPayment ? (
        <form key={selectedPayment.id} action={action} className="space-y-3">
          <input type="hidden" name="reference" value={selectedPayment.reference ?? ""} />
          <div>
            <label htmlFor={`${formId}-amount`} className="block text-xs font-medium text-muted-foreground mb-1.5">Total received (€)</label>
            <input
              id={`${formId}-amount`}
              aria-describedby={`${formId}-amount-help`}
              name="amountPaid"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={selectedPayment.amountPaid || selectedPayment.amountDue}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p id={`${formId}-amount-help`} className="mt-1.5 text-xs leading-5 text-muted-foreground">
              Enter the total received for this rent period, including earlier payments.
              {selectedPayment.amountPaid > 0 && ` Already recorded: ${formatCurrency(selectedPayment.amountPaid)}.`}
            </p>
          </div>
          <div>
            <label htmlFor={`${formId}-date`} className="block text-xs font-medium text-muted-foreground mb-1.5">Date paid</label>
            <input
              id={`${formId}-date`}
              name="paidAt"
              type="date"
              defaultValue={toDateInputValue(selectedPayment.paidAt) || todayInputValue}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-method`} className="block text-xs font-medium text-muted-foreground mb-1.5">Payment method</label>
            <select
              id={`${formId}-method`}
              name="paymentMethod"
              defaultValue={selectedPayment.paymentMethod ?? ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Select —</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="STANDING_ORDER">Standing Order</option>
              <option value="CASH">Cash</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${formId}-notes`} className="block text-xs font-medium text-muted-foreground mb-1.5">Notes</label>
            <input
              id={`${formId}-notes`}
              name="notes"
              defaultValue={selectedPayment.notes ?? ""}
              type="text"
              placeholder="Optional…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="rounded-lg bg-accent border border-blue-100 px-3 py-2">
            <p className="text-xs text-primary">
              Save this payment to update the room ledger and tenant balance.
            </p>
          </div>
          <SubmitButton />
        </form>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          No payment record found for this period.
        </p>
      )}
    </div>
  );
}
