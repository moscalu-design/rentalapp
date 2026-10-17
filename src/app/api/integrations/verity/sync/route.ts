import { verityApi, verityService } from "@/lib/verity/api";
import { operationResponse } from "@/lib/verity/stream";
export const runtime = "nodejs";
export const maxDuration = 300;
export function POST(request: Request) {
  return verityApi(request, true, async (userId) => operationResponse(request, (report) => verityService.sync(userId, report)));
}
