import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), compare: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { user: { findUnique: mocks.findUnique } } }));
vi.mock("bcryptjs", () => ({ default: { compare: mocks.compare } }));
vi.mock("next-auth", () => ({ default: (config: unknown) => ({ handlers: config }) }));
vi.mock("next-auth/providers/credentials", () => ({ default: (config: unknown) => config }));
import { handlers } from "@/lib/auth";
const config = handlers as unknown as { providers: Array<{ authorize: (credentials: Record<string, string>) => Promise<unknown> }> };
const authorize = config.providers[0].authorize;

describe("password-only authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({ id: "admin", email: "admin@example.com", name: "Admin", role: "ADMIN", password: "hash", twoFactorEnabled: true, twoFactorSecret: "legacy-secret" });
    mocks.compare.mockResolvedValue(true);
  });
  it("allows existing two-factor accounts to sign in with the correct password alone", async () => {
    await expect(authorize({ email: "admin@example.com", password: "correct" })).resolves.toEqual({ id: "admin", email: "admin@example.com", name: "Admin", role: "ADMIN" });
    expect(mocks.compare).toHaveBeenCalledWith("correct", "hash");
  });
  it("still rejects incorrect passwords", async () => {
    mocks.compare.mockResolvedValue(false);
    await expect(authorize({ email: "admin@example.com", password: "wrong" })).resolves.toBeNull();
  });
  it("rejects missing credentials and unknown accounts", async () => {
    await expect(authorize({ email: "admin@example.com" })).resolves.toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
    mocks.findUnique.mockResolvedValue(null);
    await expect(authorize({ email: "missing@example.com", password: "wrong" })).resolves.toBeNull();
  });
});
