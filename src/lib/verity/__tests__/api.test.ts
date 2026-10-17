import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: {} }));
import { assertSameOrigin, readSmallJson, verityApi } from "../api";

beforeEach(() => {
  vi.stubEnv("AUTH_URL", ""); vi.stubEnv("NEXTAUTH_URL", "");
  mocks.auth.mockResolvedValue({ user: { id: "session-owner", role: "USER" } });
});
afterEach(() => vi.unstubAllEnvs());
const request = (origin = "https://rental.test") => new Request("https://rental.test/api/integrations/verity/sync", { method: "POST", headers: { Origin: origin } });

describe("Verity API security boundary", () => {
  it("rejects missing, cross-site and opaque request origins", () => {
    for (const origin of ["", "https://evil.test", "null"]) expect(() => assertSameOrigin(request(origin))).toThrow("same origin");
    expect(() => assertSameOrigin(new Request(request(), { headers: { Origin: "https://rental.test", "Sec-Fetch-Site": "cross-site" } }))).toThrow("same origin");
    expect(() => assertSameOrigin(request())).not.toThrow();
  });
  it("uses the configured public auth origin behind a proxy without trusting forwarded Host", () => {
    vi.stubEnv("AUTH_URL", "https://rental.test");
    const proxied = new Request("http://localhost:3107/api/integrations/verity/sync", { method: "POST", headers: { Origin: "https://rental.test" } });
    expect(() => assertSameOrigin(proxied)).not.toThrow();
    const malicious = new Request(proxied, { headers: { Origin: "https://evil.test", "X-Forwarded-Host": "evil.test" } });
    expect(() => assertSameOrigin(malicious)).toThrow("same origin");
  });
  it("requires a session and uses only the authenticated owner's identity", async () => {
    const work = vi.fn(async (userId: string) => ({ userId }));
    mocks.auth.mockResolvedValueOnce(null);
    expect((await verityApi(request(), true, work)).status).toBe(401);
    expect(work).not.toHaveBeenCalled();
    const response = await verityApi(request(), true, work);
    expect(await response.json()).toEqual({ userId: "session-owner" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("blocks viewer mutations and does not invoke work on cross-origin requests", async () => {
    const work = vi.fn(async () => ({}));
    expect((await verityApi(request("https://evil.test"), true, work)).status).toBe(403);
    mocks.auth.mockResolvedValueOnce({ user: { id: "session-owner", role: "VIEWER" } });
    expect((await verityApi(request(), true, work)).status).toBe(403);
    expect(work).not.toHaveBeenCalled();
  });
  it("bounds request bodies and does not expose internal errors or tokens", async () => {
    await expect(readSmallJson(new Request("https://rental.test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: "x".repeat(9000) }) }))).rejects.toThrow("too large");
    await expect(readSmallJson(new Request("https://rental.test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))).rejects.toThrow("invalid JSON");
    const response = await verityApi(request(), true, async () => { throw new Error("database secret=token-123"); });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("token-123");
  });
});
