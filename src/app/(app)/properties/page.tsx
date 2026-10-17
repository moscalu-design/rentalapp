import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { getPropertyOccupancy } from "@/lib/propertyOccupancy";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { requireUser } from "@/lib/currentUser";
import { PROPERTY_TYPE_LABELS, type PropertyType } from "@/types";

async function getProperties() {
  const user = await requireUser();
  return prisma.property.findMany({
    where: { userId: user.id, status: { not: "ARCHIVED" } },
    include: {
      rooms: {
        include: {
          occupancies: {
            where: { status: "ACTIVE" },
            select: { status: true, monthlyRent: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; availability?: string | string[] }>;
}) {
  const [properties, params] = await Promise.all([getProperties(), searchParams]);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const availability = params.availability === "vacant" || params.availability === "occupied" ? params.availability : "";
  const filteredProperties = properties.filter((property) => {
    const matchesQuery = `${property.name} ${property.address} ${property.city}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    const { vacantUnits, totalUnits } = getPropertyOccupancy(property.rentalMode, property.rooms);
    const matchesAvailability = !availability || (availability === "vacant" ? vacantUnits > 0 : totalUnits > 0 && vacantUnits === 0);
    return matchesQuery && matchesAvailability;
  });

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Properties"
        description={`${properties.length} active propert${properties.length === 1 ? "y" : "ies"}`}
        actions={
          <Link
            href="/properties/new"
            className="rental-button-primary"
          >
            + Add Property
          </Link>
        }
      />

      <div className="rental-page flex-1 space-y-5 p-4 sm:p-6">
        {properties.length > 0 && (
          <form action="/properties" key={`${query}-${availability}`} className="rental-panel flex flex-wrap items-end gap-3 p-4">
            <label className="min-w-48 flex-1 space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Find a property</span>
              <input type="search" name="q" defaultValue={query} maxLength={120} placeholder="Search name, address or city" className="rental-input w-full" />
            </label>
            <label className="space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">Availability</span>
              <select name="availability" defaultValue={availability} className="rental-input">
                <option value="">All properties</option>
                <option value="vacant">With vacancies</option>
                <option value="occupied">Fully occupied</option>
              </select>
            </label>
            <button type="submit" className="rental-button-primary">Filter</button>
            {(query || availability) && <Link href="/properties" className="rental-button-secondary">Clear filters</Link>}
          </form>
        )}
        {(query || availability) && properties.length > 0 && (
          <p className="text-sm text-muted-foreground">Showing {filteredProperties.length} of {properties.length} properties</p>
        )}
        {properties.length === 0 ? (
          <EmptyState
            title="No properties yet"
            description="Add your first property to get started."
            action={
              <Link href="/properties/new" className="rental-button-primary">
                Add Property
              </Link>
            }
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
            }
          />
        ) : filteredProperties.length === 0 ? (
          <EmptyState title="No matching properties" description="Try another name, address or availability filter." action={<Link href="/properties" className="rental-button-secondary">Clear filters</Link>} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProperties.map((property) => {
              const isFullProperty = property.rentalMode === "FULL_PROPERTY";
              const { totalRooms, occupiedRooms, occupiedUnits, monthlyIncome } = getPropertyOccupancy(property.rentalMode, property.rooms);
              const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

              return (
                <Link
                  key={property.id}
                  href={`/properties/${property.id}`}
                  data-testid="property-link"
                  className="group flex min-h-44 flex-col rental-panel p-5 transition hover:border-primary/30"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {property.name}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {property.address}, {property.city}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                      {PROPERTY_TYPE_LABELS[property.propertyType as PropertyType] ?? property.propertyType}
                    </span>
                  </div>

                  <div className="mt-auto grid grid-cols-3 gap-3 border-t border-border pt-4">
                    {isFullProperty ? (
                      <>
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold text-foreground">
                            {occupiedUnits === 0 ? "Vacant" : "Tenanted"}
                          </p>
                          <p className="text-xs text-muted-foreground">Status</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold text-foreground">Whole</p>
                          <p className="text-xs text-muted-foreground">Rental</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold text-foreground">{occupiedRooms}<span className="text-sm text-muted-foreground font-medium">/{totalRooms}</span></p>
                          <p className="text-xs text-muted-foreground">Occupied</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold text-foreground">{occupancyRate}<span className="text-sm text-muted-foreground font-medium">%</span></p>
                          <p className="text-xs text-muted-foreground">Occupancy</p>
                        </div>
                      </>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-foreground sm:text-lg">
                        {formatCurrency(
                          isFullProperty
                            ? occupiedUnits > 0 ? monthlyIncome : (property.monthlyRent ?? 0)
                            : monthlyIncome,
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{isFullProperty && occupiedUnits === 0 ? "Asking rent / month" : "Lease rent / month"}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
