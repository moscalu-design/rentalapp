"use client";

import { useId, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { recordPayment } from "@/actions/payments";
import { PaymentStatusBadge } from "@/components/shared/StatusBadge";
import {
  computePaymentStatus,
  formatCurrency,
  formatDate,
  formatMonthYear,
  toDateInputValue,
} from "@/lib/utils";

export type PropertyPaymentRow = {
  id: string;
  tenantName: string;
  roomName: string;
  periodYear: number;
  periodMonth: number;
  amountDue: number;
  amountPaid: number;
  dueDate: string;
  paidAt: string | null;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
};

type StatusFilter = "ALL" | "UNPAID" | "PARTIAL" | "OVERDUE" | "PAID" | "WAIVED";

function SavePaymentButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid="property-payment-save"
      disabled={pending}
      className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

function daysOverdue(payment: PropertyPaymentRow) {
  const status = computePaymentStatus(payment);
  if (status !== "OVERDUE") return 0;
  const today = new Date();
  const due = new Date(payment.dueDate);
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000));
}

function outstanding(payment: PropertyPaymentRow) {
  return Math.max(0, payment.amountDue - payment.amountPaid);
}

export function PropertyPaymentsTable({ payments }: { payments: PropertyPaymentRow[] }) {
  const formId = useId();
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [recordingId, setRecordingId] = useState<string | null>(null);

  const rows = useMemo(() => {
    return payments
      .map((payment) => ({ ...payment, derivedStatus: computePaymentStatus(payment) }))
      .filter((payment) => filter === "ALL" || payment.derivedStatus === filter);
  }, [payments, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["ALL", "UNPAID", "PARTIAL", "OVERDUE", "PAID", "WAIVED"] as const).map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`property-payments-filter-${option.toLowerCase()}`}
            onClick={() => setFilter(option)}
            aria-pressed={filter === option}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              filter === option
                ? "border-primary bg-accent text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-background"
            }`}
          >
            {option === "ALL" ? "All" : option[0] + option.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-slate-200/40">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No payments match this filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm" data-testid="property-payments-table">
              <caption className="sr-only">Property rent ledger by tenant and billing month</caption>
              <thead>
                <tr className="border-b border-border bg-background">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Tenant</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Room</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Billing month</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Due date</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Due</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Paid</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Outstanding</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((payment) => {
                  const isRecording = recordingId === payment.id;
                  const status = payment.derivedStatus;
                  const fieldId = `${formId}-${payment.id}`;
                  return (
                    <tr key={payment.id} data-testid="property-payment-row" className="align-top">
                      <td className="px-4 py-3 font-medium text-foreground">{payment.tenantName}</td>
                      <td className="px-4 py-3 text-foreground">{payment.roomName}</td>
                      <td className="px-4 py-3 text-foreground">
                        {formatMonthYear(payment.periodYear, payment.periodMonth)}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        <div>{formatDate(payment.dueDate)}</div>
                        {daysOverdue(payment) > 0 && (
                          <div className="text-xs text-destructive">
                            {daysOverdue(payment)} days overdue
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">{formatCurrency(payment.amountDue)}</td>
                      <td className="px-4 py-3 text-right text-foreground">{formatCurrency(payment.amountPaid)}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {formatCurrency(outstanding(payment))}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={status} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        {isRecording ? (
                          <form action={recordPayment.bind(null, payment.id)} className="w-56 space-y-2">
                            <label htmlFor={`${fieldId}-amount`} className="block text-xs font-medium text-foreground">Total received (€)</label>
                            <input
                              id={`${fieldId}-amount`}
                              aria-describedby={`${fieldId}-amount-help`}
                              name="amountPaid"
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              defaultValue={payment.amountPaid || payment.amountDue}
                              data-testid="property-payment-amount"
                              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                            />
                            <p id={`${fieldId}-amount-help`} className="text-xs leading-5 text-muted-foreground">
                              Include earlier payments. Already recorded: {formatCurrency(payment.amountPaid)}.
                            </p>
                            <label htmlFor={`${fieldId}-date`} className="block text-xs font-medium text-foreground">Date paid</label>
                            <input
                              id={`${fieldId}-date`}
                              name="paidAt"
                              type="date"
                              defaultValue={toDateInputValue(payment.paidAt) || toDateInputValue(new Date())}
                              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                            />
                            <label htmlFor={`${fieldId}-method`} className="block text-xs font-medium text-foreground">Payment method</label>
                            <select
                              id={`${fieldId}-method`}
                              name="paymentMethod"
                              defaultValue={payment.paymentMethod ?? ""}
                              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                            >
                              <option value="">Method</option>
                              <option value="BANK_TRANSFER">Bank Transfer</option>
                              <option value="STANDING_ORDER">Standing Order</option>
                              <option value="CASH">Cash</option>
                              <option value="OTHER">Other</option>
                            </select>
                            <label htmlFor={`${fieldId}-reference`} className="block text-xs font-medium text-foreground">Reference</label>
                            <input
                              id={`${fieldId}-reference`}
                              name="reference"
                              defaultValue={payment.reference ?? ""}
                              placeholder="Reference"
                              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                            />
                            <label htmlFor={`${fieldId}-notes`} className="block text-xs font-medium text-foreground">Notes</label>
                            <input
                              id={`${fieldId}-notes`}
                              name="notes"
                              defaultValue={payment.notes ?? ""}
                              placeholder="Notes"
                              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                            />
                            <div className="flex gap-2">
                              <SavePaymentButton />
                              <button
                                type="button"
                                onClick={() => setRecordingId(null)}
                                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            type="button"
                            data-testid="property-payment-record"
                            onClick={() => setRecordingId(payment.id)}
                            disabled={status === "PAID" || status === "WAIVED"}
                            className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Record payment
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
