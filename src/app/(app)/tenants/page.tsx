import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { TenantStatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { requireUser } from "@/lib/currentUser";
import { TENANT_STATUS_LABELS, type TenantStatus } from "@/types";

async function getTenants() {
  const user = await requireUser();
  return prisma.tenant.findMany({
    where: { userId: user.id },
    include: {
      occupancies: {
        where: { status: "ACTIVE" },
        include: { room: { include: { property: true } } },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; status?: string | string[] }>;
}) {
  const [tenants, params] = await Promise.all([getTenants(), searchParams]);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const statusFilter = typeof params.status === "string" && Object.hasOwn(TENANT_STATUS_LABELS, params.status) ? params.status : "";
  const filteredTenants = tenants.filter((tenant) => {
    const occupancy = tenant.occupancies[0];
    const searchText = `${tenant.firstName} ${tenant.lastName} ${tenant.email} ${tenant.phone ?? ""} ${occupancy?.room.property.name ?? ""}`;
    return searchText.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (!statusFilter || tenant.status === statusFilter);
  });

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Tenants"
        description={`${tenants.length} tenant${tenants.length !== 1 ? "s" : ""}`}
        actions={
          <Link
            href="/tenants/new"
            className="rental-button-primary"
          >
            + Add Tenant
          </Link>
        }
      />

      <div className="rental-page flex-1 space-y-5 p-4 sm:p-6">
        {tenants.length > 0 && (
          <form action="/tenants" key={`${query}-${statusFilter}`} className="rental-panel flex flex-wrap items-end gap-3 p-4">
            <label className="min-w-48 flex-1 space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Find a tenant</span>
              <input type="search" name="q" defaultValue={query} maxLength={120} placeholder="Search name, contact details or property" className="rental-input w-full" />
            </label>
            <label className="space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">Status</span>
              <select name="status" defaultValue={statusFilter} className="rental-input">
                <option value="">All statuses</option>
                {Object.entries(TENANT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <button type="submit" className="rental-button-primary">Filter</button>
            {(query || statusFilter) && <Link href="/tenants" className="rental-button-secondary">Clear filters</Link>}
          </form>
        )}
        {(query || statusFilter) && tenants.length > 0 && (
          <p className="text-sm text-muted-foreground">Showing {filteredTenants.length} of {tenants.length} tenants{statusFilter ? ` · ${TENANT_STATUS_LABELS[statusFilter as TenantStatus]}` : ""}</p>
        )}
        {tenants.length === 0 ? (
          <EmptyState
            title="No tenants yet"
            description="Add your first tenant profile."
            action={
              <Link href="/tenants/new" className="rental-button-primary">
                Add Tenant
              </Link>
            }
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
        ) : filteredTenants.length === 0 ? (
          <EmptyState title="No matching tenants" description="Try another name, contact detail or status filter." action={<Link href="/tenants" className="rental-button-secondary">Clear filters</Link>} />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {filteredTenants.map((tenant) => {
                const activeOccupancy = tenant.occupancies[0];
                return (
                  <Link
                    key={tenant.id}
                    href={`/tenants/${tenant.id}`}
                    className="flex items-center gap-3 rental-panel p-4 transition hover:border-primary/30"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                      {tenant.firstName[0]}{tenant.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground truncate">
                          {tenant.firstName} {tenant.lastName}
                        </p>
                        <TenantStatusBadge status={tenant.status} size="sm" />
                      </div>
                      {activeOccupancy ? (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {activeOccupancy.room.property.name}
                          {activeOccupancy.room.isDefaultWholePropertyRoom
                            ? " · Whole property"
                            : ` · ${activeOccupancy.room.name}`}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">Unassigned</p>
                      )}
                      {tenant.email && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{tenant.email}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-hidden rental-panel md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Tenant</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Room</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Email</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Phone</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Since</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTenants.map((tenant) => {
                      const activeOccupancy = tenant.occupancies[0];
                      return (
                        <tr key={tenant.id} className="hover:bg-muted/50">
                          <td className="px-5 py-3">
                            <Link href={`/tenants/${tenant.id}`} className="flex items-center gap-3 group">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                                {tenant.firstName[0]}{tenant.lastName[0]}
                              </div>
                              <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                                {tenant.firstName} {tenant.lastName}
                              </span>
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {activeOccupancy ? (
                              <Link
                                href={
                                  activeOccupancy.room.isDefaultWholePropertyRoom
                                    ? `/properties/${activeOccupancy.room.propertyId}`
                                    : `/rooms/${activeOccupancy.room.id}`
                                }
                                className="hover:text-primary"
                              >
                                {activeOccupancy.room.property.name}
                                {activeOccupancy.room.isDefaultWholePropertyRoom
                                  ? " · Whole property"
                                  : ` · ${activeOccupancy.room.name}`}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground"><a href={`mailto:${tenant.email}`} className="hover:text-primary hover:underline">{tenant.email}</a></td>
                          <td className="px-5 py-3 text-muted-foreground">{tenant.phone ? <a href={`tel:${tenant.phone}`} className="hover:text-primary hover:underline">{tenant.phone}</a> : "—"}</td>
                          <td className="px-5 py-3">
                            <TenantStatusBadge status={tenant.status} size="sm" />
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {activeOccupancy ? formatDate(activeOccupancy.leaseStart) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
