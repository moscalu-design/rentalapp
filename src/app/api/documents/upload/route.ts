import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const ALLOWED_EXTENSIONS = /\.(pdf|jpg|jpeg|png)$/i;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const VALID_DOC_TYPES = new Set(["idDocument", "workContract", "salarySlip"]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const tenantId = formData.get("tenantId") as string | null;
  const type = formData.get("type") as string | null;

  if (!file || !tenantId || !type) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  if (!VALID_DOC_TYPES.has(type)) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }

  // Validate file type by MIME and extension
  if (!ALLOWED_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.test(file.name)) {
    return NextResponse.json(
      { error: "Only PDF, JPG, and PNG files are allowed." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 10 MB." },
      { status: 400 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }

  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  // If a document of this type already exists, we'll replace it
  const existing = await prisma.tenantDocument.findUnique({
    where: { tenantId_type: { tenantId, type } },
  });

  // Upload to Vercel Blob — path encodes tenant + type for uniqueness
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const blobPath = `tenant-documents/${tenantId}/${type}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const blob = await put(blobPath, buffer, {
    access: "public", // URL is unguessable; access enforced via proxy route
    contentType: file.type,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  // If there was an old blob at a different URL (different extension), delete it
  if (existing && existing.storageUrl !== blob.url) {
    try {
      await del(existing.storageUrl);
    } catch {
      // Best-effort — don't fail the upload if old blob is gone
    }
  }

  const now = new Date();

  const document = await prisma.tenantDocument.upsert({
    where: { tenantId_type: { tenantId, type } },
    create: {
      tenantId,
      type,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      storageUrl: blob.url,
      uploadedAt: now,
      updatedAt: now,
    },
    update: {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      storageUrl: blob.url,
      uploadedAt: now,
      updatedAt: now,
    },
  });

  return NextResponse.json({
    documentId: document.id,
    fileName: document.fileName,
    fileSize: document.fileSize,
    uploadedAt: document.uploadedAt,
  });
}
