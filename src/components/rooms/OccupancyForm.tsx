"use client";

import { useId } from "react";

import { useFormStatus } from "react-dom";
import { updateOccupancy } from "@/actions/occupancies";
import type { Occupancy, Tenant } from "@/generated/prisma/client";
import { toDateInputValue } from "@/lib/utils";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary hover:bg-primary disabled:opacity-60 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
    >
      {pending ? "Saving…" : "Save Changes"}
    </button>
  );
}

interface OccupancyFormProps {
  occupancy: Occupancy;
  tenant: Pick<Tenant, "firstName" | "lastName" | "email">;
}

export function OccupancyForm({ occupancy, tenant }: OccupancyFormProps) {
  const formId = useId();
  const action = updateOccupancy.bind(null, occupancy.id);

  return (
    <form action={action} className="space-y-6 max-w-2xl">
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Tenancy Details</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {tenant.firstName} {tenant.lastName} {tenant.email ? `· ${tenant.email}` : ""}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${formId}-leaseStart`} className="block text-sm font-medium text-foreground mb-1.5">
              Lease Start <span className="text-red-500">*</span>
            </label>
            <input id={`${formId}-leaseStart`} aria-describedby={`${formId}-payment-dates-hint`}
              type="date"
              name="leaseStart"
              required
              defaultValue={toDateInputValue(occupancy.leaseStart)}
              data-testid="edit-occupancy-lease-start"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-leaseEnd`} className="block text-sm font-medium text-foreground mb-1.5">
              Lease End
            </label>
            <input id={`${formId}-leaseEnd`}
              type="date"
              name="leaseEnd"
              defaultValue={toDateInputValue(occupancy.leaseEnd)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-moveInDate`} className="block text-sm font-medium text-foreground mb-1.5">
              Move-in Date
            </label>
            <input id={`${formId}-moveInDate`}
              type="date"
              name="moveInDate"
              defaultValue={toDateInputValue(occupancy.moveInDate)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-paymentGracePeriodDays`} className="block text-sm font-medium text-foreground mb-1.5">
              Payment Grace Period (days)
            </label>
            <input id={`${formId}-paymentGracePeriodDays`} aria-describedby={`${formId}-payment-dates-hint`}
              type="number"
              name="paymentGracePeriodDays"
              min="0"
              step="1"
              defaultValue={occupancy.paymentGracePeriodDays ?? 5}
              data-testid="edit-occupancy-payment-grace-period-days"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="rounded-lg border border-border bg-background px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Current Rent Terms</p>
            <p className="mt-1 text-sm text-foreground">
              Rent {occupancy.monthlyRent} · Bill day {occupancy.rentDueDay} · Grace {occupancy.paymentGracePeriodDays ?? 5} days
            </p>
            <p id={`${formId}-payment-dates-hint`} className="mt-1 text-xs text-muted-foreground">Changing lease start or grace period also updates monthly payment due dates.</p>
          </div>
        </div>

        <div>
          <label htmlFor={`${formId}-notes`} className="block text-sm font-medium text-foreground mb-1.5">Notes</label>
          <textarea id={`${formId}-notes`}
            name="notes"
            defaultValue={occupancy.notes ?? ""}
            rows={4}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
        <a href={`/rooms/${occupancy.roomId}`} className="text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </a>
      </div>
    </form>
  );
}
