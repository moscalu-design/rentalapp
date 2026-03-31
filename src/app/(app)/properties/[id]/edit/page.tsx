import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PropertyForm } from "@/components/properties/PropertyForm";
import prisma from "@/lib/prisma";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) notFound();

  return (
    <div className="flex flex-col flex-1">
      <TopBar title="Edit Property" description={property.name} />
      <div className="flex-1 p-6">
        <PropertyForm property={property} />
      </div>
    </div>
  );
}
