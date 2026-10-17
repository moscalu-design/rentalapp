import { z } from "zod";
import { readSmallJson, verityApi, verityService } from "@/lib/verity/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return verityApi(request, false, (userId) => verityService.getConnection(userId)); }
export function POST(request: Request) {
  return verityApi(request, true, async (userId) => {
    const input = z.object({ token: z.string().min(1).max(2048).regex(/^[^\r\n]+$/) }).strict().parse(await readSmallJson(request));
    return verityService.connect(userId, input.token);
  });
}
export function DELETE(request: Request) { return verityApi(request, true, (userId) => verityService.disconnect(userId)); }
