import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { TenantStatusBadge, PaymentStatusBadge, DepositStatusBadge } from "@/components/shared/StatusBadge";
import { DocumentsSection } from "@/components/documents/DocumentsSection";
import { DeleteTenantForm } from "@/components/tenants/DeleteTenantForm";
import prisma from "@/lib/prisma";
import { computePaymentStatus, formatCurrency, formatDate, formatMonthYear } from "@/lib/utils";
import { requireUser } from "@/lib/currentUser";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [tenant, rawDocs] = await Promise.all([
    prisma.tenant.findUnique({
    where: { id, userId: user.id },
    include: {
      occupancies: {
        include: {
          room: { include: { property: true } },
          deposit: true,
          payments: {
            orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
            take: 24,
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  }),
    prisma.tenantDocument.findMany({
      where: { tenantId: id, userId: user.id },
      select: { id: true, type: true, fileName: true, fileSize: true, uploadedAt: true },
    }),
  ]);

  if (!tenant) notFound();

  // Build a map keyed by type — storageUrl is intentionally excluded
  type DocType = "idDocument" | "workContract" | "salarySlip";
  const documents = Object.fromEntries(
    rawDocs.map((d) => [d.type, { id: d.id, fileName: d.fileName, fileSize: d.fileSize, uploadedAt: d.uploadedAt }])
  ) as Partial<Record<DocType, { id: string; fileName: string; fileSize: number; uploadedAt: Date }>>;

  const activeOccupancy = tenant.occupancies.find((o) => o.status === "ACTIVE");
  const pastOccupancies = tenant.occupancies.filter((o) => o.status !== "ACTIVE");

  const totalPaid = tenant.occupancies
    .flatMap((o) => o.payments)
    .reduce((sum, p) => sum + p.amountPaid, 0);

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title={`${tenant.firstName} ${tenant.lastName}`}
        description={tenant.email}
        backHref="/tenants"
        backLabel="All tenants"
        actions={
          <>
            {activeOccupancy && (
              <>
                <Link
                  href={`/properties/${activeOccupancy.room.propertyId}`}
                  data-testid="tenant-active-property-link"
                  className="text-sm font-medium text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-background transition-colors"
                >
                  Property
                </Link>
                <Link
                  href={`/rooms/${activeOccupancy.roomId}`}
                  data-testid="tenant-active-room-link"
                  className="text-sm font-medium text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-background transition-colors"
                >
                  Room
                </Link>
              </>
            )}
            <TenantStatusBadge status={tenant.status} />
            {!activeOccupancy && <DeleteTenantForm tenantId={id} />}
            <Link
              href={`/tenants/${id}/edit`}
              className="text-sm font-medium text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-background transition-colors"
            >
              Edit
            </Link>
          </>
        }
      />

      <div className="flex-1 p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-primary font-bold text-lg shrink-0">
                {tenant.firstName[0]}{tenant.lastName[0]}
              </div>
              <div>
                <h2 className="font-semibold text-foreground">{tenant.firstName} {tenant.lastName}</h2>
                <p className="text-sm text-muted-foreground">{tenant.email}</p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border text-sm">
              {tenant.phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="text-foreground">{tenant.phone}</span>
                </div>
              )}
              {tenant.nationality && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nationality</span>
                  <span className="text-foreground">{tenant.nationality}</span>
                </div>
              )}
              {tenant.dateOfBirth && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date of Birth</span>
                  <span className="text-foreground">{formatDate(tenant.dateOfBirth)}</span>
                </div>
              )}
              {tenant.emergencyContact && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">Emergency Contact</span>
                  <span className="text-foreground">{tenant.emergencyContact}</span>
                </div>
              )}
              {tenant.idType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID</span>
                  <span className="text-foreground">{tenant.idType.replace("_", " ")} {tenant.idReference ? `· ${tenant.idReference}` : ""}</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">Total Paid (all time)</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(totalPaid)}</p>
            </div>
          </div>

          {/* Current Tenancy */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Current Tenancy</h2>
            {activeOccupancy ? (
              <>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Property</span>
                    <Link href={`/properties/${activeOccupancy.room.propertyId}`} className="text-primary hover:text-primary font-medium">
                      {activeOccupancy.room.property.name}
                    </Link>
                  </div>
                  {activeOccupancy.room.isDefaultWholePropertyRoom ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unit</span>
                      <span className="text-foreground font-medium">Whole property</span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Room</span>
                      <Link href={`/rooms/${activeOccupancy.roomId}`} className="text-primary hover:text-primary font-medium">
                        {activeOccupancy.room.name}
                      </Link>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lease Start</span>
                    <span className="text-foreground">{formatDate(activeOccupancy.leaseStart)}</span>
                  </div>
                  {activeOccupancy.leaseEnd && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lease End</span>
                      <span className="text-foreground">{formatDate(activeOccupancy.leaseEnd)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Rent</span>
                    <span className="font-semibold text-foreground">{formatCurrency(activeOccupancy.monthlyRent)}</span>
                  </div>
                </div>

                {activeOccupancy.deposit && (
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Deposit</span>
                      <DepositStatusBadge status={activeOccupancy.deposit.status} size="sm" />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(activeOccupancy.deposit.received)} / {formatCurrency(activeOccupancy.deposit.required)} received
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No active tenancy.</p>
            )}
          </div>

          {/* Notes */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Notes</h2>
            {tenant.notes ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tenant.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No notes.</p>
            )}
          </div>
        </div>

        {/* Documents */}
        <DocumentsSection tenantId={id} initialDocuments={documents} />

        {/* Payment history */}
        {activeOccupancy && activeOccupancy.payments.length > 0 && (
          <div className="bg-card border border-border rounded-xl">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Payment History</h2>
            </div>

            {/* Mobile list */}
            <div className="divide-y divide-border md:hidden">
              {activeOccupancy.payments.map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{formatMonthYear(p.periodYear, p.periodMonth)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatCurrency(p.amountDue)} due
                      {p.amountPaid > 0 ? ` · ${formatCurrency(p.amountPaid)} paid` : ""}
                    </p>
                    {p.paidAt && (
                      <p className="text-xs text-muted-foreground mt-0.5">Paid {formatDate(p.paidAt)}</p>
                    )}
                  </div>
                  <PaymentStatusBadge status={computePaymentStatus(p)} size="sm" />
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Period</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Due</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Paid</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Date Paid</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeOccupancy.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-background">
                      <td className="px-5 py-3 font-medium text-foreground">{formatMonthYear(p.periodYear, p.periodMonth)}</td>
                      <td className="px-5 py-3 text-foreground">{formatCurrency(p.amountDue)}</td>
                      <td className="px-5 py-3 text-foreground">{p.amountPaid > 0 ? formatCurrency(p.amountPaid) : "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{formatDate(p.paidAt)}</td>
                      <td className="px-5 py-3"><PaymentStatusBadge status={computePaymentStatus(p)} size="sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Past tenancies */}
        {pastOccupancies.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Past Tenancies</h2>
            <div className="space-y-2">
              {pastOccupancies.map((occ) => (
                <div key={occ.id} className="flex justify-between text-sm py-2 border-b border-border last:border-0">
                  <div>
                    <Link
                      href={
                        occ.room.isDefaultWholePropertyRoom
                          ? `/properties/${occ.room.propertyId}`
                          : `/rooms/${occ.roomId}`
                      }
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {occ.room.property.name}
                      {occ.room.isDefaultWholePropertyRoom
                        ? " · Whole property"
                        : ` · ${occ.room.name}`}
                    </Link>
                  </div>
                  <div className="text-muted-foreground">
                    {formatDate(occ.leaseStart)} → {occ.moveOutDate ? formatDate(occ.moveOutDate) : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
