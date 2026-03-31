import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { TenantForm } from "@/components/tenants/TenantForm";
import prisma from "@/lib/prisma";

export default async function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) notFound();

  return (
    <div className="flex flex-col flex-1">
      <TopBar title="Edit Tenant" description={`${tenant.firstName} ${tenant.lastName}`} />
      <div className="flex-1 p-6">
        <TenantForm tenant={tenant} />
      </div>
    </div>
  );
}
