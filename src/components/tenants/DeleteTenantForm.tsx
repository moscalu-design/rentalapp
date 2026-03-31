"use client";

import { deleteTenant } from "@/actions/tenants";

interface DeleteTenantFormProps {
  tenantId: string;
}

export function DeleteTenantForm({ tenantId }: DeleteTenantFormProps) {
  return (
    <form action={deleteTenant.bind(null, tenantId)}>
      <button
        type="submit"
        data-testid="delete-tenant-button"
        className="text-sm font-medium text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
        onClick={(event) => {
          if (!confirm("Delete this tenant? This action cannot be undone.")) {
            event.preventDefault();
          }
        }}
      >
        Delete Tenant
      </button>
    </form>
  );
}
