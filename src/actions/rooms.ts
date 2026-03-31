"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { RoomSchema } from "@/lib/validations";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

export async function createRoom(propertyId: string, formData: FormData) {
  const user = await requireAuth();
  const validated = RoomSchema.parse({
    name: formData.get("name"),
    floor: formData.get("floor") || undefined,
    sizeM2: formData.get("sizeM2") || undefined,
    furnished: formData.get("furnished") === "true",
    privateBathroom: formData.get("privateBathroom") === "true",
    monthlyRent: formData.get("monthlyRent"),
    depositAmount: formData.get("depositAmount"),
    status: formData.get("status") || "VACANT",
    notes: formData.get("notes") || undefined,
  });

  const room = await prisma.room.create({
    data: {
      ...validated,
      propertyId,
      floor: validated.floor || null,
      notes: validated.notes || null,
      sizeM2: validated.sizeM2 ?? null,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "ROOM_ADDED",
      description: `Room "${room.name}" added to property`,
      entityType: "ROOM",
      entityId: room.id,
      userId: user.id,
      propertyId,
      roomId: room.id,
    },
  });

  revalidatePath(`/properties/${propertyId}`);
  redirect(`/rooms/${room.id}`);
}

export async function updateRoom(id: string, propertyId: string, formData: FormData) {
  await requireAuth();
  const validated = RoomSchema.parse({
    name: formData.get("name"),
    floor: formData.get("floor") || undefined,
    sizeM2: formData.get("sizeM2") || undefined,
    furnished: formData.get("furnished") === "true",
    privateBathroom: formData.get("privateBathroom") === "true",
    monthlyRent: formData.get("monthlyRent"),
    depositAmount: formData.get("depositAmount"),
    status: formData.get("status") || "VACANT",
    notes: formData.get("notes") || undefined,
  });

  await prisma.room.update({
    where: { id },
    data: {
      ...validated,
      floor: validated.floor || null,
      notes: validated.notes || null,
      sizeM2: validated.sizeM2 ?? null,
    },
  });

  revalidatePath(`/rooms/${id}`);
  revalidatePath(`/properties/${propertyId}`);
  redirect(`/rooms/${id}`);
}
