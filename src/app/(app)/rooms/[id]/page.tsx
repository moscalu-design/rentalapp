import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { RoomStatusBadge, DepositStatusBadge } from "@/components/shared/StatusBadge";
import { RecordPaymentForm } from "@/components/payments/RecordPaymentForm";
import { AssignTenantForm } from "@/components/rooms/AssignTenantForm";
import { ContractUpload } from "@/components/rooms/ContractUpload";
import { DepositManager } from "@/components/rooms/DepositManager";
import {
  PaymentHistorySection,
  type RoomPaymentHistoryRow,
} from "@/components/rooms/PaymentHistorySection";
import { DeleteRoomForm } from "@/components/rooms/DeleteRoomForm";
import { EndTenancyForm } from "@/components/rooms/EndTenancyForm";
import { ensureRentPaymentsForUser } from "@/lib/billing";
import { summarizeDepositTransactions } from "@/lib/depositUtils";
import { computePaymentStatus } from "@/lib/utils";
import { getDisplayRoomStatus } from "@/lib/roomOccupancy";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/utils";
import { requireUser } from "@/lib/currentUser";

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  await ensureRentPaymentsForUser({ userId: user.id });

  const room = await prisma.room.findUnique({
    where: { id, userId: user.id },
    include: {
      property: true,
      occupancies: {
        include: {
          tenant: true,
          deposit: { include: { transactions: { orderBy: { date: "desc" } } } },
          payments: {
            orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
            take: 24,
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!room) notFound();
  if (room.isDefaultWholePropertyRoom) {
    redirect(`/properties/${room.propertyId}`);
  }

  const activeOccupancy = room.occupancies.find((o) => o.status === "ACTIVE");
  const pastOccupancies = room.occupancies.filter((o) => o.status !== "ACTIVE");
  const paymentHistory: RoomPaymentHistoryRow[] = room.occupancies
    .flatMap((occupancy) =>
      occupancy.payments.map((payment) => ({
        id: payment.id,
        payerName: `${occupancy.tenant.firstName} ${occupancy.tenant.lastName}`,
        periodYear: payment.periodYear,
        periodMonth: payment.periodMonth,
        amountDue: payment.amountDue,
        amountPaid: payment.amountPaid,
        paidAt: payment.paidAt,
        dueDate: payment.dueDate,
        paymentMethod: payment.paymentMethod,
        status: computePaymentStatus(payment),
      }))
    )
    .sort((a, b) => {
      if (a.periodYear !== b.periodYear) return b.periodYear - a.periodYear;
      if (a.periodMonth !== b.periodMonth) return b.periodMonth - a.periodMonth;
      return 0;
    });

  // Tenants available to assign (no active occupancy)
  const availableTenants = await prisma.tenant.findMany({
    where: {
      userId: user.id,
      status: "ACTIVE",
      occupancies: { none: { status: "ACTIVE" } },
    },
    orderBy: { firstName: "asc" },
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const todayInputValue = toDateInputValue(now);

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title={room.name}
        description={`${room.property.name} · ${room.property.address}`}
        backHref={`/properties/${room.propertyId}`}
        backLabel={room.property.name}
        actions={
          <>
            <RoomStatusBadge
              status={getDisplayRoomStatus({
                status: room.status,
                monthlyRent: room.monthlyRent,
                occupancies: activeOccupancy ? [{ status: "ACTIVE", monthlyRent: activeOccupancy.monthlyRent }] : [],
              })}
            />
            {!activeOccupancy && (
              <DeleteRoomForm roomId={id} propertyId={room.propertyId} />
            )}
            <Link
              href={`/properties/${room.propertyId}`}
              data-testid="room-parent-property-link"
              className="text-sm font-medium text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-background transition-colors"
            >
              Property
            </Link>
            <Link
              href={`/rooms/${id}/inventory`}
              className="text-sm font-medium text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-background transition-colors"
            >
              Inventory
            </Link>
            <Link
              href={`/rooms/${id}/edit`}
              className="text-sm font-medium text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-background transition-colors"
            >
              Edit Room
            </Link>
          </>
        }
      />

      <div className="flex-1 p-4 sm:p-6 space-y-6">
        {/* Room info strip */}
        <div
          data-testid="room-info-strip"
          className="grid grid-cols-2 gap-4 bg-card border border-border rounded-xl px-4 py-4 sm:flex sm:flex-wrap sm:items-center sm:gap-6 sm:px-5"
        >
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Monthly Rent</p>
            <p className="text-base font-bold text-foreground">{formatCurrency(room.monthlyRent)}</p>
          </div>
          <div className="hidden sm:block w-px h-8 bg-secondary" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Deposit</p>
            <p data-testid="room-default-deposit-value" className="text-base font-bold text-foreground">{formatCurrency(room.depositAmount)}</p>
          </div>
          {room.sizeM2 && (
            <>
              <div className="hidden sm:block w-px h-8 bg-secondary" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Size</p>
                <p className="text-base font-bold text-foreground">{room.sizeM2} m²</p>
              </div>
            </>
          )}
          <div className="hidden sm:block w-px h-8 bg-secondary" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Furnished</p>
            <p className="text-base font-bold text-foreground">{room.furnished ? "Yes" : "No"}</p>
          </div>
        </div>

        {/* Current Tenant or Assign */}
        {activeOccupancy ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tenant + Lease */}
            <div data-testid="room-current-tenant-card" className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Current Tenant</h2>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/rooms/${id}/occupancies/${activeOccupancy.id}/edit`}
                    data-testid="edit-occupancy-link"
                    className="text-sm font-medium text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-background transition-colors"
                  >
                    Edit Tenancy
                  </Link>
                  <EndTenancyForm occupancyId={activeOccupancy.id} todayInputValue={todayInputValue} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={`/tenants/${activeOccupancy.tenantId}`}
                  data-testid="room-tenant-avatar-link"
                  className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-primary font-semibold text-sm shrink-0 hover:bg-blue-200 transition-colors"
                  aria-label={`Open tenant ${activeOccupancy.tenant.firstName} ${activeOccupancy.tenant.lastName}`}
                >
                  {activeOccupancy.tenant.firstName[0]}{activeOccupancy.tenant.lastName[0]}
                </Link>
                <div>
                  <Link
                    href={`/tenants/${activeOccupancy.tenantId}`}
                    data-testid="room-tenant-name-link"
                    className="font-medium text-foreground hover:text-primary transition-colors text-sm"
                  >
                    {activeOccupancy.tenant.firstName} {activeOccupancy.tenant.lastName}
                  </Link>
                  {activeOccupancy.tenant.email && (
                    <p className="text-xs text-muted-foreground">{activeOccupancy.tenant.email}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lease Start</span>
                  <span className="font-medium text-foreground">{formatDate(activeOccupancy.leaseStart)}</span>
                </div>
                {activeOccupancy.leaseEnd && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lease End</span>
                    <span className="font-medium text-foreground">{formatDate(activeOccupancy.leaseEnd)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monthly Rent</span>
                  <span className="font-medium text-foreground">{formatCurrency(activeOccupancy.monthlyRent)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rent Due Day</span>
                  <span className="font-medium text-foreground">{activeOccupancy.rentDueDay}th of month</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment Grace</span>
                  <span className="font-medium text-foreground">{activeOccupancy.paymentGracePeriodDays ?? 5} days</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <ContractUpload
                  occupancyId={activeOccupancy.id}
                  contractFileName={activeOccupancy.contractFileName}
                  contractFileSize={activeOccupancy.contractFileSize}
                  contractUploadedAt={activeOccupancy.contractUploadedAt}
                />
              </div>
            </div>

            {/* Deposit */}
            <div data-testid="room-deposit-card" className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Deposit</h2>
                {activeOccupancy.deposit && (
                  <DepositStatusBadge status={activeOccupancy.deposit.status} size="sm" />
                )}
              </div>

              {activeOccupancy.deposit ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Required</span>
                      <span data-testid="deposit-required-value" className="font-semibold text-foreground">{formatCurrency(activeOccupancy.deposit.required)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Received</span>
                      <span data-testid="deposit-received-value" className="font-semibold text-success">{formatCurrency(activeOccupancy.deposit.received)}</span>
                    </div>
                    {activeOccupancy.deposit.receivedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Date Received</span>
                        <span className="text-foreground">{formatDate(activeOccupancy.deposit.receivedAt)}</span>
                      </div>
                    )}
                  </div>

                  {activeOccupancy.deposit.transactions.length > 0 && (
                    <div className="pt-3 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Transactions</p>
                      <div className="space-y-1.5">
                        {activeOccupancy.deposit.transactions.map((tx) => (
                          <div key={tx.id} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{tx.type} · {formatDate(tx.date)}</span>
                            <span className={`font-medium ${tx.type === "DEDUCTION" ? "text-destructive" : tx.type === "REFUND" ? "text-orange-600" : "text-green-600"}`}>
                              {tx.type === "DEDUCTION" || tx.type === "REFUND" ? "−" : "+"}
                              {formatCurrency(tx.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <DepositManager
                    occupancyId={activeOccupancy.id}
                    required={activeOccupancy.deposit.required}
                    received={activeOccupancy.deposit.received}
                    refunded={activeOccupancy.deposit.refunded}
                    refundDueDate={activeOccupancy.deposit.refundDueDate}
                    transactions={activeOccupancy.deposit.transactions}
                    todayInputValue={todayInputValue}
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No deposit record</p>
              )}
            </div>

            {/* Record Payment (current month) */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-foreground">Record Payment</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose a period and save the payment with the button below.
                </p>
              </div>
              <div id="record-payment" className="scroll-mt-6"><RecordPaymentForm
                currentYear={currentYear}
                currentMonth={currentMonth}
                todayInputValue={todayInputValue}
                payments={activeOccupancy.payments}
              /></div>
            </div>
          </div>
        ) : (
          <div
            data-testid="room-vacant-state"
            className="bg-card border border-border rounded-xl p-6"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  No current tenant assigned
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This room is currently vacant. Add a tenant when you are ready to start a new tenancy.
                </p>
              </div>
              <AssignTenantForm
                roomId={id}
                tenants={availableTenants}
                defaultRent={room.monthlyRent}
                defaultDeposit={room.depositAmount}
                todayInputValue={todayInputValue}
              />
            </div>
          </div>
        )}

        {/* Deposit refund-due warnings from past tenancies */}
        {pastOccupancies.some(
          (o) => o.deposit && !o.deposit.refunded && o.deposit.refundDueDate
        ) && (
          <div className="space-y-2">
            {pastOccupancies
              .filter((o) => o.deposit && !o.deposit.refunded && o.deposit.refundDueDate)
              .map((o) => {
                const refundDue = new Date(o.deposit!.refundDueDate!);
                const isOverdue = refundDue < now;
                return (
                  <div
                    key={o.id}
                    data-testid="deposit-refund-warning"
                    className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${
                      isOverdue
                        ? "bg-red-50 border-red-200"
                        : "bg-amber-50 border-amber-200"
                    }`}
                  >
                    <span className={`text-base mt-0.5 ${isOverdue ? "text-red-500" : "text-amber-500"}`}>⚠</span>
                    <div>
                      {(() => {
                        const summary = summarizeDepositTransactions(
                          o.deposit!.required,
                          o.deposit!.transactions
                        );

                        return (
                          <>
                      <p className={`text-sm font-medium ${isOverdue ? "text-red-700" : "text-amber-700"}`}>
                        Deposit return {isOverdue ? "overdue" : "due soon"}
                      </p>
                      <p className={`text-xs mt-0.5 ${isOverdue ? "text-destructive" : "text-amber-600"}`}>
                        {o.tenant.firstName} {o.tenant.lastName} moved out on{" "}
                        {formatDate(o.moveOutDate)} — deposit of{" "}
                        {formatCurrency(summary.outstandingRefund || o.deposit!.required)} should be returned by{" "}
                        {formatDate(refundDue)}.
                      </p>
                          </>
                        );
                      })()}

                      <DepositManager
                        occupancyId={o.id}
                        required={o.deposit!.required}
                        received={o.deposit!.received}
                        refunded={o.deposit!.refunded}
                        refundDueDate={o.deposit!.refundDueDate}
                        transactions={o.deposit!.transactions}
                        compact
                        todayInputValue={todayInputValue}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        <PaymentHistorySection roomId={id} payments={paymentHistory} />

        {/* Notes */}
        {room.notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <p className="text-xs font-semibold text-amber-700 mb-1">Room Notes</p>
            <p className="text-sm text-amber-800 whitespace-pre-wrap">{room.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
