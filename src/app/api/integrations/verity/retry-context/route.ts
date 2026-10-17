import { verityApi, verityService } from "@/lib/verity/api";
export const runtime = "nodejs";
export function POST(request: Request) { return verityApi(request, true, (userId) => verityService.retryContext(userId)); }
