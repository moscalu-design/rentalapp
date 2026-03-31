"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UtilityCostSchema } from "@/lib/validations";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

export async function addUtilityCost(propertyId: string, formData: FormData) {
  await requireAuth();
  const validated = UtilityCostSchema.parse({
    type: formData.get("type"),
    provider: formData.get("provider") || undefined,
    amount: formData.get("amount"),
    billingCycle: formData.get("billingCycle") || "MONTHLY",
    notes: formData.get("notes") || undefined,
  });

  await prisma.utilityCost.create({
    data: {
      propertyId,
      type: validated.type,
      provider: validated.provider || null,
      amount: validated.amount,
      billingCycle: validated.billingCycle,
      notes: validated.notes || null,
    },
  });

  revalidatePath(`/properties/${propertyId}`);
}

export async function deleteUtilityCost(id: string, propertyId: string) {
  await requireAuth();
  await prisma.utilityCost.delete({ where: { id } });
  revalidatePath(`/properties/${propertyId}`);
}
