import { z } from "zod";

const identifier = z.string().min(1).max(256);
const currency = z.string().regex(/^[A-Z]{3}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "Invalid posting date");
export const VerityAccountSchema = z.object({ id: identifier, name: z.string().max(500), currency });
export const VerityConnectionSchema = z.object({ version: z.literal(1), ownerId: identifier, connectionId: identifier, accounts: z.array(VerityAccountSchema).min(1).max(200) });
export const VerityTransactionSchema = z.object({
  id: identifier, accountId: identifier, accountName: z.string().max(500), postedDate: date,
  amountMinor: z.number().int().safe(), currency,
  description: z.string().max(10000), counterpartyName: z.string().max(1000).nullable(),
  counterpartyIban: z.string().max(128).nullable(), sourceKey: z.string().min(1).max(1000).nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
});
export const VerityPageSchema = z.object({ version: z.literal(1), ownerId: identifier, transactions: z.array(VerityTransactionSchema).max(100), nextCursor: z.string().min(1).max(2000).nullable() });
export const VerityContextSchema = z.object({
  allocationId: identifier, transactionId: identifier, kind: z.enum(["rent", "expense", "mortgage"]),
  amountMinor: z.number().int().positive().safe(), propertyId: identifier, propertyName: z.string().min(1).max(500),
  targetId: identifier, targetLabel: z.string().min(1).max(1000),
});
export type VerityAccount = z.infer<typeof VerityAccountSchema>;
export type VerityConnection = z.infer<typeof VerityConnectionSchema>;
export type VerityTransaction = z.infer<typeof VerityTransactionSchema>;
export type VerityContext = z.infer<typeof VerityContextSchema>;
