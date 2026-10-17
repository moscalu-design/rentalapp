"use client";

import { useId } from "react";

import { useFormStatus } from "react-dom";
import { createTenant, updateTenant } from "@/actions/tenants";
import type { Tenant } from "@/generated/prisma/client";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary hover:bg-primary disabled:opacity-60 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

export function TenantForm({ tenant }: { tenant?: Tenant }) {
  const formId = useId();
  const action = tenant ? updateTenant.bind(null, tenant.id) : createTenant;

  return (
    <form action={action} className="space-y-6 max-w-2xl">
      {/* Personal Details */}
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Personal Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${formId}-firstName`} className="block text-sm font-medium text-foreground mb-1.5">
              First Name <span className="text-red-500">*</span>
            </label>
            <input id={`${formId}-firstName`}
              name="firstName"
              required
              defaultValue={tenant?.firstName}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-lastName`} className="block text-sm font-medium text-foreground mb-1.5">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input id={`${formId}-lastName`}
              name="lastName"
              required
              defaultValue={tenant?.lastName}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-email`} className="block text-sm font-medium text-foreground mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input id={`${formId}-email`}
              name="email"
              type="email"
              required
              defaultValue={tenant?.email}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-phone`} className="block text-sm font-medium text-foreground mb-1.5">Phone</label>
            <input id={`${formId}-phone`}
              name="phone"
              type="tel"
              defaultValue={tenant?.phone ?? ""}
              placeholder="+44 7700 000000"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-nationality`} className="block text-sm font-medium text-foreground mb-1.5">Nationality</label>
            <input id={`${formId}-nationality`}
              name="nationality"
              defaultValue={tenant?.nationality ?? ""}
              placeholder="British"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-dateOfBirth`} className="block text-sm font-medium text-foreground mb-1.5">Date of Birth</label>
            <input id={`${formId}-dateOfBirth`}
              name="dateOfBirth"
              type="date"
              defaultValue={tenant?.dateOfBirth ? new Date(tenant.dateOfBirth).toISOString().split("T")[0] : ""}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-status`} className="block text-sm font-medium text-foreground mb-1.5">Status</label>
            <select id={`${formId}-status`}
              name="status"
              defaultValue={tenant?.status ?? "ACTIVE"}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            >
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="PAST">Past Tenant</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor={`${formId}-emergencyContact`} className="block text-sm font-medium text-foreground mb-1.5">Emergency Contact</label>
          <input id={`${formId}-emergencyContact`}
            name="emergencyContact"
            defaultValue={tenant?.emergencyContact ?? ""}
            placeholder="Name, phone, relationship"
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
      </div>

      {/* ID & Documents */}
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">ID &amp; Documents</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${formId}-idType`} className="block text-sm font-medium text-foreground mb-1.5">ID Type</label>
            <select id={`${formId}-idType`}
              name="idType"
              defaultValue={tenant?.idType ?? ""}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            >
              <option value="">— None —</option>
              <option value="PASSPORT">Passport</option>
              <option value="DRIVERS_LICENSE">Driver&apos;s License</option>
              <option value="NATIONAL_ID">National ID</option>
            </select>
          </div>

          <div>
            <label htmlFor={`${formId}-idReference`} className="block text-sm font-medium text-foreground mb-1.5">ID Reference</label>
            <input id={`${formId}-idReference`}
              name="idReference"
              defaultValue={tenant?.idReference ?? ""}
              placeholder="Document number"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
        <label htmlFor={`${formId}-notes`} className="block text-sm font-semibold text-foreground mb-2">Notes</label>
        <textarea id={`${formId}-notes`}
          name="notes"
          defaultValue={tenant?.notes ?? ""}
          rows={3}
          placeholder="Any internal notes about this tenant…"
          className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton label={tenant ? "Save Changes" : "Create Tenant"} />
        <a
          href={tenant ? `/tenants/${tenant.id}` : "/tenants"}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
