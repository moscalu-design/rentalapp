import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { ArchivePropertyForm } from "@/components/properties/ArchivePropertyForm";
import { PropertyCostsSummary } from "@/components/properties/PropertyCostsSummary";
import { PropertyMortgageSummary } from "@/components/properties/PropertyMortgageSummary";
import { PropertyPerformanceChart } from "@/components/properties/PropertyPerformanceChart";
import { PropertySubnav } from "@/components/properties/PropertySubnav";
import { WholePropertyAssignTenant } from "@/components/properties/WholePropertyTenancySection";
import { InventoryInspectionView } from "@/components/inventory/InventoryInspectionView";
import { RoomInventoryManager } from "@/components/inventory/RoomInventoryManager";
import { DepositManager } from "@/components/rooms/DepositManager";
import { EndTenancyForm } from "@/components/rooms/EndTenancyForm";
import { RecordPaymentForm } from "@/components/payments/RecordPaymentForm";
import { DepositStatusBadge, PaymentStatusBadge } from "@/components/shared/StatusBadge";
import { buildChartData } from "@/components/properties/propertyPerformanceData";
import { RoomStatusBadge } from "@/components/shared/StatusBadge";
import { getMonthlyCostForMonth } from "@/lib/mortgage";
import { getExpenseTotalForMonth } from "@/lib/expenses";
import { summarizeDepositTransactions } from "@/lib/depositUtils";
import { getDisplayRoomStatus, isVisibleRoom, summarizeRooms } from "@/lib/roomOccupancy";
import { ensureRentPaymentsForProperty } from "@/lib/billing";
import prisma from "@/lib/prisma";
import { computePaymentStatus, formatCurrency, formatDate, toDateInputValue } from "@/lib/utils";
import { requireUser } from "@/lib/currentUser";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const now = new Date();
  await ensureRentPaymentsForProperty({ userId: user.id, propertyId: id, now });
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const todayInputValue = toDateInputValue(now);

  const chartMonthFilter = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { periodYear: d.getFullYear(), periodMonth: d.getMonth() + 1 };
  });

  const [property, chartPayments] = await Promise.all([
    prisma.property.findUnique({
      where: { id, userId: user.id },
      include: {
        rooms: {
          include: {
            occupancies: {
              where: { status: "ACTIVE" },
              include: {
                tenant: true,
                payments: {
                  orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
                  take: 24,
                },
              },
            },
          },
          orderBy: { name: "asc" },
        },
        expenses: {
          orderBy: [
            { reportingYear: "desc" },
            { reportingMonth: "desc" },
            { paymentDate: "desc" },
          ],
        },
        mortgages: {
          include: {
            prepayments: {
              orderBy: { startDate: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        userId: user.id,
        occupancy: { room: { propertyId: id } },
        OR: chartMonthFilter,
      },
      select: { periodYear: true, periodMonth: true, amountDue: true },
    }),
  ]);

  if (!property) notFound();

  const isFullProperty = property.rentalMode === "FULL_PROPERTY";
  const wholePropertyRoomDetails = isFullProperty
    ? await prisma.room.findFirst({
        where: {
          propertyId: id,
          userId: user.id,
          isDefaultWholePropertyRoom: true,
        },
        include: {
          inventoryItems: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
          occupancies: {
            where: { status: { in: ["ACTIVE", "ENDED"] } },
            include: {
              tenant: true,
              deposit: {
                include: {
                  transactions: { orderBy: { date: "desc" } },
                },
              },
              payments: {
                orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
                take: 24,
              },
              inspections: {
                include: {
                  photos: { orderBy: { uploadedAt: "asc" } },
                  items: {
                    include: { inventoryItem: true },
                    orderBy: { createdAt: "asc" },
                  },
                },
                orderBy: { date: "desc" },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      })
    : null;
  const visibleRooms = property.rooms.filter(isVisibleRoom);
  const wholePropertyOccupancy = wholePropertyRoomDetails?.occupancies.find((o) => o.status === "ACTIVE");
  const wholePropertyPastOccupancies =
    wholePropertyRoomDetails?.occupancies.filter((o) => o.status !== "ACTIVE") ?? [];

  const { totalRooms, occupiedRooms, vacantRooms, monthlyIncome } = summarizeRooms(property.rooms);
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  const monthlyExpenses = getExpenseTotalForMonth(property.expenses, thisYear, thisMonth);
  const monthlyMortgages = property.mortgages
    .reduce((sum, mortgage) => sum + getMonthlyCostForMonth(mortgage, thisYear, thisMonth), 0);
  const monthlyProfit = monthlyIncome - monthlyExpenses - monthlyMortgages;
  const chartData = buildChartData(property.expenses, chartPayments, property.mortgages);

  // Available tenants for assignment (no active occupancy)
  const availableTenants = isFullProperty
    ? await prisma.tenant.findMany({
        where: {
          userId: user.id,
          status: "ACTIVE",
          occupancies: { none: { status: "ACTIVE" } },
        },
        orderBy: { firstName: "asc" },
      })
    : [];

  // Whole-property current period payment & next due
  const wpCurrentPayment = wholePropertyOccupancy?.payments.find(
    (p) => p.periodYear === thisYear && p.periodMonth === thisMonth,
  );
  const wpUpcoming = wholePropertyOccupancy?.payments
    .filter((p) => {
      const isFuture =
        p.periodYear > thisYear ||
        (p.periodYear === thisYear && p.periodMonth > thisMonth);
      const isUnpaid = computePaymentStatus(p) !== "PAID";
      return isFuture && isUnpaid;
    })
    .sort((a, b) => {
      if (a.periodYear !== b.periodYear) return a.periodYear - b.periodYear;
      return a.periodMonth - b.periodMonth;
    })[0];
  const wpOverdue = wholePropertyOccupancy?.payments
    .filter((p) => computePaymentStatus(p) === "OVERDUE")
    .reduce((sum, p) => sum + Math.max(0, p.amountDue - p.amountPaid), 0) ?? 0;

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title={property.name}
        description={`${property.address}, ${property.city}`}
        backHref="/properties"
        backLabel="All properties"
        actions={
          <>
            <ArchivePropertyForm propertyId={id} />
            <Link
              href={`/properties/${id}/edit`}
              className="text-sm font-medium text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-background transition-colors"
            >
              Edit Property
            </Link>
          </>
        }
      />

      <div className="flex-1 p-4 sm:p-6 space-y-6">
        <PropertySubnav propertyId={id} active="overview" />

        {/* ── Summary cards ─────────────────────────────────────────────── */}
        <div data-testid="property-summary-cards" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {isFullProperty ? (
            <div data-testid="property-summary-mode" className="rounded-lg border border-border bg-card px-4 py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rental Mode</p>
              <p className="text-base font-bold text-foreground mt-1">Whole property</p>
              <p className="text-xs text-muted-foreground mt-1">Single tenancy</p>
            </div>
          ) : (
            <div data-testid="property-summary-total-rooms" className="rounded-lg border border-border bg-card px-4 py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Rooms</p>
              <p className="text-2xl font-bold text-foreground mt-1">{totalRooms}</p>
            </div>
          )}

          {!isFullProperty && (
            <div data-testid="property-summary-vacant" className="rounded-lg border border-border bg-card px-4 py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vacant</p>
              <p className="text-2xl font-bold text-foreground mt-1">{vacantRooms}</p>
              {totalRooms > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{occupancyRate}% occupied</p>
              )}
            </div>
          )}

          {isFullProperty && (
            <div data-testid="property-summary-status" className="rounded-lg border border-border bg-card px-4 py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
              <p className="text-base font-bold text-foreground mt-1">
                {wholePropertyOccupancy ? "Tenanted" : "Vacant"}
              </p>
              {wholePropertyOccupancy && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  Since {formatDate(wholePropertyOccupancy.leaseStart)}
                </p>
              )}
            </div>
          )}

          <div data-testid="property-summary-income" className="rounded-lg border border-border bg-card px-4 py-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monthly Income</p>
            <p className="mt-1 break-words text-2xl font-semibold text-foreground">
              {formatCurrency(isFullProperty ? (wholePropertyOccupancy?.monthlyRent ?? property.monthlyRent ?? 0) : monthlyIncome)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isFullProperty ? "whole-property rent" : "contracted rent"}
            </p>
          </div>

          <div data-testid="property-summary-profit" className="rounded-lg border border-border bg-card px-4 py-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monthly Profit</p>
            <p
              data-testid="property-summary-profit-value"
              className={`mt-1 break-words text-2xl font-semibold ${
                monthlyProfit >= 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {formatCurrency(monthlyProfit)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">income − costs</p>
          </div>
        </div>

        {/* ── Whole-property tenancy panel ─────────────────────────────── */}
        {isFullProperty && (
          <div data-testid="whole-property-tenancy-section" className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Whole Property Tenancy</h2>
            {wholePropertyOccupancy ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
                <div data-testid="whole-property-tenant-card" className="bg-card border border-border rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Current Tenant</h3>
                    <EndTenancyForm
                      occupancyId={wholePropertyOccupancy.id}
                      todayInputValue={todayInputValue}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/tenants/${wholePropertyOccupancy.tenantId}`}
                      className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-primary font-semibold text-sm shrink-0 hover:bg-blue-200 transition-colors"
                    >
                      {wholePropertyOccupancy.tenant.firstName[0]}
                      {wholePropertyOccupancy.tenant.lastName[0]}
                    </Link>
                    <div>
                      <Link
                        href={`/tenants/${wholePropertyOccupancy.tenantId}`}
                        className="font-medium text-foreground hover:text-primary transition-colors text-sm"
                      >
                        {wholePropertyOccupancy.tenant.firstName}{" "}
                        {wholePropertyOccupancy.tenant.lastName}
                      </Link>
                      {wholePropertyOccupancy.tenant.email && (
                        <p className="text-xs text-muted-foreground">{wholePropertyOccupancy.tenant.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Lease Start</span>
                      <span className="font-medium text-foreground">
                        {formatDate(wholePropertyOccupancy.leaseStart)}
                      </span>
                    </div>
                    {wholePropertyOccupancy.leaseEnd && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Lease End</span>
                        <span className="font-medium text-foreground">
                          {formatDate(wholePropertyOccupancy.leaseEnd)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Monthly Rent</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(wholePropertyOccupancy.monthlyRent)}
                      </span>
                    </div>
                  </div>
                </div>

                <div data-testid="whole-property-payment-card" className="bg-card border border-border rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">This Month</h3>
                    {wpCurrentPayment && (
                      <PaymentStatusBadge
                        status={computePaymentStatus(wpCurrentPayment)}
                        size="sm"
                      />
                    )}
                  </div>
                  {wpCurrentPayment ? (
                    <>
                      <p className="text-2xl font-bold text-foreground">
                        {formatCurrency(wpCurrentPayment.amountDue)}
                      </p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Due {formatDate(wpCurrentPayment.dueDate)}</p>
                        <p>Paid {formatCurrency(wpCurrentPayment.amountPaid)}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No payment record yet.</p>
                  )}
                  {wpUpcoming && (
                    <div className="pt-3 border-t border-border text-xs text-muted-foreground">
                      Next due {formatDate(wpUpcoming.dueDate)} ·{" "}
                      {formatCurrency(wpUpcoming.amountDue)}
                    </div>
                  )}
                  {wpOverdue > 0 && (
                    <div className="pt-3 border-t border-border">
                      <p className="text-xs font-medium text-destructive">
                        Overdue: {formatCurrency(wpOverdue)}
                      </p>
                    </div>
                  )}
                  <Link
                    href={`/properties/${id}/payments`}
                    className="block text-xs font-medium text-primary hover:text-primary"
                  >
                    View all payments →
                  </Link>
                </div>

                <div data-testid="whole-property-record-payment-card" className="bg-card border border-border rounded-xl p-5">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Record Payment</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Choose a period and save the payment with the button below.
                    </p>
                  </div>
                  <div id="record-payment" className="scroll-mt-6"><RecordPaymentForm
                    currentYear={thisYear}
                    currentMonth={thisMonth}
                    todayInputValue={todayInputValue}
                    payments={wholePropertyOccupancy.payments}
                  /></div>
                </div>

                <div data-testid="whole-property-deposit-card" className="bg-card border border-border rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Deposit</h3>
                    {wholePropertyOccupancy.deposit && (
                      <DepositStatusBadge status={wholePropertyOccupancy.deposit.status} size="sm" />
                    )}
                  </div>

                  {wholePropertyOccupancy.deposit ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Required</span>
                          <span data-testid="deposit-required-value" className="font-semibold text-foreground">
                            {formatCurrency(wholePropertyOccupancy.deposit.required)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Received</span>
                          <span data-testid="deposit-received-value" className="font-semibold text-success">
                            {formatCurrency(wholePropertyOccupancy.deposit.received)}
                          </span>
                        </div>
                        {wholePropertyOccupancy.deposit.receivedAt && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Date Received</span>
                            <span className="text-foreground">
                              {formatDate(wholePropertyOccupancy.deposit.receivedAt)}
                            </span>
                          </div>
                        )}
                      </div>

                      {wholePropertyOccupancy.deposit.transactions.length > 0 && (
                        <div className="pt-3 border-t border-border">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Transactions</p>
                          <div className="space-y-1.5">
                            {wholePropertyOccupancy.deposit.transactions.map((tx) => (
                              <div key={tx.id} className="flex justify-between text-xs">
                                <span className="text-muted-foreground">
                                  {tx.type} · {formatDate(tx.date)}
                                </span>
                                <span
                                  className={`font-medium ${
                                    tx.type === "DEDUCTION"
                                      ? "text-destructive"
                                      : tx.type === "REFUND"
                                      ? "text-orange-600"
                                      : "text-green-600"
                                  }`}
                                >
                                  {tx.type === "DEDUCTION" || tx.type === "REFUND" ? "-" : "+"}
                                  {formatCurrency(tx.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <DepositManager
                        occupancyId={wholePropertyOccupancy.id}
                        required={wholePropertyOccupancy.deposit.required}
                        received={wholePropertyOccupancy.deposit.received}
                        refunded={wholePropertyOccupancy.deposit.refunded}
                        refundDueDate={wholePropertyOccupancy.deposit.refundDueDate}
                        transactions={wholePropertyOccupancy.deposit.transactions}
                        todayInputValue={todayInputValue}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No deposit record</p>
                  )}
                </div>
              </div>
            ) : (
              <div
                data-testid="whole-property-vacant-state"
                className="bg-card border border-border rounded-xl p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      No current tenant
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Start a tenancy to begin billing the whole-property rent of{" "}
                      {formatCurrency(property.monthlyRent ?? 0)}.
                    </p>
                  </div>
                  {property.monthlyRent != null && (
                    <WholePropertyAssignTenant
                      propertyId={id}
                      monthlyRent={property.monthlyRent}
                      tenants={availableTenants}
                      todayInputValue={todayInputValue}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {isFullProperty &&
          wholePropertyPastOccupancies.some(
            (o) => o.deposit && !o.deposit.refunded && o.deposit.refundDueDate,
          ) && (
            <div className="space-y-2">
              {wholePropertyPastOccupancies
                .filter((o) => o.deposit && !o.deposit.refunded && o.deposit.refundDueDate)
                .map((o) => {
                  const refundDue = new Date(o.deposit!.refundDueDate!);
                  const isOverdue = refundDue < now;
                  const summary = summarizeDepositTransactions(
                    o.deposit!.required,
                    o.deposit!.transactions,
                  );

                  return (
                    <div
                      key={o.id}
                      data-testid="deposit-refund-warning"
                      className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${
                        isOverdue ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                      }`}
                    >
                      <span className={`text-base mt-0.5 ${isOverdue ? "text-red-500" : "text-amber-500"}`}>
                        !
                      </span>
                      <div>
                        <p className={`text-sm font-medium ${isOverdue ? "text-red-700" : "text-amber-700"}`}>
                          Deposit return {isOverdue ? "overdue" : "due soon"}
                        </p>
                        <p className={`text-xs mt-0.5 ${isOverdue ? "text-destructive" : "text-amber-600"}`}>
                          {o.tenant.firstName} {o.tenant.lastName} moved out on{" "}
                          {formatDate(o.moveOutDate)}. Deposit of{" "}
                          {formatCurrency(summary.outstandingRefund || o.deposit!.required)} should be returned by{" "}
                          {formatDate(refundDue)}.
                        </p>

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

        {isFullProperty && wholePropertyRoomDetails && (
          <div data-testid="whole-property-inventory-section" className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Property Inventory & Inspections</h2>
            <RoomInventoryManager
              roomId={wholePropertyRoomDetails.id}
              items={wholePropertyRoomDetails.inventoryItems}
              activeOccupancyId={wholePropertyOccupancy?.id ?? null}
            />

            {wholePropertyRoomDetails.occupancies.length > 0 ? (
              wholePropertyRoomDetails.occupancies.map((occupancy) => (
                <InventoryInspectionView
                  key={occupancy.id}
                  roomId={wholePropertyRoomDetails.id}
                  occupancy={occupancy}
                  inventoryItems={wholePropertyRoomDetails.inventoryItems}
                />
              ))
            ) : (
              <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
                Add a tenant before recording check-in or check-out inspections.
              </div>
            )}
          </div>
        )}

        {/* ── Static property information ─────────────────────────────── */}
        <PropertyStaticInfo property={property} />

        {/* ── Financial performance chart ────────────────────────────────── */}
        <div id="financials">
          <PropertyPerformanceChart data={chartData} />
        </div>

        {/* ── Mortgages ─────────────────────────────────────────────────── */}
        <PropertyMortgageSummary propertyId={id} mortgages={property.mortgages} />

        {/* ── Costs summary ─────────────────────────────────────────────── */}
        <PropertyCostsSummary
          propertyId={id}
          expenses={property.expenses}
          currentYear={thisYear}
          currentMonth={thisMonth}
          todayInputValue={todayInputValue}
        />

        {/* ── Rooms (room-level mode only) ──────────────────────────────── */}
        {!isFullProperty && (
          <div id="rooms" data-testid="property-rooms-section" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Rooms</h2>
              <Link
                href={`/properties/${id}/rooms/new`}
                className="rounded-md text-xs font-medium text-primary hover:text-primary"
              >
                + Add Room
              </Link>
            </div>

            {visibleRooms.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <p className="text-sm text-muted-foreground">No rooms yet.</p>
                <Link
                  href={`/properties/${id}/rooms/new`}
                  className="mt-3 inline-block text-sm text-primary font-medium"
                >
                  Add first room →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleRooms.map((room) => {
                  const activeOccupancy = room.occupancies[0];
                  const currentPayment = activeOccupancy?.payments.find(
                    (p) => p.periodYear === thisYear && p.periodMonth === thisMonth,
                  );
                  const currentPaymentStatus = currentPayment ? computePaymentStatus(currentPayment) : null;

                  return (
                    <Link
                      key={room.id}
                      href={`/rooms/${room.id}`}
                      data-testid="room-link"
                      className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3.5 transition hover:border-primary/40 hover:shadow-md sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {room.name}
                          </h3>
                          <RoomStatusBadge status={getDisplayRoomStatus(room)} size="sm" />
                        </div>
                        {activeOccupancy ? (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {activeOccupancy.tenant.firstName}{" "}
                            {activeOccupancy.tenant.lastName}
                            {" · "}Since {formatDate(activeOccupancy.leaseStart)}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">Vacant</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="whitespace-nowrap text-sm font-semibold text-foreground">
                            {formatCurrency(room.monthlyRent)}
                          </p>
                          <p className="text-xs text-muted-foreground">/ mo</p>
                        </div>
                        {currentPayment && (
                          <PaymentStatusBadge status={currentPaymentStatus ?? "UNPAID"} size="sm" className="hidden sm:inline-flex" />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyStaticInfo({
  property,
}: {
  property: {
    propertyType: string;
    totalRoomCount: number | null;
    bedroomCount: number | null;
    bathroomCount: number | null;
    surfaceAreaSqm: number | null;
    hasTerrace: boolean;
    hasBalcony: boolean;
    hasGarden: boolean;
    hasParking: boolean;
    isFurnished: boolean;
    description: string | null;
    postcode: string | null;
    country: string;
  };
}) {
  const features = [
    property.hasTerrace && "Terrace",
    property.hasBalcony && "Balcony",
    property.hasGarden && "Garden",
    property.hasParking && "Parking",
    property.isFurnished && "Furnished",
  ].filter(Boolean) as string[];

  const hasAnyField =
    property.totalRoomCount != null ||
    property.bedroomCount != null ||
    property.bathroomCount != null ||
    property.surfaceAreaSqm != null ||
    features.length > 0 ||
    property.description;

  if (!hasAnyField) return null;

  return (
    <div data-testid="property-static-info" className="bg-card border border-border rounded-xl p-5 sm:p-6 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Property Information</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {property.totalRoomCount != null && (
          <div>
            <p className="text-xs text-muted-foreground">Total Rooms</p>
            <p className="text-base font-semibold text-foreground">{property.totalRoomCount}</p>
          </div>
        )}
        {property.bedroomCount != null && (
          <div>
            <p className="text-xs text-muted-foreground">Bedrooms</p>
            <p className="text-base font-semibold text-foreground">{property.bedroomCount}</p>
          </div>
        )}
        {property.bathroomCount != null && (
          <div>
            <p className="text-xs text-muted-foreground">Bathrooms</p>
            <p className="text-base font-semibold text-foreground">{property.bathroomCount}</p>
          </div>
        )}
        {property.surfaceAreaSqm != null && (
          <div>
            <p className="text-xs text-muted-foreground">Surface</p>
            <p className="text-base font-semibold text-foreground">{property.surfaceAreaSqm} m²</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">Type</p>
          <p className="text-base font-semibold text-foreground capitalize">
            {property.propertyType.toLowerCase()}
          </p>
        </div>
      </div>
      {features.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {features.map((feature) => (
            <span
              key={feature}
              className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full"
            >
              {feature}
            </span>
          ))}
        </div>
      )}
      {property.description && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{property.description}</p>
      )}
    </div>
  );
}
