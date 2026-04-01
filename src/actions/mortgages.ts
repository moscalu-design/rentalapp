"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { MortgageSchema } from "@/lib/validations";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

export async function createMortgage(
  propertyId: string,
  formData: FormData
): Promise<{ id: string }> {
  await requireAuth();

  const validated = MortgageSchema.parse({
    label: formData.get("label") || undefined,
    lender: formData.get("lender") || undefined,
    startDate: formData.get("startDate"),
    termMonths: formData.get("termMonths"),
    initialBalance: formData.get("initialBalance"),
    interestRate: formData.get("interestRate"),
    monthlyPayment: formData.get("monthlyPayment"),
  });

  const mortgage = await prisma.mortgage.create({
    data: {
      propertyId,
      label: validated.label || null,
      lender: validated.lender || null,
      startDate: new Date(validated.startDate),
      termMonths: validated.termMonths,
      initialBalance: validated.initialBalance,
      interestRate: validated.interestRate,
      monthlyPayment: validated.monthlyPayment,
    },
  });

  revalidatePath(`/properties/${propertyId}`);
  return { id: mortgage.id };
}

export async function deleteMortgage(id: string, propertyId: string): Promise<void> {
  await requireAuth();
  await prisma.mortgage.delete({ where: { id } });
  revalidatePath(`/properties/${propertyId}`);
}

export async function toggleMortgageActive(
  id: string,
  propertyId: string,
  isActive: boolean
): Promise<void> {
  await requireAuth();
  await prisma.mortgage.update({ where: { id }, data: { isActive } });
  revalidatePath(`/properties/${propertyId}`);
}
