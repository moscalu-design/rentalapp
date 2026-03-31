"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { TenantSchema } from "@/lib/validations";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

export async function createTenant(formData: FormData) {
  const user = await requireAuth();
  const validated = TenantSchema.parse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    nationality: formData.get("nationality") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    emergencyContact: formData.get("emergencyContact") || undefined,
    idType: formData.get("idType") || undefined,
    idReference: formData.get("idReference") || undefined,
    status: formData.get("status") || "ACTIVE",
    notes: formData.get("notes") || undefined,
  });

  const tenant = await prisma.tenant.create({
    data: {
      ...validated,
      phone: validated.phone || null,
      nationality: validated.nationality || null,
      dateOfBirth: validated.dateOfBirth ? new Date(validated.dateOfBirth) : null,
      emergencyContact: validated.emergencyContact || null,
      idType: validated.idType || null,
      idReference: validated.idReference || null,
      notes: validated.notes || null,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "TENANT_CREATED",
      description: `Tenant "${tenant.firstName} ${tenant.lastName}" created`,
      entityType: "TENANT",
      entityId: tenant.id,
      userId: user.id,
      tenantId: tenant.id,
    },
  });

  revalidatePath("/tenants");
  redirect(`/tenants/${tenant.id}`);
}

export async function updateTenant(id: string, formData: FormData) {
  await requireAuth();
  const validated = TenantSchema.parse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    nationality: formData.get("nationality") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    emergencyContact: formData.get("emergencyContact") || undefined,
    idType: formData.get("idType") || undefined,
    idReference: formData.get("idReference") || undefined,
    status: formData.get("status") || "ACTIVE",
    notes: formData.get("notes") || undefined,
  });

  await prisma.tenant.update({
    where: { id },
    data: {
      ...validated,
      phone: validated.phone || null,
      nationality: validated.nationality || null,
      dateOfBirth: validated.dateOfBirth ? new Date(validated.dateOfBirth) : null,
      emergencyContact: validated.emergencyContact || null,
      idType: validated.idType || null,
      idReference: validated.idReference || null,
      notes: validated.notes || null,
    },
  });

  revalidatePath("/tenants");
  revalidatePath(`/tenants/${id}`);
  redirect(`/tenants/${id}`);
}

export async function deleteTenant(id: string) {
  await requireAuth();

  const activeOccupancy = await prisma.occupancy.findFirst({
    where: { tenantId: id, status: "ACTIVE" },
    select: { id: true },
  });

  if (activeOccupancy) {
    throw new Error("Cannot delete a tenant with an active tenancy.");
  }

  await prisma.tenant.delete({ where: { id } });

  revalidatePath("/tenants");
  redirect("/tenants");
}
