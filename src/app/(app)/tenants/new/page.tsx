import { TopBar } from "@/components/layout/TopBar";
import { TenantForm } from "@/components/tenants/TenantForm";

export default function NewTenantPage() {
  return (
    <div className="flex flex-col flex-1">
      <TopBar title="New Tenant" description="Create a new tenant profile" />
      <div className="flex-1 p-6">
        <TenantForm />
      </div>
    </div>
  );
}
