import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { MortgageDetailView } from "@/components/properties/MortgagesSection";
import { PropertySubnav } from "@/components/properties/PropertySubnav";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/currentUser";

export default async function MortgageDetailPage({
  params,
}: {
  params: Promise<{ id: string; mortgageId: string }>;
}) {
  const { id, mortgageId } = await params;
  const user = await requireUser();

  const property = await prisma.property.findUnique({
    where: { id, userId: user.id },
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

  const mortgage = property.mortgages.find((entry) => entry.id === mortgageId);
  if (!mortgage) notFound();

  const bankPayments = await prisma.verityAllocation.findMany({
    where: { userId: user.id, kind: "mortgage", targetId: mortgage.id, status: "CONFIRMED" },
    include: { transaction: { select: { postedDate: true, currency: true, accountName: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });
  const mortgageLabel = mortgage.label || mortgage.lender || "Mortgage";

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title={mortgageLabel}
        description={`${property.name} · Mortgage details`}
        actions={
          <Link
            href={`/properties/${id}/mortgages`}
            className="text-sm font-medium text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-background transition-colors"
          >
            Back to Mortgages
          </Link>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        <PropertySubnav propertyId={id} active="mortgages" />

        <section className="rental-panel overflow-hidden" aria-labelledby="actual-mortgage-payments">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
            <div><h2 id="actual-mortgage-payments" className="font-semibold">Actual mortgage payments</h2><p className="mt-1 text-sm text-muted-foreground">Bank transactions you have matched in Verity. Forecast principal and interest remain separate below.</p></div>
            <Link href="/settings/verity" className="rental-button-secondary">Match a payment</Link>
          </div>
          {bankPayments.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No bank-confirmed payments linked to this mortgage yet.</p> : <ul className="divide-y divide-border">{bankPayments.map((payment) => <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm"><div><p>{payment.transaction.postedDate} · {payment.transaction.accountName}</p><p className="mt-1 text-xs text-muted-foreground">{payment.transaction.status === "NEEDS_REVIEW" ? "Source changed — review in Verity connection" : "Confirmed bank payment"}{payment.contextStatus !== "SYNCED" ? " · Verity update pending" : ""}</p></div><span className="font-semibold">{new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(Number(payment.amountMinor) / 100)}</span></li>)}</ul>}
        </section>

        <MortgageDetailView
          propertyId={id}
          mortgage={mortgage}
          backHref={`/properties/${id}/mortgages`}
        />
      </div>
    </div>
  );
}
