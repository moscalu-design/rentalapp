import { readSmallJson, verityApi, verityService } from "@/lib/verity/api";
import { AllocationInputSchema } from "@/lib/verity/service";
export const runtime = "nodejs";
export function POST(request: Request) {
  return verityApi(request, true, async (userId) => verityService.allocate(userId, AllocationInputSchema.parse(await readSmallJson(request))));
}
