import { auth } from "@/lib/auth";
import { TopBar } from "@/components/layout/TopBar";

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="flex flex-col flex-1">
      <TopBar title="Settings" description="Manage your account and preferences" />

      <div className="flex-1 p-6 space-y-6 max-w-2xl">
        {/* Account */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">Account</h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-lg">
              {session?.user?.name?.[0] ?? "A"}
            </div>
            <div>
              <p className="font-medium text-slate-800">{session?.user?.name}</p>
              <p className="text-sm text-slate-500">{session?.user?.email}</p>
            </div>
          </div>
        </div>

        {/* Future settings */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">Coming Soon</h2>
          <ul className="space-y-2 text-sm text-slate-500">
            {[
              "Change password",
              "Email notifications for overdue rent",
              "CSV export of payment history",
              "Currency and locale settings",
              "Multi-user access",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
