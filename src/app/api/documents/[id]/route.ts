import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const doc = await prisma.tenantDocument.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  // Fetch the blob from Vercel's CDN and proxy it — client never sees the storage URL
  let blobRes: Response;
  try {
    blobRes = await fetch(doc.storageUrl);
  } catch {
    return NextResponse.json({ error: "Failed to retrieve file." }, { status: 502 });
  }

  if (!blobRes.ok) {
    return NextResponse.json({ error: "File not available." }, { status: 502 });
  }

  const disposition = req.nextUrl.searchParams.get("dl") === "1"
    ? `attachment; filename="${encodeURIComponent(doc.fileName)}"`
    : `inline; filename="${encodeURIComponent(doc.fileName)}"`;

  return new NextResponse(blobRes.body, {
    headers: {
      "Content-Type": doc.fileType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
