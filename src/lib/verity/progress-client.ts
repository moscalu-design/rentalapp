import type { ReportProgress, VerityEvent } from "./progress";

export async function runVerityOperation(path: "connection" | "sync", report: ReportProgress, body?: unknown): Promise<unknown> {
  const response = await fetch(`/api/integrations/verity/${path}`, {
    method: "POST", cache: "no-store",
    headers: { Accept: "application/x-ndjson", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/x-ndjson")) {
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "The connection request failed. Refresh and try again.");
    return data;
  }
  if (!response.body) throw new Error("The progress connection was interrupted. Refresh to check the saved state.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: unknown;
  let complete = false;
  function readLine(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as VerityEvent;
    if (event.type === "error") throw new Error(event.error);
    if (event.type === "progress") report(event.progress);
    if (event.type === "result") { result = event.result; complete = true; }
  }
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 262_144) throw new Error("The progress response was too large. Refresh to check the saved state.");
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) { readLine(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1); }
      if (done) { readLine(buffer); break; }
    }
    if (!complete) throw new Error("The progress connection was interrupted. Refresh to check whether the operation completed before retrying.");
    return result;
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
