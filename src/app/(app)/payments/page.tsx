import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { PaymentStatusBadge } from "@/components/shared/StatusBadge";
import { ensureRentPaymentsForUser } from "@/lib/billing";
import prisma from "@/lib/prisma";
import { computePaymentStatus, formatCurrency, formatDate, formatMonthYear } from "@/lib/utils";
import { requireUser } from "@/lib/currentUser";
import { getPaymentAction } from "@/lib/paymentNavigation";
import { parseLedgerFilters, paymentYearOptions, type QueryValue } from "@/lib/ledgerFilters";

async function getPaymentsData(userId: string, year: number, month: number) {
  const payments = await prisma.payment.findMany({
    where: { userId, periodYear: year, periodMonth: month },
    include: {
      occupancy: {
        include: {
          tenant: true,
          room: { include: { property: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }],
  });

  payments.sort((a, b) => a.occupancy.tenant.firstName.localeCompare(b.occupancy.tenant.firstName));
  const paymentsWithStatus = payments.map((payment) => ({
    ...payment,
    derivedStatus: computePaymentStatus(payment),
  }));

  const totalDue = paymentsWithStatus.reduce((sum, p) => sum + p.amountDue, 0);
  const totalPaid = paymentsWithStatus.reduce((sum, p) => sum + p.amountPaid, 0);
  const totalOutstanding = paymentsWithStatus
    .filter((p) => !["PAID", "WAIVED"].includes(p.derivedStatus))
    .reduce((sum, p) => sum + (p.amountDue - p.amountPaid), 0);

  return { payments: paymentsWithStatus, totalDue, totalPaid, totalOutstanding };
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: QueryValue; month?: QueryValue; status?: QueryValue }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const now = new Date();
  await ensureRentPaymentsForUser({ userId: user.id, now });
  const { year, month, status: statusFilter } = parseLedgerFilters(sp, now);

  const [{ payments, totalDue, totalPaid, totalOutstanding }, availablePeriods] = await Promise.all([
    getPaymentsData(user.id, year, month),
    prisma.payment.findMany({
      where: { userId: user.id },
      distinct: ["periodYear"],
      select: { periodYear: true },
    }),
  ]);
  const filtered = statusFilter
    ? payments.filter((payment) => payment.derivedStatus === statusFilter)
    : payments;
  const yearOptions = paymentYearOptions(availablePeriods.map((period) => period.periodYear), year, now.getFullYear());
  const periodHref = `/payments?year=${year}&month=${month}`;

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Payments"
        description={`${formatMonthYear(year, month)} rent ledger`}
      />

      <div className="rental-page flex-1 p-4 sm:p-6 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rental-panel px-5 py-4">
            <p className="text-sm text-muted-foreground font-medium">Total Due</p>
            <p className="mt-1 truncate text-2xl font-semibold text-foreground">{formatCurrency(totalDue)}</p>
          </div>
          <div className="rental-panel px-5 py-4">
            <p className="text-sm text-muted-foreground font-medium">Collected</p>
            <p className="mt-1 truncate text-2xl font-semibold text-foreground">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="rental-panel px-5 py-4">
            <p className="text-sm text-muted-foreground font-medium">Outstanding</p>
            <p className="mt-1 truncate text-2xl font-semibold text-foreground">{formatCurrency(totalOutstanding)}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">Totals include all payments for {formatMonthYear(year, month)}. Status filters apply to the list below.</p>

        {/* Filters */}
        <form action="/payments" key={`${year}-${month}-${statusFilter}`} className="grid grid-cols-2 gap-2 rental-panel p-3 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          <select
            name="month"
            defaultValue={month}
            aria-label="Month"
            className="rental-input sm:w-auto"
          >
            {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                {new Date(2000, value - 1, 1).toLocaleString("en-GB", { month: "long" })}
              </option>
            ))}
          </select>

          <select
            name="year"
            defaultValue={year}
            aria-label="Year"
            className="rental-input sm:w-auto"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            name="status"
            defaultValue={statusFilter}
            aria-label="Status"
            className="col-span-2 rental-input sm:col-span-1 sm:w-auto"
          >
            <option value="">All statuses</option>
            <option value="PAID">Paid</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIAL">Partial</option>
            <option value="OVERDUE">Overdue</option>
            <option value="WAIVED">Waived</option>
          </select>

          <button
            type="submit"
            className="rental-button-primary col-span-2 sm:col-span-1 sm:ml-auto"
          >
            Filter
          </button>
        </form>

        {/* Table */}
        <div className="overflow-hidden rental-panel">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">
              {filtered.length} payment{filtered.length === 1 ? "" : "s"}{statusFilter ? ` · ${statusFilter.toLowerCase()}` : ""}
            </h2>
            {statusFilter && <Link href={periodHref} className="text-sm font-medium text-primary hover:underline">Clear status filter</Link>}
          </div>
          <div className="divide-y divide-border md:hidden">
            {filtered.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                {statusFilter ? "No payments match this status. Clear the filter to see the full period." : "No payments for this period."}
              </p>
            ) : (
              filtered.map((payment) => (
                <div key={payment.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/tenants/${payment.occupancy.tenantId}`}
                        className="block truncate text-sm font-semibold text-foreground hover:text-primary"
                      >
                        {payment.occupancy.tenant.firstName} {payment.occupancy.tenant.lastName}
                      </Link>
                      <Link
                        href={
                          payment.occupancy.room.isDefaultWholePropertyRoom
                            ? `/properties/${payment.occupancy.room.propertyId}`
                            : `/rooms/${payment.occupancy.roomId}`
                        }
                        className="mt-1 block text-xs text-muted-foreground hover:text-primary"
                      >
                        {payment.occupancy.room.property.name}
                        {payment.occupancy.room.isDefaultWholePropertyRoom
                          ? " · Whole property"
                          : ` · ${payment.occupancy.room.name}`}
                      </Link>
                    </div>
                    <PaymentStatusBadge status={payment.derivedStatus} size="sm" />
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Due</dt>
                      <dd className="mt-1 font-medium text-foreground">{formatCurrency(payment.amountDue)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Paid</dt>
                      <dd className="mt-1 font-medium text-foreground">
                        {payment.amountPaid > 0 ? formatCurrency(payment.amountPaid) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Due date</dt>
                      <dd className="mt-1 text-foreground">{formatDate(payment.dueDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Date Paid</dt>
                      <dd className="mt-1 text-foreground">{formatDate(payment.paidAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Method</dt>
                      <dd className="mt-1 text-foreground">{payment.paymentMethod?.replace("_", " ") ?? "—"}</dd>
                    </div>
                  </dl>
                  <Link
                    href={getPaymentAction(payment).href}
                    className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-xs font-medium text-primary hover:bg-muted/50"
                  >
                    {getPaymentAction(payment).label}
                  </Link>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Tenant</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Room</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Due</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Paid</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Due date</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Date Paid</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Method</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {statusFilter ? "No payments match this status. Clear the filter to see the full period." : "No payments for this period."}
                  </td>
                </tr>
              ) : (
                filtered.map((payment) => (
                  <tr key={payment.id} className="hover:bg-muted/50">
                    <td className="px-5 py-3">
                      <Link href={`/tenants/${payment.occupancy.tenantId}`} className="font-medium text-foreground hover:text-primary">
                        {payment.occupancy.tenant.firstName} {payment.occupancy.tenant.lastName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <Link
                        href={
                          payment.occupancy.room.isDefaultWholePropertyRoom
                            ? `/properties/${payment.occupancy.room.propertyId}`
                            : `/rooms/${payment.occupancy.roomId}`
                        }
                        className="hover:text-primary"
                      >
                        {payment.occupancy.room.property.name}
                        {payment.occupancy.room.isDefaultWholePropertyRoom
                          ? " · Whole property"
                          : ` · ${payment.occupancy.room.name}`}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-foreground">{formatCurrency(payment.amountDue)}</td>
                    <td className="px-5 py-3 text-foreground">
                      {payment.amountPaid > 0 ? formatCurrency(payment.amountPaid) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{formatDate(payment.dueDate)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{formatDate(payment.paidAt)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{payment.paymentMethod?.replace("_", " ") ?? "—"}</td>
                    <td className="px-5 py-3">
                      <PaymentStatusBadge status={payment.derivedStatus} size="sm" />
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={getPaymentAction(payment).href}
                        className="text-xs text-primary hover:text-primary font-medium"
                      >
                        {getPaymentAction(payment).label}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
