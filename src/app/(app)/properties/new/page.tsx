import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { PropertyForm } from "@/components/properties/PropertyForm";

export default function NewPropertyPage() {
  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="New Property"
        description="Add a new property to your portfolio"
        actions={
          <Link
            href="/properties"
            data-testid="new-property-list-link"
            className="text-sm font-medium text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-background transition-colors"
          >
            Properties
          </Link>
        }
      />
      <div className="flex-1 p-4 sm:p-6">
        <PropertyForm />
      </div>
    </div>
  );
}
