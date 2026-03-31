import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { TenantStatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

async function getTenants() {
  return prisma.tenant.findMany({
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

export default async function TenantsPage() {
  const tenants = await getTenants();

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Tenants"
        description={`${tenants.length} tenant${tenants.length !== 1 ? "s" : ""}`}
        actions={
          <Link
            href="/tenants/new"
            className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Add Tenant
          </Link>
        }
      />

      <div className="flex-1 p-6">
        {tenants.length === 0 ? (
          <EmptyState
            title="No tenants yet"
            description="Add your first tenant profile."
            action={
              <Link href="/tenants/new" className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Add Tenant
              </Link>
            }
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Tenant</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Room</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Email</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Phone</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((tenant) => {
                  const activeOccupancy = tenant.occupancies[0];
                  return (
                    <tr key={tenant.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link href={`/tenants/${tenant.id}`} className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-xs shrink-0">
                            {tenant.firstName[0]}{tenant.lastName[0]}
                          </div>
                          <span className="font-medium text-slate-800 group-hover:text-blue-600 transition-colors">
                            {tenant.firstName} {tenant.lastName}
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {activeOccupancy ? (
                          <Link href={`/rooms/${activeOccupancy.room.id}`} className="hover:text-blue-600">
                            {activeOccupancy.room.property.name} · {activeOccupancy.room.name}
                          </Link>
                        ) : (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{tenant.email}</td>
                      <td className="px-5 py-3 text-slate-500">{tenant.phone ?? "—"}</td>
                      <td className="px-5 py-3">
                        <TenantStatusBadge status={tenant.status} size="sm" />
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {activeOccupancy ? formatDate(activeOccupancy.leaseStart) : "—"}
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
