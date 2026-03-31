"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PropertySchema } from "@/lib/validations";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

export async function createProperty(formData: FormData) {
  const user = await requireAuth();
  const validated = PropertySchema.parse({
    name: formData.get("name"),
    address: formData.get("address"),
    city: formData.get("city"),
    postcode: formData.get("postcode") || undefined,
    country: formData.get("country") || "UK",
    propertyType: formData.get("propertyType") || "HOUSE",
    status: formData.get("status") || "ACTIVE",
    notes: formData.get("notes") || undefined,
  });

  const property = await prisma.property.create({
    data: {
      ...validated,
      notes: validated.notes || null,
      postcode: validated.postcode || null,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "PROPERTY_CREATED",
      description: `Property "${property.name}" created`,
      entityType: "PROPERTY",
      entityId: property.id,
      userId: user.id,
      propertyId: property.id,
    },
  });

  revalidatePath("/properties");
  redirect(`/properties/${property.id}`);
}

export async function updateProperty(id: string, formData: FormData) {
  await requireAuth();
  const validated = PropertySchema.parse({
    name: formData.get("name"),
    address: formData.get("address"),
    city: formData.get("city"),
    postcode: formData.get("postcode") || undefined,
    country: formData.get("country") || "UK",
    propertyType: formData.get("propertyType") || "HOUSE",
    status: formData.get("status") || "ACTIVE",
    notes: formData.get("notes") || undefined,
  });

  await prisma.property.update({
    where: { id },
    data: {
      ...validated,
      notes: validated.notes || null,
      postcode: validated.postcode || null,
    },
  });

  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
  redirect(`/properties/${id}`);
}

export async function archiveProperty(id: string) {
  await requireAuth();
  await prisma.property.update({ where: { id }, data: { status: "ARCHIVED" } });
  revalidatePath("/properties");
  redirect("/properties");
}
