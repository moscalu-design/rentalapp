import { afterEach, describe, expect, it, vi } from "vitest";
import { createVerityClient, getVerityBaseUrl } from "../verity/client";
import { decryptToken, encryptToken } from "../verity/crypto";

const connection = { version: 1, ownerId: "owner-a", ownerEmail: "owner@example.com", connectionId: "connection-a", accounts: [{ id: "account-a", name: "Rental account", currency: "EUR" }] };
const transaction = { id: "tx-a", accountId: "account-a", accountName: "Rental account", postedDate: "2026-10-01", amountMinor: 100000, currency: "EUR", description: "Rent", counterpartyName: "Sample tenant", counterpartyIban: null, sourceKey: "bank-a:entry-a", updatedAt: "2026-10-02T12:00:00Z" };
function setup(...pages: unknown[]) {
  vi.stubEnv("VERITY_API_BASE_URL", "https://verity.example");
  const fetcher = vi.fn();
  for (const value of [connection, ...pages]) fetcher.mockResolvedValueOnce(Response.json(value));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Verity credential boundary", () => {
  it("encrypts independently per save and binds ciphertext to its owner", () => {
    vi.stubEnv("AUTH_SECRET", "test-secret-".repeat(4));
    const encrypted = encryptToken("rental_token_secret", "owner-a");
    expect(encrypted).not.toContain("rental_token_secret");
    expect(decryptToken(encrypted, "owner-a")).toBe("rental_token_secret");
    expect(() => decryptToken(encrypted, "owner-b")).toThrow();
    expect(encryptToken("rental_token_secret", "owner-a")).not.toBe(encrypted);
    expect(() => decryptToken(encrypted.slice(0, -5) + "aaaaa", "owner-a")).toThrow();
  });
  it("refuses missing encryption secrets", () => { vi.stubEnv("AUTH_SECRET", ""); expect(() => encryptToken("token", "owner-a")).toThrow(/AUTH_SECRET/); });
  it.each(["http://192.168.0.1", "https://user:password@example.com", "https://example.com/?token=x", "https://example.com/api"])("rejects unsafe origins %s", (url) => { vi.stubEnv("VERITY_API_BASE_URL", url); expect(() => getVerityBaseUrl()).toThrow(); });
  it("refuses loopback HTTP in production", () => { vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERITY_API_BASE_URL", "http://127.0.0.1:3207"); expect(() => getVerityBaseUrl()).toThrow(); });
});

describe("Verity complete snapshot validation", () => {
  it("reads a full 500-record page and reports actual progress", async () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({ ...transaction, id: `bulk-${i}`, sourceKey: `bank:bulk-${i}` }));
    const fetcher = setup({ version: 1, ownerId: "owner-a", transactions: rows, nextCursor: null });
    const report = vi.fn();
    const result = await createVerityClient("token").getSnapshot("owner-a", "owner@example.com", report);
    expect(result.transactions).toHaveLength(500);
    expect(fetcher.mock.calls[1][0]).toContain("limit=500");
    expect(report).toHaveBeenLastCalledWith({ stage: "reading_transactions", processed: 500, accounts: 1, page: 1 });
  });

  it("rejects a server response that omits the owner email", async () => {
    const fetcher = setup();
    fetcher.mockReset().mockResolvedValueOnce(Response.json({ ...connection, ownerEmail: undefined }));
    await expect(createVerityClient("token").getSnapshot("owner-a", "owner@example.com")).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not treat email aliases as the same account", async () => {
    const fetcher = setup();
    await expect(createVerityClient("token").getSnapshot("owner-a", "owner+rental@example.com")).rejects.toThrow("same email address");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects a different email before requesting transactions", async () => {
    const fetcher = setup();
    await expect(createVerityClient("token").getSnapshot("owner-a", "different@example.com")).rejects.toThrow("same email address");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects a missing expected email before requesting transactions", async () => {
    const fetcher = setup();
    await expect(createVerityClient("token").getSnapshot("owner-a")).rejects.toThrow("same email address");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("matches email case and surrounding whitespace", async () => {
    setup({ version: 1, ownerId: "owner-a", transactions: [], nextCursor: null });
    await expect(createVerityClient("token").getSnapshot("owner-a", " OWNER@EXAMPLE.COM ")).resolves.toMatchObject({ transactions: [] });
  });
  it("follows pages and sends credentials only to the configured nonredirecting origin", async () => {
    const fetcher = setup({ version: 1, ownerId: "owner-a", transactions: [transaction], nextCursor: "page-2" }, { version: 1, ownerId: "owner-a", transactions: [{ ...transaction, id: "tx-b", sourceKey: "bank-a:entry-b" }], nextCursor: null });
    const result = await createVerityClient("token").getSnapshot("owner-a", "owner@example.com");
    expect(result.transactions).toHaveLength(2);
    expect(fetcher.mock.calls[2][0]).toContain("cursor=page-2");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "error", cache: "no-store", headers: { Authorization: "Bearer token" } });
  });
  it.each([
    { ...transaction, accountId: "another-account" }, { ...transaction, amountMinor: 10.5 },
    { ...transaction, postedDate: "2026-02-31" }, { ...transaction, currency: "EURO" },
  ])("rejects unapproved or malformed money data", async (row) => {
    setup({ version: 1, ownerId: "owner-a", transactions: [row], nextCursor: null });
    await expect(createVerityClient("token").getSnapshot("owner-a", "owner@example.com")).rejects.toThrow();
  });
  it("rejects changed owner and does not return a partial snapshot", async () => {
    setup({ version: 1, ownerId: "owner-b", transactions: [transaction], nextCursor: null });
    await expect(createVerityClient("token").getSnapshot("owner-a", "owner@example.com")).rejects.toThrow(/owner changed/);
  });
  it("rejects duplicate provenance even when canonical IDs differ", async () => {
    setup({ version: 1, ownerId: "owner-a", transactions: [transaction, { ...transaction, id: "tx-b" }], nextCursor: null });
    await expect(createVerityClient("token").getSnapshot(undefined, "owner@example.com")).rejects.toThrow(/duplicated/);
  });
  it("rejects pagination loops", async () => {
    setup({ version: 1, ownerId: "owner-a", transactions: [], nextCursor: "same" }, { version: 1, ownerId: "owner-a", transactions: [], nextCursor: "same" });
    await expect(createVerityClient("token").getSnapshot(undefined, "owner@example.com")).rejects.toThrow(/repeated page/);
  });
  it("returns a safe reconnect error for revoked tokens", async () => {
    vi.stubEnv("VERITY_API_BASE_URL", "https://verity.example"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("internal secret details", { status: 401 })));
    await expect(createVerityClient("token").getConnection()).rejects.toThrow("Verity access expired or was revoked. Reconnect with a new token.");
  });
  it("finishes disconnect when a token is already expired or revoked", async () => {
    vi.stubEnv("VERITY_API_BASE_URL", "https://verity.example");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    await expect(createVerityClient("token").revoke()).resolves.toBeUndefined();
  });
  it.each([403, 500, 503])("keeps revocation pending for an unconfirmed %s failure", async (status) => {
    vi.stubEnv("VERITY_API_BASE_URL", "https://verity.example");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
    await expect(createVerityClient("token").revoke()).rejects.toMatchObject({ status });
  });
});
