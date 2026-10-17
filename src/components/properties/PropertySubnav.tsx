import Link from "next/link";

const ITEMS = [
  { key: "overview", label: "Overview" },
  { key: "payments", label: "Payments" },
  { key: "mortgages", label: "Mortgages" },
  { key: "costs", label: "Costs" },
] as const;

type SubnavKey = typeof ITEMS[number]["key"];

export function PropertySubnav({
  propertyId,
  active,
}: {
  propertyId: string;
  active: SubnavKey;
}) {
  const hrefs: Record<SubnavKey, string> = {
    overview: `/properties/${propertyId}`,
    payments: `/properties/${propertyId}/payments`,
    mortgages: `/properties/${propertyId}/mortgages`,
    costs: `/properties/${propertyId}/costs`,
  };

  return (
    <nav
      aria-label="Property sections"
      className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
    >
      <div className="inline-flex rounded-xl border border-border bg-muted p-1">
        {ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={hrefs[item.key]}
              aria-current={isActive ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:py-2 sm:text-sm ${
                isActive
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
