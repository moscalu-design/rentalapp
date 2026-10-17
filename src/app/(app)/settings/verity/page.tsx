import { TopBar } from "@/components/layout/TopBar";
import { VerityWorkspace, type RentalTarget } from "@/components/integrations/VerityWorkspace";
import { requireUser } from "@/lib/currentUser";
import prisma from "@/lib/prisma";

export default async function VerityPage() {
  const user = await requireUser();
  const [payments, expenses, mortgages] = await Promise.all([
    prisma.payment.findMany({ where: { userId: user.id, status: { not: "WAIVED" } }, include: { occupancy: { include: { tenant: true, room: { include: { property: true } } } } }, orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }], take: 1000 }),
    prisma.propertyExpense.findMany({ where: { userId: user.id }, include: { property: true }, orderBy: { paymentDate: "desc" }, take: 1000 }),
    prisma.mortgage.findMany({ where: { userId: user.id, isActive: true }, include: { property: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const targets: RentalTarget[] = [
    ...payments.map((p) => ({ id: p.id, kind: "rent" as const, label: `${p.occupancy.room.property.name} · ${p.occupancy.tenant.firstName} ${p.occupancy.tenant.lastName} · ${String(p.periodMonth).padStart(2, "0")}/${p.periodYear}`, detail: `${p.amountPaid.toFixed(2)} EUR already recorded / ${p.amountDue.toFixed(2)} EUR due`, href: p.occupancy.room.isDefaultWholePropertyRoom ? `/properties/${p.occupancy.room.propertyId}/payments` : `/rooms/${p.occupancy.roomId}` })),
    ...expenses.map((p) => ({ id: p.id, kind: "expense" as const, label: `${p.property.name} · ${p.title} · ${String(p.reportingMonth).padStart(2, "0")}/${p.reportingYear}`, detail: `${p.amount.toFixed(2)} EUR recorded bill`, href: `/properties/${p.propertyId}/costs` })),
    ...mortgages.map((p) => ({ id: p.id, kind: "mortgage" as const, label: `${p.property.name} · ${p.label || p.lender || "Mortgage"}`, detail: "Bank-confirmed payment; repayment schedule stays separate", href: `/properties/${p.propertyId}/mortgages/${p.id}` })),
  ];
  return <div className="flex flex-1 flex-col"><TopBar title="Verity connection" description="Match bank transactions to your rental business." backHref="/settings" backLabel="Settings" /><VerityWorkspace targets={targets} configured={Boolean(process.env.VERITY_API_BASE_URL)} /></div>;
}
