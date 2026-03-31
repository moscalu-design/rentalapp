"use client";

import { endOccupancy } from "@/actions/occupancies";

interface EndTenancyFormProps {
  occupancyId: string;
}

export function EndTenancyForm({ occupancyId }: EndTenancyFormProps) {
  return (
    <form action={endOccupancy.bind(null, occupancyId)}>
      <button
        type="submit"
        className="text-xs text-red-600 hover:text-red-700 font-medium"
        onClick={(event) => {
          if (!confirm("End this tenancy? This will mark the room as vacant.")) {
            event.preventDefault();
          }
        }}
      >
        End Tenancy
      </button>
    </form>
  );
}
