"use client";

import { archiveProperty } from "@/actions/properties";

interface ArchivePropertyFormProps {
  propertyId: string;
}

export function ArchivePropertyForm({ propertyId }: ArchivePropertyFormProps) {
  return (
    <form action={archiveProperty.bind(null, propertyId)}>
      <button
        type="submit"
        data-testid="archive-property-button"
        className="text-sm font-medium text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
        onClick={(event) => {
          if (!confirm("Archive this property? It will be removed from the active properties list.")) {
            event.preventDefault();
          }
        }}
      >
        Archive Property
      </button>
    </form>
  );
}
