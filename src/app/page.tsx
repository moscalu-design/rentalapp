import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Root: authenticated → dashboard, unauthenticated → login
export default async function RootPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  else redirect("/login");
}
