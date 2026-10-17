import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { type PrismaClient, Prisma } from "@/generated/prisma/client";
import { computePaymentStatus } from "@/lib/utils";
import { createVerityClient, VerityIdentityError } from "./client";
import { encryptToken, decryptToken } from "./crypto";
import type { VerityContext, VerityTransaction as SourceTransaction } from "./schemas";

import type { ReportProgress } from "./progress";

export class IntegrationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

type Database = PrismaClient;
type Transaction = Prisma.TransactionClient;
type ClientFactory = typeof createVerityClient;
const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const json = (value: unknown) => JSON.stringify(value, (_, item) => typeof item === "bigint" ? Number(item) : item);
const sourceFingerprint = (source: SourceTransaction) => sha({
  id: source.id,
  accountId: source.accountId,
  sourceKey: source.sourceKey,
  postedDate: source.postedDate,
  amountMinor: source.amountMinor,
  currency: source.currency,
  counterpartyIban: source.counterpartyIban,
});
// Names, descriptions and updatedAt are editable display/transport metadata;
// refreshing them must not invalidate an otherwise identical bank cash receipt.
function minor(value: number) {
  const result = Math.round(value * 100);
  if (!Number.isSafeInteger(result) || Math.abs(value * 100 - result) > 0.00001 || result < 0) {
    throw new IntegrationError("This record has an unsupported amount or precision. Review it manually.", 409);
  }
  return result;
}
function safeNumber(value: bigint | number) {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new IntegrationError("The total exceeds the supported amount range.", 409);
  return result;
}
export const AllocationInputSchema = z.object({
  transactionId: z.string().min(1).max(256),
  kind: z.enum(["rent", "expense", "mortgage"]),
  targetId: z.string().min(1).max(256),
  amountMinor: z.number().int().positive().safe(),
  mode: z.enum(["link_existing", "add_receipt"]),
  idempotencyKey: z.string().min(1).max(128).optional(),
}).strict();
export type AllocationInput = z.infer<typeof AllocationInputSchema>;

function safeAllocation<T extends { amountMinor: bigint }>(allocation: T) {
  const item = allocation as T & { sourceSnapshotJson?: string; ledgerBeforeJson?: string | null; ledgerAfterJson?: string | null; contextPayloadJson?: string; requestHash?: string; userId?: string; idempotencyKey?: string };
  const { sourceSnapshotJson: _, ledgerBeforeJson: _b, ledgerAfterJson: _a, contextPayloadJson: _c, requestHash: _h, userId: _u, idempotencyKey: _i, ...safe } = item;
  void [_ , _b, _a, _c, _h, _u, _i];
  return { ...safe, amountMinor: safeNumber(allocation.amountMinor) };
}

export function createVerityService(db: Database, makeClient: ClientFactory = createVerityClient) {
  async function locked<T>(userId: string, work: (tx: Transaction) => Promise<T>, allowDisconnected = false) {
    try {
      return await db.$transaction(async (tx) => {
        // The first write serializes owner mutations in SQLite/libSQL. No network I/O
        // occurs inside this transaction, and failed lock acquisition never posts money.
        const lock = await tx.verityConnection.updateMany({
          where: { userId, ...(allowDisconnected ? {} : { status: "CONNECTED" }) },
          data: { revision: { increment: 1 } },
        });
        if (lock.count !== 1) throw new IntegrationError("Connect Verity before continuing.", 409);
        return work(tx);
      }, { timeout: 20_000, maxWait: 5_000 });
    } catch (error) {
      if (error instanceof IntegrationError) throw error;
      const code = (error as { code?: string }).code;
      if (code === "P2028" || code === "P1008") {
        throw new IntegrationError("Saving took too long. This change was not committed. Retry; if it happens again, connect fewer accounts at once.", 503);
      }
      if (["P2002", "P2034"].includes(code ?? "")) {
        throw new IntegrationError("Another change is in progress or this request was already saved. Refresh and retry.", 409);
      }
      throw error;
    }
  }

  async function requireMatchingEmail(userId: string, remote: { ownerEmail: string }, database: Database | Transaction = db) {
    const user = await database.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email?.trim() || !remote.ownerEmail?.trim() || user.email.trim().toLowerCase() !== remote.ownerEmail.trim().toLowerCase()) {
      throw new IntegrationError("Use the same email address in Rental App and Verity. Sign in to the matching account before connecting or importing.", 403);
    }
  }

  async function getConnection(userId: string) {
    const connection = await db.verityConnection.findUnique({ where: { userId } });
    if (!connection) return { connection: null };
    const pendingContextCount = await db.verityAllocation.count({ where: { userId, contextStatus: { not: "SYNCED" } } });
    return { connection: {
      id: connection.id, remoteOwnerId: connection.remoteOwnerId,
      accounts: JSON.parse(connection.accountsJson), status: connection.status,
      lastSyncedAt: connection.lastSyncedAt, lastError: connection.lastError,
      revokePending: connection.revokePending, pendingContextCount,
    } };
  }

  async function connect(userId: string, token: string, report: ReportProgress = () => {}) {
    report({ stage: "checking_key" });
    // Fail encryption configuration before any remote request or local persistence.
    const encryptedToken = encryptToken(token, userId);
    let remote;
    try { remote = await makeClient(token).getConnection(); }
    catch { throw new IntegrationError("Verity could not verify this token. Check the connection token and server configuration.", 502); }
    report({ stage: "checking_email", accounts: remote.accounts.length });
    const existing = await db.verityConnection.findUnique({ where: { userId } });
    if (existing?.remoteOwnerId !== undefined && existing.remoteOwnerId !== remote.ownerId) {
      throw new IntegrationError("This Rental account is already bound to a different Verity owner. Its imported records cannot be reassigned.", 409);
    }
    if (existing?.revokePending) throw new IntegrationError("Finish revoking the previous connection before reconnecting. Use Retry context sync.", 409);
    if (existing?.status === "CONNECTED") {
      if (existing.encryptedToken && decryptToken(existing.encryptedToken, userId) === token && existing.remoteConnectionId === remote.connectionId) {
        await requireMatchingEmail(userId, remote);
        return getConnection(userId);
      }
      throw new IntegrationError("Disconnect the existing Verity token before connecting a replacement. Imported records will be preserved.", 409);
    }
    const other = await db.verityConnection.findUnique({ where: { remoteOwnerId: remote.ownerId } });
    if (other && other.userId !== userId) throw new IntegrationError("This Verity owner is already connected to another Rental account.", 409);
    await requireMatchingEmail(userId, remote);
    report({ stage: "saving_connection", accounts: remote.accounts.length });
    const values = { encryptedToken, remoteConnectionId: remote.connectionId, accountsJson: json(remote.accounts), status: "CONNECTED", lastError: null };
    if (existing) {
      await locked(userId, async (tx) => {
        const current = await tx.verityConnection.findUniqueOrThrow({ where: { userId } });
        if (current.remoteOwnerId !== remote.ownerId || current.revokePending || current.status === "CONNECTED") throw new IntegrationError("The connection changed. Refresh before reconnecting.", 409);
        await requireMatchingEmail(userId, remote, tx);
        await tx.verityConnection.update({ where: { userId }, data: { ...values, lastSyncedAt: null } });
        await tx.verityAllocation.updateMany({ where: { userId, status: "CONFIRMED" }, data: { contextStatus: "PENDING", contextOperation: "UPSERT", contextError: null, contextVersion: { increment: 1 } } });
      }, true);
    } else {
      try { await db.verityConnection.create({ data: { userId, remoteOwnerId: remote.ownerId, ...values } }); }
      catch { throw new IntegrationError("This account was connected by another request. Refresh before retrying.", 409); }
    }
    return getConnection(userId);
  }

  async function sync(userId: string, report: ReportProgress = () => {}) {
    const connection = await db.verityConnection.findUnique({ where: { userId } });
    if (!connection?.encryptedToken || connection.status !== "CONNECTED") throw new IntegrationError("Connect Verity before syncing.", 409);
    report({ stage: "checking_email" });
    const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    let snapshot;
    try { snapshot = await makeClient(decryptToken(connection.encryptedToken, userId)).getSnapshot(connection.remoteOwnerId, user.email, report); }
    catch (error) {
      const message = error instanceof VerityIdentityError ? error.message : "Sync failed. Nothing was imported. Check Verity access and try again.";
      await db.verityConnection.updateMany({ where: { userId, encryptedToken: connection.encryptedToken }, data: { lastError: message } });
      throw new IntegrationError(message, error instanceof VerityIdentityError ? 403 : 502);
    }
    report({ stage: "saving_transactions", processed: 0, total: snapshot.transactions.length });
    const summary = await locked(userId, async (tx) => {
      const current = await tx.verityConnection.findUniqueOrThrow({ where: { userId } });
      if (current.revision !== connection.revision + 1 || current.encryptedToken !== connection.encryptedToken || snapshot.connection.ownerId !== current.remoteOwnerId) throw new IntegrationError("The connection changed during sync. Nothing was imported; retry.", 409);
      await requireMatchingEmail(userId, snapshot.connection, tx);
      const records = await tx.verityTransaction.findMany({ where: { userId, connectionId: current.id } });
      const confirmed = await tx.verityAllocation.findMany({ where: { userId, status: "CONFIRMED" }, select: { id: true, transactionId: true } });
      const confirmedByTransaction = new Map<string, { id: string }[]>();
      for (const allocation of confirmed) {
        const items = confirmedByTransaction.get(allocation.transactionId) ?? [];
        items.push({ id: allocation.id }); confirmedByTransaction.set(allocation.transactionId, items);
      }
      const existing = records.map((row) => ({ ...row, allocations: confirmedByTransaction.get(row.id) ?? [] }));
      const byExternal = new Map(existing.map((row) => [row.externalId, row]));
      const bySource = new Map(existing.filter((row) => row.sourceKey).map((row) => [row.sourceKey, row.externalId]));
      const seen = new Set<string>();
      const now = new Date();
      const result = { imported: 0, updated: 0, needsReview: 0, removed: 0, total: snapshot.transactions.length };
      const inserts: Prisma.VerityTransactionCreateManyInput[] = [];
      const changes: Record<string, unknown>[] = [];
      const unchanged: string[] = [];
      for (const source of snapshot.transactions) {
        const old = byExternal.get(source.id);
        if (source.sourceKey && bySource.has(source.sourceKey) && bySource.get(source.sourceKey) !== source.id) {
          throw new IntegrationError("Verity changed a canonical transaction identity. Nothing was imported; review the source connection.", 409);
        }
        const fingerprint = sourceFingerprint(source);
        const original = old ? JSON.parse(old.originalJson) as SourceTransaction : null;
        const provenanceChanged = original && (original.accountId !== source.accountId || original.sourceKey !== source.sourceKey);
        // Even an unallocated identity change is quarantined rather than guessed.
        const review = Boolean(provenanceChanged || (old?.allocations.length && (old.fingerprint !== fingerprint || old.status === "NEEDS_REVIEW")));
        const status = review ? "NEEDS_REVIEW" : source.currency === "EUR" ? "READY" : "UNSUPPORTED_CURRENCY";
        const values = {
          accountId: source.accountId, accountName: source.accountName, postedDate: source.postedDate,
          amountMinor: BigInt(source.amountMinor), currency: source.currency, description: source.description,
          counterpartyName: source.counterpartyName, counterpartyIban: source.counterpartyIban,
          // Keep the initial provenance key reserved when a source changes identity.
          sourceKey: old ? old.sourceKey : source.sourceKey, sourceUpdatedAt: source.updatedAt,
          fingerprint, payloadJson: json(source), status, sourceMissing: false, lastSeenAt: now,
          reviewReason: review ? "The source or its identity changed after import. Review allocations before continuing." : null,
        };
        if (old) {
          if (old.payloadJson === values.payloadJson && !old.sourceMissing && old.status === status && old.reviewReason === values.reviewReason && old.fingerprint === fingerprint) unchanged.push(old.id);
          else changes.push({ id: old.id, ...values, lastSeenAt: now.getTime(), updatedAt: now.getTime() });
          if (old.payloadJson !== values.payloadJson || old.sourceMissing) result.updated++;
        } else {
          inserts.push({ ...values, userId, connectionId: current.id, externalId: source.id, originalJson: json(source) });
          result.imported++;
        }
        if (review) result.needsReview++;
        seen.add(source.id);
      }
      let processed = 0;
      for (let offset = 0; offset < inserts.length; offset += 250) {
        const batch = inserts.slice(offset, offset + 250);
        await tx.verityTransaction.createMany({ data: batch });
        processed += batch.length;
        report({ stage: "saving_transactions", processed, total: snapshot.transactions.length });
      }
      // All values are bound parameters; only this fixed column allowlist forms SQL.
      const columns = ["accountId", "accountName", "postedDate", "amountMinor", "currency", "description", "counterpartyName", "counterpartyIban", "sourceKey", "sourceUpdatedAt", "fingerprint", "payloadJson", "status", "sourceMissing", "lastSeenAt", "reviewReason", "updatedAt"];
      for (let offset = 0; offset < changes.length; offset += 250) {
        const batch = changes.slice(offset, offset + 250);
        const selectColumns = Prisma.raw(["id", ...columns].map((column) => `json_extract(value, '$.${column}') AS "${column}"`).join(", "));
        const assignments = Prisma.raw(columns.map((column) => `"${column}" = incoming."${column}"`).join(", "));
        const count = await tx.$executeRaw(Prisma.sql`WITH incoming AS (SELECT ${selectColumns} FROM json_each(${json(batch)}))
          UPDATE "VerityTransaction" SET ${assignments} FROM incoming
          WHERE "VerityTransaction".id = incoming.id AND "VerityTransaction"."userId" = ${userId}`);
        if (count !== batch.length) throw new IntegrationError("The imported records changed. Retry the complete import.", 409);
        processed += batch.length;
        report({ stage: "saving_transactions", processed, total: snapshot.transactions.length });
      }
      for (let offset = 0; offset < unchanged.length; offset += 250) {
        const ids = unchanged.slice(offset, offset + 250);
        await tx.verityTransaction.updateMany({ where: { userId, id: { in: ids } }, data: { lastSeenAt: now } });
        processed += ids.length;
        report({ stage: "saving_transactions", processed, total: snapshot.transactions.length });
      }
      const removed: string[] = [], removedWithMatches: string[] = [];
      for (const old of existing) {
        if (seen.has(old.externalId)) continue;
        const review = old.allocations.length > 0;
        (review ? removedWithMatches : removed).push(old.id);
        if (review) result.needsReview++; else result.removed++;
      }
      for (const [ids, review] of [[removed, false], [removedWithMatches, true]] as const) {
        for (let offset = 0; offset < ids.length; offset += 250) await tx.verityTransaction.updateMany({
          where: { userId, id: { in: ids.slice(offset, offset + 250) } },
          data: { sourceMissing: true, status: review ? "NEEDS_REVIEW" : "REMOVED", reviewReason: review ? "The confirmed bank transaction is no longer in the Verity snapshot. Review it; Rental has not reversed any money." : "No longer returned by Verity." },
        });
      }
      report({ stage: "committing", total: snapshot.transactions.length });
      await tx.verityConnection.update({ where: { userId }, data: { accountsJson: json(snapshot.connection.accounts), remoteConnectionId: snapshot.connection.connectionId, lastSyncedAt: now, lastError: null } });
      return result;
    });
    const pending = await db.verityAllocation.count({ where: { userId, contextStatus: { not: "SYNCED" } } });
    if (pending) {
      report({ stage: "sharing_context", total: pending });
      await retryContext(userId).catch(() => undefined);
    }
    return summary;
  }

  async function getTransactions(userId: string) {
    // Query each owned table directly. A nested include with thousands of parent
    // IDs exceeds SQLite/libSQL's bind parameter limit when ordering allocations.
    const [rows, allocations] = await Promise.all([
      db.verityTransaction.findMany({ where: { userId }, orderBy: [{ postedDate: "desc" }, { id: "asc" }], take: 10_001,
        select: { id: true, externalId: true, accountId: true, accountName: true, postedDate: true, amountMinor: true, currency: true, description: true, counterpartyName: true, counterpartyIban: true, status: true, reviewReason: true, sourceMissing: true } }),
      db.verityAllocation.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    ]);
    const byTransaction = new Map<string, typeof allocations>();
    for (const allocation of allocations) {
      const items = byTransaction.get(allocation.transactionId) ?? [];
      items.push(allocation); byTransaction.set(allocation.transactionId, items);
    }
    return { truncated: rows.length > 10_000, transactions: rows.slice(0, 10_000).map((row) => ({
      id: row.id, externalId: row.externalId, accountId: row.accountId, accountName: row.accountName,
      postedDate: row.postedDate, amountMinor: safeNumber(row.amountMinor), currency: row.currency,
      description: row.description, counterpartyName: row.counterpartyName, counterpartyIban: row.counterpartyIban,
      status: row.status, reviewReason: row.reviewReason, sourceMissing: row.sourceMissing,
      allocations: (byTransaction.get(row.id) ?? []).map(safeAllocation),
    })) };
  }

  async function allocate(userId: string, raw: AllocationInput) {
    const input = AllocationInputSchema.parse(raw);
    const { idempotencyKey: providedKey, ...request } = input;
    const requestHash = sha(request);
    const idempotencyKey = providedKey ?? requestHash;
    const verified = await db.verityConnection.findUnique({ where: { userId } });
    if (!verified?.encryptedToken || verified.status !== "CONNECTED") throw new IntegrationError("Connect Verity before continuing.", 409);
    let remote;
    try { remote = await makeClient(decryptToken(verified.encryptedToken, userId)).getConnection(); }
    catch { throw new IntegrationError("Verity identity could not be checked. Retry before recording money.", 502); }
    if (remote.ownerId !== verified.remoteOwnerId || remote.connectionId !== verified.remoteConnectionId) throw new IntegrationError("The Verity connection changed. Reconnect before recording money.", 409);
    await requireMatchingEmail(userId, remote);
    const allocation = await locked(userId, async (tx) => {
      const connection = await tx.verityConnection.findUniqueOrThrow({ where: { userId } });
      if (connection.encryptedToken !== verified.encryptedToken) throw new IntegrationError("The connection changed. Refresh before retrying.", 409);
      await requireMatchingEmail(userId, remote, tx);
      if (!connection.lastSyncedAt || !connection.encryptedToken) throw new IntegrationError("Sync this connection before confirming a bank allocation.", 409);
      try { decryptToken(connection.encryptedToken, userId); } catch { throw new IntegrationError("The saved connection cannot be unlocked. Check server credentials before recording money.", 409); }
      const repeated = await tx.verityAllocation.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
      if (repeated) {
        if (repeated.requestHash !== requestHash) throw new IntegrationError("This request key belongs to a different confirmation.", 409);
        if (repeated.status === "UNDONE") throw new IntegrationError("This confirmation was undone. Start a new confirmation to allocate again.", 409);
        return repeated;
      }
      const source = await tx.verityTransaction.findFirst({ where: { id: input.transactionId, userId }, include: { allocations: { where: { status: "CONFIRMED" } } } });
      if (!source) throw new IntegrationError("Bank transaction not found.", 404);
      if (source.status !== "READY" || source.sourceMissing || source.currency !== "EUR") throw new IntegrationError("This transaction needs source review or uses a currency that cannot be allocated in version 1.", 409);
      const amount = input.amountMinor;
      const sourceAmount = safeNumber(source.amountMinor);
      if ((input.kind === "rent" && sourceAmount <= 0) || (input.kind !== "rent" && sourceAmount >= 0)) throw new IntegrationError("Rent requires a bank credit; expenses and mortgage payments require a bank debit.", 409);
      const alreadyAllocated = source.allocations.reduce((sum, row) => sum + row.amountMinor, BigInt(0));
      if (alreadyAllocated + BigInt(amount) > BigInt(Math.abs(sourceAmount))) throw new IntegrationError("This allocation exceeds the transaction's unallocated amount.", 409);
      const claimed = await tx.verityAllocation.aggregate({ where: { userId, kind: input.kind, targetId: input.targetId, status: "CONFIRMED" }, _sum: { amountMinor: true } });
      const targetClaimed = safeNumber(claimed._sum.amountMinor ?? BigInt(0));
      let propertyId: string;
      let propertyName: string;
      let targetLabel: string;
      let ledgerBeforeJson: string | null = null;
      let ledgerAfterJson: string | null = null;
      if (input.kind === "rent") {
        const payment = await tx.payment.findFirst({ where: { id: input.targetId, userId, occupancy: { userId, tenant: { userId }, room: { userId, property: { userId } } } }, include: { occupancy: { include: { tenant: true, room: { include: { property: true } } } } } });
        if (!payment) throw new IntegrationError("Rent payment not found.", 404);
        if (payment.status === "WAIVED") throw new IntegrationError("A waived payment cannot receive a bank allocation.", 409);
        const paid = minor(payment.amountPaid);
        if (targetClaimed > paid) throw new IntegrationError("The rent ledger changed after matching. Review existing allocations.", 409);
        if (input.mode === "link_existing") {
          if (targetClaimed + amount > paid) throw new IntegrationError("The match exceeds the existing unlinked paid amount. Use a new receipt only for genuinely new money.", 409);
        } else {
          if (paid > targetClaimed) throw new IntegrationError("This rent already contains unlinked paid money. Link the existing receipt before adding new money.", 409);
          const newPaid = paid + amount;
          if (!Number.isSafeInteger(newPaid) || newPaid > minor(payment.amountDue)) throw new IntegrationError("This receipt exceeds the rent remaining due.", 409);
          const before = { amountPaid: payment.amountPaid, status: payment.status, paidAt: payment.paidAt, paymentMethod: payment.paymentMethod };
          const status = computePaymentStatus({ ...payment, amountPaid: newPaid / 100 });
          const changed = await tx.payment.updateMany({ where: { id: payment.id, userId, updatedAt: payment.updatedAt, amountPaid: payment.amountPaid, status: payment.status }, data: {
            amountPaid: newPaid / 100, status,
            paidAt: payment.paidAt ?? new Date(`${source.postedDate}T12:00:00Z`),
            paymentMethod: payment.paymentMethod ?? "BANK_TRANSFER",
          } });
          if (changed.count !== 1) throw new IntegrationError("The rent changed during confirmation. Refresh before retrying.", 409);
          const after = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
          ledgerBeforeJson = json(before);
          ledgerAfterJson = json(after);
        }
        propertyId = payment.occupancy.room.propertyId;
        propertyName = payment.occupancy.room.property.name;
        targetLabel = `${payment.occupancy.tenant.firstName} ${payment.occupancy.tenant.lastName} · ${payment.periodYear}-${String(payment.periodMonth).padStart(2, "0")}`;
      } else if (input.kind === "expense") {
        if (input.mode !== "link_existing") throw new IntegrationError("Version 1 links an existing property expense. Record the expense first, then match it.", 409);
        const expense = await tx.propertyExpense.findFirst({ where: { id: input.targetId, userId, property: { userId } }, include: { property: true } });
        if (!expense) throw new IntegrationError("Property expense not found.", 404);
        if (targetClaimed + amount > minor(expense.amount)) throw new IntegrationError("The match exceeds the expense's unlinked amount.", 409);
        propertyId = expense.propertyId; propertyName = expense.property.name; targetLabel = expense.title;
      } else {
        if (input.mode !== "add_receipt") throw new IntegrationError("A mortgage allocation records an actual bank payment. Use add_receipt; forecasts are unchanged.", 409);
        const mortgage = await tx.mortgage.findFirst({ where: { id: input.targetId, userId, property: { userId } }, include: { property: true } });
        if (!mortgage) throw new IntegrationError("Mortgage not found.", 404);
        propertyId = mortgage.propertyId; propertyName = mortgage.property.name; targetLabel = mortgage.label || mortgage.lender || "Mortgage payment";
      }
      const id = randomUUID();
      const context: VerityContext = { allocationId: id, transactionId: source.externalId, kind: input.kind, amountMinor: amount, propertyId, propertyName, targetId: input.targetId, targetLabel };
      const created = await tx.verityAllocation.create({ data: {
        id, userId, transactionId: source.id, idempotencyKey, requestHash,
        kind: input.kind, targetId: input.targetId, targetLabel, propertyId, propertyName,
        amountMinor: BigInt(amount), mode: input.mode, sourceSnapshotJson: source.payloadJson,
        ledgerBeforeJson, ledgerAfterJson, contextPayloadJson: json(context),
      } });
      await tx.activityLog.create({ data: { userId, action: "VERITY_ALLOCATION_CONFIRMED", description: `Confirmed bank ${input.mode === "link_existing" ? "match" : "receipt"} for ${targetLabel}`, entityType: "VERITY_ALLOCATION", entityId: id, propertyId, metadata: json({ transactionId: source.id, kind: input.kind, amountMinor: amount, mode: input.mode }) } });
      return created;
    });
    await retryContext(userId).catch(() => undefined);
    const latest = await db.verityAllocation.findFirstOrThrow({ where: { id: allocation.id, userId } });
    return { allocation: safeAllocation(latest), contextPending: latest.contextStatus !== "SYNCED" };
  }

  async function undo(userId: string, id: string) {
    const allocation = await locked(userId, async (tx) => {
      const row = await tx.verityAllocation.findFirst({ where: { id, userId } });
      if (!row) throw new IntegrationError("Allocation not found.", 404);
      if (row.status === "UNDONE") return row;
      if (row.kind === "rent" && row.mode === "add_receipt") {
        if (!row.ledgerBeforeJson || !row.ledgerAfterJson) throw new IntegrationError("This receipt has no safe reversal snapshot. Review it manually.", 409);
        const before = JSON.parse(row.ledgerBeforeJson);
        const after = JSON.parse(row.ledgerAfterJson);
        const payment = await tx.payment.findFirst({ where: { id: row.targetId, userId } });
        const reversibleFields = (record: { amountPaid: number; status: string; paidAt: Date | string | null; paymentMethod: string | null }) => ({ amountPaid: record.amountPaid, status: record.status, paidAt: record.paidAt, paymentMethod: record.paymentMethod });
        if (!payment || json(reversibleFields(payment)) !== json(reversibleFields(after))) throw new IntegrationError("The rent ledger changed since this receipt. Automatic undo would overwrite another change; review it manually.", 409);
        const remaining = await tx.verityAllocation.aggregate({ where: { userId, kind: "rent", targetId: row.targetId, status: "CONFIRMED", id: { not: id } }, _sum: { amountMinor: true } });
        if (safeNumber(remaining._sum.amountMinor ?? BigInt(0)) > minor(before.amountPaid)) throw new IntegrationError("Other matches now depend on this receipt. Undo those matches first.", 409);
        const changed = await tx.payment.updateMany({ where: { id: row.targetId, userId, updatedAt: payment.updatedAt, amountPaid: payment.amountPaid }, data: { amountPaid: before.amountPaid, status: before.status, paidAt: before.paidAt ? new Date(before.paidAt) : null, paymentMethod: before.paymentMethod } });
        if (changed.count !== 1) throw new IntegrationError("The rent changed during undo. Refresh before retrying.", 409);
      }
      const connection = await tx.verityConnection.findUniqueOrThrow({ where: { userId } });
      const alreadyRevoked = connection.status === "DISCONNECTED" && !connection.revokePending && !connection.encryptedToken;
      const updated = await tx.verityAllocation.update({ where: { id }, data: { status: "UNDONE", undoneAt: new Date(), contextOperation: "DELETE", contextStatus: alreadyRevoked ? "SYNCED" : "PENDING", contextSyncedAt: alreadyRevoked ? new Date() : null, contextError: null, contextVersion: { increment: 1 } } });
      await tx.activityLog.create({ data: { userId, action: "VERITY_ALLOCATION_UNDONE", description: `Undid bank allocation for ${row.targetLabel}`, entityType: "VERITY_ALLOCATION", entityId: id, metadata: json({ kind: row.kind, amountMinor: row.amountMinor, mode: row.mode }) } });
      return updated;
    }, true);
    await retryContext(userId).catch(() => undefined);
    const latest = await db.verityAllocation.findFirstOrThrow({ where: { id: allocation.id, userId } });
    return { allocation: safeAllocation(latest), contextPending: latest.contextStatus !== "SYNCED" };
  }

  async function retryContext(userId: string) {
    const leaseToken = randomUUID();
    const now = new Date();
    const claim = await db.verityConnection.updateMany({ where: { userId, encryptedToken: { not: null }, OR: [{ contextLeaseUntil: null }, { contextLeaseUntil: { lt: now } }] }, data: { contextLeaseToken: leaseToken, contextLeaseUntil: new Date(now.getTime() + 45_000) } });
    if (claim.count !== 1) return { synced: 0, pending: true };
    let synced = 0;
    try {
      const connection = await db.verityConnection.findUniqueOrThrow({ where: { userId } });
      if (!connection.encryptedToken) return { synced, pending: true };
      let client;
      try { client = makeClient(decryptToken(connection.encryptedToken, userId)); }
      catch { return { synced, pending: true }; }
      if (connection.revokePending) {
        try {
          await client.revoke();
          await db.$transaction(async (tx) => {
            const revoked = await tx.verityConnection.updateMany({ where: { userId, encryptedToken: connection.encryptedToken, revokePending: true }, data: { revokePending: false, encryptedToken: null, lastError: null } });
            // Verity retains revoked grant history but excludes it from active context.
            // A new grant cannot delete old-grant history, so those deletes are resolved.
            if (revoked.count === 1) await tx.verityAllocation.updateMany({ where: { userId, status: "UNDONE" }, data: { contextStatus: "SYNCED", contextError: null, contextSyncedAt: new Date() } });
          });
        } catch {
          await db.verityConnection.updateMany({ where: { userId, revokePending: true }, data: { lastError: "Disconnected locally; Verity revocation is pending. Retry context sync to finish revoking access." } });
        }
        return { synced, pending: Boolean((await db.verityConnection.findUnique({ where: { userId } }))?.revokePending) };
      }
      if (connection.status !== "CONNECTED" || !connection.lastSyncedAt) return { synced, pending: true };
      const allowedAccountIds = (JSON.parse(connection.accountsJson) as { id: string }[]).map((account) => account.id);
      // The lease serializes remote writes. Version checks prevent an old PUT from
      // being marked synced after undo; the next iteration sends its queued DELETE.
      for (let index = 0; index < 100; index++) {
        const row = await db.verityAllocation.findFirst({ where: { userId, contextStatus: { not: "SYNCED" }, OR: [
          { contextOperation: "DELETE" },
          { contextOperation: "UPSERT", transaction: { status: "READY", sourceMissing: false, accountId: { in: allowedAccountIds } } },
        ] }, orderBy: { updatedAt: "asc" } });
        if (!row) break;
        const renewed = await db.verityConnection.updateMany({ where: { userId, contextLeaseToken: leaseToken, status: "CONNECTED", encryptedToken: connection.encryptedToken }, data: { contextLeaseUntil: new Date(Date.now() + 45_000) } });
        if (renewed.count !== 1) break;
        try {
          if (row.contextOperation === "DELETE") await client.deleteContext(row.id);
          else {
            const remote = await client.getConnection();
            if (remote.ownerId !== connection.remoteOwnerId || remote.connectionId !== connection.remoteConnectionId) throw new IntegrationError("The Verity connection changed.", 409);
            await requireMatchingEmail(userId, remote);
            await client.putContext(JSON.parse(row.contextPayloadJson));
          }
          const changed = await db.verityAllocation.updateMany({ where: { id: row.id, userId, contextVersion: row.contextVersion }, data: { contextStatus: "SYNCED", contextError: null, contextSyncedAt: new Date(), contextAttempts: { increment: 1 } } });
          synced += changed.count;
        } catch {
          await db.verityAllocation.updateMany({ where: { id: row.id, userId, contextVersion: row.contextVersion }, data: { contextStatus: "ERROR", contextError: "Saved in Rental. Verity context sync failed; retry without recording the money again.", contextAttempts: { increment: 1 } } });
          break;
        }
      }
      const pending = await db.verityAllocation.count({ where: { userId, contextStatus: { not: "SYNCED" } } });
      return { synced, pending: pending > 0 };
    } finally {
      await db.verityConnection.updateMany({ where: { userId, contextLeaseToken: leaseToken }, data: { contextLeaseToken: null, contextLeaseUntil: null } });
    }
  }

  async function disconnect(userId: string) {
    await locked(userId, async (tx) => {
      const current = await tx.verityConnection.findUniqueOrThrow({ where: { userId } });
      await tx.verityConnection.update({ where: { userId }, data: { status: "DISCONNECTED", revokePending: Boolean(current.encryptedToken), lastError: null } });
    }, true);
    await retryContext(userId);
    return getConnection(userId);
  }
  return { getConnection, connect, sync, getTransactions, allocate, undo, retryContext, disconnect };
}
