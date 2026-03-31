import { TopBar } from "@/components/layout/TopBar";
import { PropertyForm } from "@/components/properties/PropertyForm";

export default function NewPropertyPage() {
  return (
    <div className="flex flex-col flex-1">
      <TopBar title="New Property" description="Add a new property to your portfolio" />
      <div className="flex-1 p-6">
        <PropertyForm />
      </div>
    </div>
  );
}
