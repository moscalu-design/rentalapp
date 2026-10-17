import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createVerityService, IntegrationError } from "./service";

export const verityService = createVerityService(prisma);

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const configured = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (!configured && process.env.NODE_ENV === "production") throw new IntegrationError("Configure the Rental server's AUTH_URL before using this connection.", 503);
  let expectedOrigin: string;
  try {
    // Deployments may expose an internal localhost Request URL behind a reverse
    // proxy. The operator's auth origin is trusted; forwarded Host headers are not.
    const expected = new URL(configured || request.url);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(expected.hostname);
    if (expected.username || expected.password || (expected.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && loopback && expected.protocol === "http:"))) throw new Error("invalid origin");
    expectedOrigin = expected.origin;
  } catch { throw new IntegrationError("The Rental server's AUTH_URL is invalid.", 503); }
  if (!origin || origin !== expectedOrigin || (site && site !== "same-origin")) {
    throw new IntegrationError("This request must come from the Rental app on the same origin.", 403);
  }
}

export async function readSmallJson(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new IntegrationError("Send this confirmation as JSON.", 415);
  }
  if (Number(request.headers.get("content-length")) > 8192 || !request.body) throw new IntegrationError("The request is missing or too large.", 413);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new IntegrationError("The request is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new IntegrationError("The request contains invalid JSON.", 400); }
}

export async function verityApi(request: Request, mutation: boolean, work: (userId: string) => Promise<unknown>) {
  const headers = { "Cache-Control": "no-store", "Content-Type": "application/json" };
  try {
    const session = await auth();
    if (!session?.user?.id) throw new IntegrationError("Sign in to Rental to continue.", 401);
    if (mutation) {
      assertSameOrigin(request);
      if ((session.user as { role?: string }).role === "VIEWER") throw new IntegrationError("Your account has read-only access.", 403);
    }
    return Response.json(await work(session.user.id), { headers });
  } catch (error) {
    if (error instanceof IntegrationError) return Response.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof z.ZodError) return Response.json({ error: "The confirmation contains invalid fields. Refresh and check the amount, target and action." }, { status: 400, headers });
    return Response.json({ error: "Rental could not complete the request. Refresh before retrying; do not record the same money manually." }, { status: 500, headers });
  }
}
