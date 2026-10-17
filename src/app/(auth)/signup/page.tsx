import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { SignupForm } from "@/components/auth/SignupForm";

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <AuthFrame title="Join Rental App" description="Create a workspace for your properties, tenants and rental finances.">
      <SignupForm />
      <div className="mt-6 border-t border-border pt-5 text-center">
        <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Sign in to an existing account
        </Link>
      </div>
    </AuthFrame>
  );
}
