import { afterEach, describe, expect, it, vi } from "vitest";
import { operationResponse } from "../stream";
import { runVerityOperation } from "../progress-client";
import { IntegrationError } from "../service";
const request = () => new Request("https://rental.test", { headers: { Accept: "application/x-ndjson" } });
afterEach(() => vi.unstubAllGlobals());

describe("Verity live progress", () => {
  it("delivers a progress event before the operation completes", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const response = await operationResponse(request(), async (report) => {
      report({ stage: "checking_email" }); await pending;
      return { imported: 500 };
    }) as Response;
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('"stage":"checking_email"');
    finish();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('"imported":500');
    expect((await reader.read()).done).toBe(true);
  });
  it("keeps ordinary JSON callers compatible", async () => {
    expect(await operationResponse(new Request("https://rental.test"), async () => ({ ok: true }))).toEqual({ ok: true });
  });
  it("surfaces actionable errors without exposing internal details", async () => {
    const response = await operationResponse(request(), async () => { throw new IntegrationError("Use the same email address", 403); }) as Response;
    expect(await response.text()).toContain("Use the same email address");
    const internal = await operationResponse(request(), async () => { throw new Error("credential secret"); }) as Response;
    expect(await internal.text()).not.toContain("credential secret");
  });
  it("handles split stream chunks and reports the completed result", async () => {
    const encoder = new TextEncoder();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ start(controller) {
      for (const text of ['{"type":"pro', 'gress","progress":{"stage":"saving_transactions","processed":250,"total":500}}\n{"type":"result","result":{"imported":500}}\n']) controller.enqueue(encoder.encode(text));
      controller.close();
    } }), { headers: { "Content-Type": "application/x-ndjson" } })));
    const report = vi.fn();
    expect(await runVerityOperation("sync", report)).toEqual({ imported: 500 });
    expect(report).toHaveBeenCalledWith({ stage: "saving_transactions", processed: 250, total: 500 });
  });
  it("does not claim success when the stream is interrupted", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"progress","progress":{"stage":"committing"}}\n', { headers: { "Content-Type": "application/x-ndjson" } })));
    await expect(runVerityOperation("sync", vi.fn())).rejects.toThrow("check whether the operation completed");
  });
  it("handles auth failures before streaming starts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Sign in to Rental" }, { status: 401 })));
    await expect(runVerityOperation("sync", vi.fn())).rejects.toThrow("Sign in to Rental");
  });
  it("surfaces errors after progress without returning a success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"error","error":"Saving took too long"}\n', { headers: { "Content-Type": "application/x-ndjson" } })));
    await expect(runVerityOperation("sync", vi.fn())).rejects.toThrow("Saving took too long");
  });
});
