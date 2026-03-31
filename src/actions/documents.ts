"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

export async function deleteDocument(documentId: string): Promise<{ error?: string }> {
  await requireAuth();

  const doc = await prisma.tenantDocument.findUnique({
    where: { id: documentId },
  });

  if (!doc) return { error: "Document not found." };

  try {
    await del(doc.storageUrl);
  } catch {
    // Blob may already be gone — continue to remove DB record
  }

  await prisma.tenantDocument.delete({ where: { id: documentId } });

  revalidatePath(`/tenants/${doc.tenantId}`);
  return {};
}
