import { z } from "zod";
import { IntegrationError } from "./service";
import type { ReportProgress, VerityEvent } from "./progress";

export function operationResponse(request: Request, work: (report: ReportProgress) => Promise<unknown>) {
  if (!request.headers.get("accept")?.includes("application/x-ndjson")) return work(() => {});
  let cancelled = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: VerityEvent) => {
        if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        const result = await work((progress) => send({ type: "progress", progress }));
        send({ type: "result", result });
      } catch (error) {
        const message = error instanceof IntegrationError ? error.message : error instanceof z.ZodError
          ? "Check the connection details and try again."
          : "The operation could not finish. Refresh to check its saved state before retrying.";
        send({ type: "error", error: message });
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() { cancelled = true; },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
