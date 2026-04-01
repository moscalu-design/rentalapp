"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  calculateMortgageMonthlyPayment,
  normalizeMortgageType,
  type MortgageType,
} from "@/lib/mortgage";
import prisma from "@/lib/prisma";
import { MortgagePrepaymentSchema, MortgageSchema } from "@/lib/validations";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

function getValidationMessage(error: unknown) {
  if (!(error instanceof Error)) return "Failed to save mortgage";
  const issues = JSON.parse(error.message || "[]");
  if (Array.isArray(issues) && issues[0]?.message) {
    return issues[0].message as string;
  }
  return error.message;
}

function parseMortgageForm(formData: FormData) {
  const parsed = MortgageSchema.safeParse({
    label: formData.get("label"),
    lender: formData.get("lender") || undefined,
    notes: formData.get("notes") || undefined,
    type: formData.get("type"),
    startDate: formData.get("startDate"),
    termMonths: formData.get("termMonths"),
    initialBalance: formData.get("initialBalance"),
    interestRate: formData.get("interestRate"),
  });

  if (!parsed.success) {
    throw new Error(JSON.stringify(parsed.error.issues));
  }

  const data = parsed.data;
  const type = normalizeMortgageType(data.type) as MortgageType;
  const monthlyPayment = calculateMortgageMonthlyPayment({
    type,
    principal: data.initialBalance,
    annualInterestRate: data.interestRate,
    termMonths: data.termMonths,
  });

  return {
    ...data,
    type,
    monthlyPayment,
  };
}

function parseMortgagePrepaymentForm(formData: FormData) {
  const parsed = MortgagePrepaymentSchema.safeParse({
    type: formData.get("type"),
    amount: formData.get("amount"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    frequency: formData.get("frequency") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    throw new Error(JSON.stringify(parsed.error.issues));
  }

  return parsed.data;
}

export async function createMortgage(
  propertyId: string,
  formData: FormData
): Promise<{ id: string }> {
  await requireAuth();

  try {
    const validated = parseMortgageForm(formData);

    const mortgage = await prisma.mortgage.create({
      data: {
        propertyId,
        label: validated.label,
        lender: validated.lender || null,
        notes: validated.notes || null,
        type: validated.type,
        startDate: new Date(validated.startDate),
        termMonths: validated.termMonths,
        initialBalance: validated.initialBalance,
        interestRate: validated.interestRate,
        monthlyPayment: validated.monthlyPayment,
      },
    });

    revalidatePath(`/properties/${propertyId}`);
    return { id: mortgage.id };
  } catch (error) {
    throw new Error(getValidationMessage(error));
  }
}

export async function updateMortgage(
  id: string,
  propertyId: string,
  formData: FormData
): Promise<void> {
  await requireAuth();

  try {
    const validated = parseMortgageForm(formData);

    await prisma.mortgage.update({
      where: { id },
      data: {
        label: validated.label,
        lender: validated.lender || null,
        notes: validated.notes || null,
        type: validated.type,
        startDate: new Date(validated.startDate),
        termMonths: validated.termMonths,
        initialBalance: validated.initialBalance,
        interestRate: validated.interestRate,
        monthlyPayment: validated.monthlyPayment,
      },
    });

    revalidatePath(`/properties/${propertyId}`);
  } catch (error) {
    throw new Error(getValidationMessage(error));
  }
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

export async function createMortgagePrepayment(
  mortgageId: string,
  propertyId: string,
  formData: FormData
): Promise<{ id: string }> {
  await requireAuth();

  try {
    const validated = parseMortgagePrepaymentForm(formData);
    const prepayment = await prisma.mortgagePrepayment.create({
      data: {
        mortgageId,
        type: validated.type,
        amount: validated.amount,
        startDate: new Date(validated.startDate),
        endDate: validated.endDate ? new Date(validated.endDate) : null,
        frequency: validated.type === "recurring" ? validated.frequency || "monthly" : null,
        notes: validated.notes || null,
      },
    });

    revalidatePath(`/properties/${propertyId}`);
    return { id: prepayment.id };
  } catch (error) {
    throw new Error(getValidationMessage(error));
  }
}

export async function updateMortgagePrepayment(
  id: string,
  propertyId: string,
  formData: FormData
): Promise<void> {
  await requireAuth();

  try {
    const validated = parseMortgagePrepaymentForm(formData);
    await prisma.mortgagePrepayment.update({
      where: { id },
      data: {
        type: validated.type,
        amount: validated.amount,
        startDate: new Date(validated.startDate),
        endDate: validated.endDate ? new Date(validated.endDate) : null,
        frequency: validated.type === "recurring" ? validated.frequency || "monthly" : null,
        notes: validated.notes || null,
      },
    });

    revalidatePath(`/properties/${propertyId}`);
  } catch (error) {
    throw new Error(getValidationMessage(error));
  }
}

export async function deleteMortgagePrepayment(
  id: string,
  propertyId: string
): Promise<void> {
  await requireAuth();
  await prisma.mortgagePrepayment.delete({ where: { id } });
  revalidatePath(`/properties/${propertyId}`);
}

export async function toggleMortgagePrepaymentActive(
  id: string,
  propertyId: string,
  isActive: boolean
): Promise<void> {
  await requireAuth();
  await prisma.mortgagePrepayment.update({ where: { id }, data: { isActive } });
  revalidatePath(`/properties/${propertyId}`);
}
