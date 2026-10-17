import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ signup?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const { signup } = await searchParams;

  return (
    <AuthFrame title="Rental App" description="Sign in to manage your rental business.">
      {signup === "success" && (
        <p role="status" className="mb-5 rounded-lg bg-primary/5 px-3 py-3 text-sm leading-relaxed text-foreground">
          Your account is ready. Sign in to add your first property.
        </p>
      )}
      <LoginForm />
      <div className="mt-6 border-t border-border pt-5 text-center">
        <p className="text-sm text-muted-foreground">New to Rental App?</p>
        <Link href="/signup" className="rental-button-secondary mt-3 w-full">
          Create an account
        </Link>
      </div>
    </AuthFrame>
  );
}
