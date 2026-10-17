import { verityApi, verityService } from "@/lib/verity/api";
export const runtime = "nodejs";
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return verityApi(request, true, (userId) => verityService.undo(userId, id));
}
