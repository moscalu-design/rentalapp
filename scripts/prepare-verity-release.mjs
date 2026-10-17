// Opt-in, additive release migration. Never seeds or rewrites rental records.
import { createClient } from "@libsql/client";
import { readFile } from "node:fs/promises";

const version = "20261016221000";
if (process.env.VERCEL_TARGET_ENV === "production" && process.env.VERITY_API_BASE_URL) {
  if ((process.env.AUTH_SECRET?.length ?? 0) < 32) throw new Error("Connector requires the existing stable AUTH_SECRET to have at least 32 characters.");
  for (const key of ["AUTH_URL", "VERITY_API_BASE_URL"]) {
    const url = new URL(process.env[key]);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error(`${key} must be an HTTPS origin.`);
  }
}

if (process.env.VERITY_APPLY_MIGRATION === version) {
  const url = process.env.DATABASE_URL;
  if (!url || (!url.startsWith("libsql://") && !url.startsWith("https://") && !url.startsWith("file:"))) throw new Error("Expected an explicitly configured LibSQL or local test database.");
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  const raw = await readFile(new URL(`../prisma/migrations/${version}_add_verity_connector/migration.sql`, import.meta.url), "utf8");
  const statements = raw.replace(/^\s*--.*$/gm, "").split(/;\s*(?:\n|$)/).map(x => x.trim()).filter(Boolean);
  const tables = [...raw.matchAll(/CREATE TABLE "([^"]+)"/g)].map(x => x[1]);
  const indexes = [...raw.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)"/g)].map(x => x[1]);
  const tx = await client.transaction("write");
  try {
    const existing = await tx.execute("SELECT name FROM sqlite_master WHERE type='table'");
    const names = new Set(existing.rows.map(row => row.name));
    if (!names.has("User")) throw new Error("Existing Rental schema is required; this migration never creates or seeds a new app database.");
    const present = tables.filter(table => names.has(table));
    if (present.length && present.length !== tables.length) throw new Error("Partial connector schema found; refusing an ambiguous migration.");
    if (!present.length) for (const statement of statements) await tx.execute(statement);
    for (const table of tables) {
      const definition = raw.split(`CREATE TABLE "${table}" (`)[1].split("\n);")[0];
      const expected = [...definition.matchAll(/^\s+"([^"]+)"\s/gm)].map(x => x[1]);
      const columns = await tx.execute(`PRAGMA table_info("${table}")`);
      const actual = new Set(columns.rows.map(row => row.name));
      if (expected.some(column => !actual.has(column))) throw new Error(`Connector columns do not match the reviewed migration: ${table}`);
    }
    const actualIndexes = new Set((await tx.execute("SELECT name FROM sqlite_master WHERE type='index'")).rows.map(row => row.name));
    if (indexes.some(index => !actualIndexes.has(index))) throw new Error("Connector indexes do not match the reviewed migration.");
    await tx.commit();
    console.log(`Connector schema ${version}: ${present.length ? "already applied and verified" : "applied and verified"}; 3 tables, ${indexes.length} indexes.`);
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); client.close(); }
}
