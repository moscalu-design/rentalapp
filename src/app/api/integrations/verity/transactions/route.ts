import { verityApi, verityService } from "@/lib/verity/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return verityApi(request, false, (userId) => verityService.getTransactions(userId)); }
