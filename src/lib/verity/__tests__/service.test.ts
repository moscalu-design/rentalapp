import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { createVerityService } from "../service";
import type { VerityConnection, VerityTransaction } from "../schemas";

let root: string;
let schemaSql: string;
let db: PrismaClient;
let service: ReturnType<typeof createVerityService>;
let remote: VerityConnection;
let transactions: VerityTransaction[];
let counter = 0;
let databaseUrl: string;
const putContext = vi.fn(async () => {});
const deleteContext = vi.fn(async () => {});
const revoke = vi.fn(async () => {});
const getSnapshot = vi.fn(async () => ({ connection: remote, transactions }));
const makeClient = () => ({
  getConnection: async () => remote, getSnapshot,
  putContext, deleteContext, revoke,
});
const source = (id = "credit-1", amountMinor = 100000, currency = "EUR"): VerityTransaction => ({
  id, accountId: "account-1", accountName: "Business account", postedDate: "2026-10-15", amountMinor,
  currency, description: "Rent October", counterpartyName: "Tenant", counterpartyIban: "LU1234",
  sourceKey: `bank:${id}`, updatedAt: "2026-10-16T12:00:00.000Z",
});

beforeAll(() => {
  mkdirSync(join(process.cwd(), "work"), { recursive: true });
  root = mkdtempSync(join(process.cwd(), "work/verity-sqlite-tests-"));
  schemaSql = execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"], { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  // Apply the actual new migration over a canonical baseline without its tables.
  // No configured development or remote database is ever opened by these tests.
  schemaSql = schemaSql.split(";").filter((statement) => !statement.includes('"Verity')).join(";") + ";\n" + readFileSync("prisma/migrations/20261016221000_add_verity_connector/migration.sql", "utf8");
  vi.stubEnv("AUTH_SECRET", "test-only-secret-with-at-least-32-characters");
});
afterAll(() => { vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }); });
afterEach(async () => { await db.$disconnect(); });
beforeEach(async () => {
  vi.clearAllMocks();
  putContext.mockResolvedValue(undefined); deleteContext.mockResolvedValue(undefined); revoke.mockResolvedValue(undefined);
  getSnapshot.mockImplementation(async () => ({ connection: remote, transactions }));
  const url = `file:${join(root, `${counter++}.db`)}`;
  databaseUrl = url;
  const setup = createClient({ url });
  await setup.executeMultiple(schemaSql); setup.close();
  db = new PrismaClient({ adapter: new PrismaLibSql({ url }) });
  for (const userId of ["owner-1", "owner-2"]) {
    await db.user.create({ data: { id: userId, email: `${userId}@test.local`, password: "never-used", name: userId } });
    await db.property.create({ data: { id: `property-${userId}`, userId, name: "Rental home", address: "1 Test Street", city: "Test" } });
    await db.room.create({ data: { id: `room-${userId}`, userId, propertyId: `property-${userId}`, name: "Room 1", monthlyRent: 1000, depositAmount: 1000 } });
    await db.tenant.create({ data: { id: `tenant-${userId}`, userId, firstName: "Alex", lastName: "Tenant", email: `tenant-${userId}@test.local` } });
    await db.occupancy.create({ data: { id: `occupancy-${userId}`, userId, roomId: `room-${userId}`, tenantId: `tenant-${userId}`, leaseStart: new Date("2026-01-01"), monthlyRent: 1000, depositRequired: 1000 } });
    await db.payment.create({ data: { id: `payment-${userId}`, userId, occupancyId: `occupancy-${userId}`, periodYear: 2026, periodMonth: 10, amountDue: 1000, dueDate: new Date("2026-10-05"), notes: "Keep original notes", reference: "Manual reference" } });
  }
  remote = { version: 1, ownerId: "verity-owner", connectionId: "remote-connection-1", accounts: [{ id: "account-1", name: "Business account", currency: "EUR" }] };
  transactions = [source()];
  service = createVerityService(db, makeClient);
  await service.connect("owner-1", "test-verity-token");
  await service.sync("owner-1");
});
async function transactionId(externalId = "credit-1") {
  return (await db.verityTransaction.findUniqueOrThrow({ where: { userId_externalId: { userId: "owner-1", externalId } } })).id;
}
async function rent(amountMinor: number, mode: "add_receipt" | "link_existing" = "add_receipt", key?: string) {
  return service.allocate("owner-1", { transactionId: await transactionId(), kind: "rent", targetId: "payment-owner-1", amountMinor, mode, ...(key ? { idempotencyKey: key } : {}) });
}
async function paid() { return (await db.payment.findUniqueOrThrow({ where: { id: "payment-owner-1" } })).amountPaid; }

describe("Verity persistence against a throwaway SQLite database", () => {
  it("encrypts credentials and returns only owner-scoped safe status", async () => {
    const stored = await db.verityConnection.findUniqueOrThrow({ where: { userId: "owner-1" } });
    expect(stored.encryptedToken).not.toContain("test-verity-token");
    expect(JSON.stringify(await service.getConnection("owner-1"))).not.toContain("encryptedToken");
    expect(await service.getConnection("owner-2")).toEqual({ connection: null });
    expect((await service.getTransactions("owner-2")).transactions).toEqual([]);
  });
  it("rejects owner changes and connections already bound to another local account", async () => {
    await expect(service.connect("owner-2", "test-token-2")).rejects.toThrow("another Rental account");
    remote = { ...remote, ownerId: "different-owner" };
    await expect(service.connect("owner-1", "test-token-2")).rejects.toThrow("different Verity owner");
    expect(await db.verityTransaction.count()).toBe(1);
  });
  it("reconnects the same owner without duplicating imported transactions", async () => {
    await service.disconnect("owner-1");
    remote = { ...remote, connectionId: "remote-new-token" };
    await service.connect("owner-1", "new-test-token");
    expect(await service.sync("owner-1")).toMatchObject({ imported: 0, updated: 0, total: 1 });
    expect(await db.verityTransaction.count()).toBe(1);
  });
  it("adds partial receipts once, respects a shared source cap, and preserves manual metadata", async () => {
    const first = await rent(60000, "add_receipt", "receipt-one");
    const repeated = await rent(60000, "add_receipt", "receipt-one");
    expect(repeated.allocation.id).toBe(first.allocation.id);
    expect(await paid()).toBe(600);
    await rent(40000, "add_receipt", "receipt-two");
    expect(await paid()).toBe(1000);
    await expect(rent(1, "add_receipt", "receipt-overflow")).rejects.toThrow("unallocated");
    const payment = await db.payment.findUniqueOrThrow({ where: { id: "payment-owner-1" } });
    expect(payment.notes).toBe("Keep original notes"); expect(payment.reference).toBe("Manual reference");
    expect(await db.verityAllocation.count()).toBe(2);
  });
  it("claims existing manual receipts without double counting before adding new money", async () => {
    await db.payment.update({ where: { id: "payment-owner-1" }, data: { amountPaid: 400, status: "PARTIAL", paidAt: new Date("2026-10-10"), paymentMethod: "CASH" } });
    await expect(rent(10000)).rejects.toThrow("unlinked paid money");
    await rent(30000, "link_existing");
    await expect(rent(20000, "link_existing")).rejects.toThrow("existing unlinked");
    await rent(10000, "link_existing");
    await rent(10000, "add_receipt", "new-money");
    expect(await paid()).toBe(500);
    const payment = await db.payment.findUniqueOrThrow({ where: { id: "payment-owner-1" } });
    expect(payment.paymentMethod).toBe("CASH"); expect(payment.paidAt?.toISOString()).toBe("2026-10-10T00:00:00.000Z");
  });
  it("rejects cross-user targets, waived rent, unsupported currency and wrong cash direction", async () => {
    const id = await transactionId();
    await expect(service.allocate("owner-1", { transactionId: id, kind: "rent", targetId: "payment-owner-2", amountMinor: 100, mode: "add_receipt" })).rejects.toThrow("not found");
    await db.payment.update({ where: { id: "payment-owner-1" }, data: { status: "WAIVED" } });
    await expect(rent(100)).rejects.toThrow("waived");
    transactions = [source("usd", 1000, "USD"), source("debit", -1000)]; await service.sync("owner-1");
    const rows = await service.getTransactions("owner-1"); expect(rows.transactions.find((row) => row.externalId === "usd")?.status).toBe("UNSUPPORTED_CURRENCY");
    for (const externalId of ["usd", "debit"]) {
      await expect(service.allocate("owner-1", { transactionId: await transactionId(externalId), kind: "rent", targetId: "payment-owner-1", amountMinor: 100, mode: "add_receipt" })).rejects.toThrow();
    }
    expect(await paid()).toBe(0);
  });
  it("keeps corrected and removed confirmed sources for review without reposting or reversing", async () => {
    await rent(60000);
    transactions = [{ ...source(), amountMinor: 50000, description: "Bank correction" }];
    expect(await service.sync("owner-1")).toMatchObject({ updated: 1, needsReview: 1 });
    expect(await paid()).toBe(600);
    await expect(rent(100)).rejects.toThrow("source review");
    await service.sync("owner-1");
    expect((await service.getTransactions("owner-1")).transactions[0].status).toBe("NEEDS_REVIEW");
    transactions = []; await service.sync("owner-1");
    expect((await service.getTransactions("owner-1")).transactions[0]).toMatchObject({ sourceMissing: true, status: "NEEDS_REVIEW" });
    expect(await paid()).toBe(600);
  });
  it("reserves stable bank provenance and rejects a rekeyed canonical identity atomically", async () => {
    transactions = [source("new-canonical-id")]; transactions[0].sourceKey = "bank:credit-1";
    await expect(service.sync("owner-1")).rejects.toThrow("canonical transaction identity");
    expect(await db.verityTransaction.count()).toBe(1);
    expect((await service.getTransactions("owner-1")).transactions[0].status).toBe("READY");
  });
  it("keeps an account-identity correction quarantined on repeated snapshots", async () => {
    transactions = [{ ...source(), accountId: "changed-account" }];
    await service.sync("owner-1"); await service.sync("owner-1");
    expect((await service.getTransactions("owner-1")).transactions[0].status).toBe("NEEDS_REVIEW");
  });
  it("does not stage an incomplete remote import", async () => {
    getSnapshot.mockRejectedValueOnce(new Error("remote unavailable"));
    await expect(service.sync("owner-1")).rejects.toThrow("Nothing was imported");
    expect(await db.verityTransaction.count()).toBe(1);
    expect((await service.getTransactions("owner-1")).transactions[0].status).toBe("READY");
  });
  it("links an existing expense once and stores mortgage cash separately from forecasts", async () => {
    await db.propertyExpense.create({ data: { id: "expense", userId: "owner-1", propertyId: "property-owner-1", title: "Repairs", category: "REPAIRS", amount: 300, paymentDate: new Date("2026-10-15"), reportingYear: 2026, reportingMonth: 10, notes: "receipt notes" } });
    const mortgage = await db.mortgage.create({ data: { id: "mortgage", userId: "owner-1", propertyId: "property-owner-1", label: "Main loan", startDate: new Date("2026-01-01"), termMonths: 240, initialBalance: 100000, interestRate: 3, monthlyPayment: 700 } });
    transactions = [source("debit", -100000)]; await service.sync("owner-1");
    const id = await transactionId("debit");
    await expect(service.allocate("owner-1", { transactionId: id, kind: "expense", targetId: "expense", amountMinor: 20000, mode: "add_receipt" })).rejects.toThrow("existing property expense");
    await service.allocate("owner-1", { transactionId: id, kind: "expense", targetId: "expense", amountMinor: 30000, mode: "link_existing" });
    await expect(service.allocate("owner-1", { transactionId: id, kind: "expense", targetId: "expense", amountMinor: 1, mode: "link_existing" })).rejects.toThrow("expense's unlinked");
    const actual = await service.allocate("owner-1", { transactionId: id, kind: "mortgage", targetId: "mortgage", amountMinor: 70000, mode: "add_receipt" });
    expect(actual.allocation).toMatchObject({ kind: "mortgage", amountMinor: 70000, status: "CONFIRMED" });
    expect(await db.mortgage.findUniqueOrThrow({ where: { id: "mortgage" } })).toEqual(mortgage);
    expect(await db.mortgagePrepayment.count()).toBe(0);
    await service.undo("owner-1", actual.allocation.id);
    expect(await db.mortgage.findUniqueOrThrow({ where: { id: "mortgage" } })).toEqual(mortgage);
  });
  it("saves the ledger once when reverse context sync fails and retries only context", async () => {
    putContext.mockRejectedValueOnce(new Error("Verity temporarily unavailable"));
    const result = await rent(60000);
    expect(result.contextPending).toBe(true); expect(await paid()).toBe(600);
    expect(result.allocation.contextStatus).toBe("ERROR");
    await service.retryContext("owner-1");
    expect(await paid()).toBe(600);
    expect((await service.getTransactions("owner-1")).transactions[0].allocations[0].contextStatus).toBe("SYNCED");
    expect(putContext).toHaveBeenCalledTimes(2);
  });
  it("undo reverses only its own unchanged new receipt and retries failed context deletion", async () => {
    const result = await rent(60000);
    deleteContext.mockRejectedValueOnce(new Error("remote delete unavailable"));
    const undone = await service.undo("owner-1", result.allocation.id);
    expect(undone.allocation.status).toBe("UNDONE"); expect(undone.contextPending).toBe(true); expect(await paid()).toBe(0);
    await service.retryContext("owner-1"); expect(await paid()).toBe(0);
    await service.undo("owner-1", result.allocation.id); expect(await paid()).toBe(0);
    expect((await db.payment.findUniqueOrThrow({ where: { id: "payment-owner-1" } })).notes).toBe("Keep original notes");
  });
  it("undoing a match preserves manual receipts, and rejects overwriting a later manual edit", async () => {
    await db.payment.update({ where: { id: "payment-owner-1" }, data: { amountPaid: 400 } });
    const match = await rent(40000, "link_existing");
    await service.undo("owner-1", match.allocation.id); expect(await paid()).toBe(400);
    await rent(40000, "link_existing", "link-again");
    const receipt = await rent(10000, "add_receipt");
    await db.payment.update({ where: { id: "payment-owner-1" }, data: { amountPaid: 550, notes: "Later manual receipt" } });
    await expect(service.undo("owner-1", receipt.allocation.id)).rejects.toThrow("ledger changed");
    expect(await paid()).toBe(550);
  });
  it("retains failed revocation for retry and forbids unsafe reconnect", async () => {
    revoke.mockRejectedValueOnce(new Error("network unavailable"));
    const result = await service.disconnect("owner-1");
    expect(result.connection).toMatchObject({ status: "DISCONNECTED", revokePending: true });
    await expect(service.connect("owner-1", "replacement-token")).rejects.toThrow("revoking");
    await service.retryContext("owner-1");
    expect((await service.getConnection("owner-1")).connection).toMatchObject({ revokePending: false, status: "DISCONNECTED" });
    expect((await db.verityConnection.findUniqueOrThrow({ where: { userId: "owner-1" } })).encryptedToken).toBeNull();
    expect(await db.verityTransaction.count()).toBe(1);
  });
  it("serializes concurrent confirmations without exceeding source or rent totals", async () => {
    const results = await Promise.allSettled([rent(60000, "add_receipt", "concurrent-a"), rent(60000, "add_receipt", "concurrent-b")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await paid()).toBe(600);
    expect(await db.verityAllocation.count({ where: { status: "CONFIRMED" } })).toBe(1);
  });
  it("requires disconnect for token replacement and replays context only after fresh sync", async () => {
    const receipt = await rent(60000);
    expect(putContext).toHaveBeenCalledTimes(1);
    remote = { ...remote, connectionId: "new-remote-grant" };
    await expect(service.connect("owner-1", "new-token")).rejects.toThrow("Disconnect");
    await service.disconnect("owner-1");
    await service.connect("owner-1", "new-token");
    expect((await service.getConnection("owner-1")).connection?.lastSyncedAt).toBeNull();
    await service.retryContext("owner-1");
    expect(putContext).toHaveBeenCalledTimes(1);
    await expect(rent(10000)).rejects.toThrow("Sync this connection");
    await service.sync("owner-1");
    expect(putContext).toHaveBeenCalledTimes(2);
    expect(await db.verityTransaction.count()).toBe(1);
    expect(await paid()).toBe(600);
    expect((await db.verityAllocation.findUniqueOrThrow({ where: { id: receipt.allocation.id } })).contextStatus).toBe("SYNCED");
  });
  it("does not replay confirmed context outside a reconnected account's fresh snapshot", async () => {
    await rent(60000);
    await service.disconnect("owner-1");
    remote = { ...remote, connectionId: "limited-grant", accounts: [{ id: "new-account", name: "Other account", currency: "EUR" }] };
    await service.connect("owner-1", "limited-token");
    transactions = [];
    await service.sync("owner-1"); await service.retryContext("owner-1");
    expect(putContext).toHaveBeenCalledTimes(1);
    expect((await service.getTransactions("owner-1")).transactions[0].status).toBe("NEEDS_REVIEW");
    expect(await paid()).toBe(600);
  });
  it("supports safe last-in-first-out undo for split receipts and preserves later note edits", async () => {
    const first = await rent(60000, "add_receipt", "first-part");
    const second = await rent(40000, "add_receipt", "second-part");
    await expect(service.undo("owner-1", first.allocation.id)).rejects.toThrow("ledger changed");
    await db.payment.update({ where: { id: "payment-owner-1" }, data: { notes: "Later note", reference: "Later reference" } });
    await service.undo("owner-1", second.allocation.id);
    expect(await paid()).toBe(600);
    await service.undo("owner-1", first.allocation.id);
    expect(await paid()).toBe(0);
    const payment = await db.payment.findUniqueOrThrow({ where: { id: "payment-owner-1" } });
    expect(payment.notes).toBe("Later note"); expect(payment.reference).toBe("Later reference");
  });
  it("rejects a conflicting retry payload before modifying the ledger", async () => {
    await rent(60000, "add_receipt", "stable-key");
    await expect(rent(40000, "add_receipt", "stable-key")).rejects.toThrow("different confirmation");
    expect(await paid()).toBe(600);
  });
  it("does not commit an older snapshot after another owner mutation wins", async () => {
    let release!: () => void;
    let entered!: () => void;
    const fetching = new Promise<void>((resolve) => { entered = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    getSnapshot.mockImplementationOnce(async () => { entered(); await gate; return { connection: remote, transactions }; });
    const importing = service.sync("owner-1");
    await fetching;
    await rent(60000);
    release();
    await expect(importing).rejects.toThrow("changed during sync");
    expect(await paid()).toBe(600);
  });
  it("resolves an in-flight context PUT with a queued DELETE after undo", async () => {
    let release!: () => void;
    let entered!: () => void;
    const sending = new Promise<void>((resolve) => { entered = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    putContext.mockImplementationOnce(async () => { entered(); await gate; });
    const confirming = rent(60000);
    await sending;
    const allocation = await db.verityAllocation.findFirstOrThrow({ where: { userId: "owner-1" } });
    await service.undo("owner-1", allocation.id);
    release();
    await confirming;
    expect(deleteContext).toHaveBeenCalledWith(allocation.id);
    expect((await db.verityAllocation.findUniqueOrThrow({ where: { id: allocation.id } })).contextStatus).toBe("SYNCED");
    expect(await paid()).toBe(0);
  });

  it("can undo locally after revocation without creating an impossible remote delete", async () => {
    const receipt = await rent(60000);
    await service.disconnect("owner-1");
    const undone = await service.undo("owner-1", receipt.allocation.id);
    expect(undone.contextPending).toBe(false);
    expect(await paid()).toBe(0);
    expect(deleteContext).not.toHaveBeenCalled();
  });

  it("refreshes account and description labels without quarantining unchanged bank cash", async () => {
    await rent(60000);
    transactions = [{ ...source(), accountName: "Renamed operating account", description: "New merchant label", counterpartyName: "Updated tenant label", updatedAt: "2026-10-17T12:00:00.000Z" }];
    expect(await service.sync("owner-1")).toMatchObject({ updated: 1, needsReview: 0 });
    const row = (await service.getTransactions("owner-1")).transactions[0];
    expect(row).toMatchObject({ status: "READY", accountName: "Renamed operating account", description: "New merchant label" });
    expect(row.allocations[0].status).toBe("CONFIRMED");
    expect(await paid()).toBe(600);
  });
  it("preserves signed safe integer amounts beyond 32-bit storage limits", async () => {
    transactions = [source("large", Number.MAX_SAFE_INTEGER)];
    await service.sync("owner-1");
    expect((await service.getTransactions("owner-1")).transactions.find((row) => row.externalId === "large")?.amountMinor).toBe(Number.MAX_SAFE_INTEGER);
  });
  it("caps concurrent confirmations across separate database clients", async () => {
    const secondDb = new PrismaClient({ adapter: new PrismaLibSql({ url: databaseUrl }) });
    try {
      const secondService = createVerityService(secondDb, makeClient);
      const input = { transactionId: await transactionId(), kind: "rent" as const, targetId: "payment-owner-1", amountMinor: 60000, mode: "add_receipt" as const };
      const results = await Promise.allSettled([
        service.allocate("owner-1", { ...input, idempotencyKey: "client-a" }),
        secondService.allocate("owner-1", { ...input, idempotencyKey: "client-b" }),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(await paid()).toBe(600);
      expect(await db.verityAllocation.count()).toBe(1);
    } finally { await secondDb.$disconnect(); }
  });

});
