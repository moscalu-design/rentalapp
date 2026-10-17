import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { StatCard } from "@/components/shared/StatCard";
import { PaymentStatusBadge } from "@/components/shared/StatusBadge";
import { ensureRentPaymentsForUser } from "@/lib/billing";
import { summarizeRooms } from "@/lib/roomOccupancy";
import { getPropertyOccupancy } from "@/lib/propertyOccupancy";
import prisma from "@/lib/prisma";
import { computePaymentStatus, formatCurrency, formatDate } from "@/lib/utils";
import { requireUser } from "@/lib/currentUser";
import { getPaymentAction } from "@/lib/paymentNavigation";

async function getDashboardData() {
  const user = await requireUser();
  const now = new Date();
  await ensureRentPaymentsForUser({ userId: user.id, now });
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [
    properties,
    rooms,
    currentMonthPayments,
    recentActivity,
  ] = await Promise.all([
    prisma.property.findMany({ where: { userId: user.id, status: { not: "ARCHIVED" } } }),
    prisma.room.findMany({
      where: { userId: user.id, property: { status: { not: "ARCHIVED" } } },
      include: {
        occupancies: {
          where: { status: "ACTIVE" },
          select: { status: true, monthlyRent: true },
        },
      },
    }),
    prisma.payment.findMany({
      where: { userId: user.id, periodYear: year, periodMonth: month },
      include: {
        occupancy: {
          include: {
            tenant: true,
            room: { include: { property: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.activityLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { property: true, room: true, tenant: true },
    }),
  ]);

  const { totalRooms, occupiedRooms, vacantRooms } = summarizeRooms(rooms);
  const vacantWholeProperties = properties
    .filter((property) => property.rentalMode === "FULL_PROPERTY")
    .reduce((total, property) => total + getPropertyOccupancy(property.rentalMode, rooms.filter((room) => room.propertyId === property.id)).vacantUnits, 0);
  const currentMonthPaymentsWithStatus = currentMonthPayments.map((payment) => ({
    ...payment,
    derivedStatus: computePaymentStatus(payment),
  }));

  const rentDue = currentMonthPaymentsWithStatus
    .filter((p) => ["UNPAID", "PARTIAL", "OVERDUE"].includes(p.derivedStatus))
    .reduce((sum, p) => sum + p.amountDue - p.amountPaid, 0);

  const rentReceived = currentMonthPaymentsWithStatus
    .filter((p) => p.amountPaid > 0)
    .reduce((sum, p) => sum + p.amountPaid, 0);

  const overduePayments = currentMonthPaymentsWithStatus.filter((p) => p.derivedStatus === "OVERDUE");

  return {
    propertyCount: properties.length,
    totalRooms,
    occupiedRooms,
    vacantRooms,
    vacantWholeProperties,
    rentDue,
    rentReceived,
    overduePayments,
    currentMonthPayments: currentMonthPaymentsWithStatus,
    recentActivity,
    year,
    month,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const monthName = new Date(data.year, data.month - 1).toLocaleString("en-GB", { month: "long" });
  const ledgerHref = `/payments?year=${data.year}&month=${data.month}`;
  const priority: Record<string, number> = { OVERDUE: 0, PARTIAL: 1, UNPAID: 2, PAID: 3, WAIVED: 4 };
  const priorityPayments = [...data.currentMonthPayments].sort((a, b) => priority[a.derivedStatus] - priority[b.derivedStatus]);
  const vacancyDescription = [
    data.vacantRooms > 0 ? `${data.vacantRooms} vacant room${data.vacantRooms === 1 ? "" : "s"}` : "",
    data.vacantWholeProperties > 0 ? `${data.vacantWholeProperties} vacant propert${data.vacantWholeProperties === 1 ? "y" : "ies"}` : "",
  ].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Dashboard"
        description={`Your rental business · ${monthName} ${data.year}`}
        actions={<Link href={ledgerHref} className="rental-button-primary">Open rent ledger</Link>}
      />

      <div className="rental-page flex-1 space-y-6 p-4 sm:p-6">
        {/* Stats grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Properties"
            value={data.propertyCount}
            sub="active"
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
          />
          <StatCard
            label="Occupied Rooms"
            value={`${data.occupiedRooms} / ${data.totalRooms}`}
            sub={`${data.vacantRooms} vacant · room lets only`}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>}
          />
          <StatCard
            label="Rent Received"
            value={formatCurrency(data.rentReceived)}
            sub={`${monthName}`}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard
            label="Outstanding"
            value={formatCurrency(data.rentDue)}
            sub={`${data.overduePayments.length} overdue · ${monthName}`}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
          />
        </div>

        <section className="rental-panel overflow-hidden" aria-labelledby="next-actions-title">
          <div className="border-b border-border px-5 py-4">
            <h2 id="next-actions-title" className="text-sm font-semibold text-foreground">Next actions</h2>
          </div>
          <div className="divide-y divide-border">
            {data.propertyCount === 0 ? (
              <Link href="/properties/new" className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/50">
                <div><p className="text-sm font-medium text-foreground">Start your rental portfolio</p><p className="mt-1 text-xs text-muted-foreground">Add a property, then its tenancy and rent schedule.</p></div>
                <span className="text-sm font-medium text-primary">Add property</span>
              </Link>
            ) : (
              <Link href={`${ledgerHref}${data.overduePayments.length ? "&status=OVERDUE" : ""}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{data.overduePayments.length ? `${data.overduePayments.length} overdue payment${data.overduePayments.length === 1 ? "" : "s"} to review` : `Review ${monthName} rent`}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{data.rentDue > 0 ? `${formatCurrency(data.rentDue)} remains outstanding for this period.` : "No outstanding rent recorded for this period."}</p>
                </div>
                <span className="text-sm font-medium text-primary">{data.overduePayments.length ? "Review overdue rent" : "Open ledger"}</span>
              </Link>
            )}
            {vacancyDescription && (
              <Link href="/properties?availability=vacant" className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/50">
                <div><p className="text-sm font-medium text-foreground">{vacancyDescription}</p><p className="mt-1 text-xs text-muted-foreground">Review the property and prepare its next tenancy.</p></div>
                <span className="text-sm font-medium text-primary">Review vacancies</span>
              </Link>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* This month's payments */}
          <div className="overflow-hidden rental-panel lg:col-span-2">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div><h2 className="text-sm font-semibold text-foreground">{monthName} Payments</h2><p className="mt-1 text-xs text-muted-foreground">Outstanding payments first · {data.currentMonthPayments.length} total</p></div>
              <Link href={ledgerHref} className="rounded-md text-xs font-medium text-primary hover:text-primary">
                View all
              </Link>
            </div>
            <div className="divide-y divide-border">
              {data.currentMonthPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No payments this month</p>
              ) : (
                priorityPayments.slice(0, 6).map((payment) => (
                  <Link
                    key={payment.id}
                    href={getPaymentAction(payment).href}
                    className="group flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary">
                        {payment.occupancy.tenant.firstName} {payment.occupancy.tenant.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {payment.occupancy.room.property.name}
                        {payment.occupancy.room.isDefaultWholePropertyRoom
                          ? " · Whole property"
                          : ` · ${payment.occupancy.room.name}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 sm:ml-4">
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(payment.amountDue)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Due {formatDate(payment.dueDate)}</p>
                      </div>
                      <PaymentStatusBadge status={payment.derivedStatus} size="sm" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="overflow-hidden rental-panel">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
            </div>
            <div className="divide-y divide-border">
              {data.recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>
              ) : (
                data.recentActivity.map((log) => (
                  <div key={log.id} className="px-5 py-3">
                    <p className="text-xs font-medium text-foreground leading-snug">{log.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(log.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { href: "/properties/new", label: "Add Property" },
            { href: "/tenants/new", label: "Add Tenant" },
            { href: "/payments", label: "Rent Ledger" },
            { href: "/properties", label: "Portfolio" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rental-button-secondary px-4 py-3.5 text-center"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
