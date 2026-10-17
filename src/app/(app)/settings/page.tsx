import Link from "next/link";
import { auth } from "@/lib/auth";
import { TopBar } from "@/components/layout/TopBar";
import { SettingsExportButton } from "@/components/settings/SettingsExportButton";
import prisma from "@/lib/prisma";

const ROADMAP = [
  "Change password",
  "Email notifications for overdue rent",
  "CSV export of payment history",
  "Currency and locale settings",
  "Multi-user access",
];

export default async function SettingsPage() {
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { phone: true, role: true },
      })
    : null;

  return (
    <div className="flex flex-col flex-1">
      <TopBar title="Settings" description="Manage your account and preferences" />

      <div className="flex-1 p-4 sm:p-6 space-y-5 max-w-2xl">
        {/* Account */}
        <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Account</h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-primary font-semibold text-lg shrink-0">
              {session?.user?.name?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{session?.user?.name}</p>
              <p className="text-sm text-muted-foreground truncate">{session?.user?.email}</p>
              {user?.phone && <p className="text-sm text-muted-foreground truncate">{user.phone}</p>}
              <p className="text-xs text-muted-foreground truncate">Role: {user?.role ?? "USER"}</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-foreground">Privacy</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your rental data is private to your account. Other signed-in users cannot access it.
          </p>
        </div>

        <div className="rental-panel p-5 sm:p-6">
          <h2 className="text-sm font-semibold">Verity connection</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Match rent received, mortgage payments, and utility bills to bank transactions.</p>
          <Link href="/settings/verity" className="rental-button-secondary mt-4">Manage Verity connection</Link>
        </div>

        <SettingsExportButton />

        {/* Roadmap */}
        <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-foreground">On the roadmap</h2>
          <p className="text-xs text-muted-foreground mt-1">Features coming soon.</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {ROADMAP.map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
