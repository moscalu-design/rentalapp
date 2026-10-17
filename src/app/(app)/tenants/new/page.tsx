import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { TenantForm } from "@/components/tenants/TenantForm";

export default function NewTenantPage() {
  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="New Tenant"
        description="Create a new tenant profile"
        actions={
          <Link
            href="/tenants"
            data-testid="new-tenant-list-link"
            className="text-sm font-medium text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-background transition-colors"
          >
            Tenants
          </Link>
        }
      />
      <div className="flex-1 p-4 sm:p-6">
        <TenantForm />
      </div>
    </div>
  );
}
