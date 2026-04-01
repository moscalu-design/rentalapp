import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { MortgagesSection } from "@/components/properties/MortgagesSection";
import { PropertySubnav } from "@/components/properties/PropertySubnav";
import prisma from "@/lib/prisma";

export default async function PropertyMortgagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      mortgages: {
        include: {
          prepayments: {
            orderBy: { startDate: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!property) notFound();

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title={property.name}
        description={`${property.address}, ${property.city}`}
        actions={
          <Link
            href={`/properties/${id}`}
            className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ← Property
          </Link>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        <PropertySubnav propertyId={id} active="mortgages" />

        <MortgagesSection
          propertyId={id}
          mortgages={property.mortgages}
          detailsBasePath={`/properties/${id}/mortgages`}
        />
      </div>
    </div>
  );
}
