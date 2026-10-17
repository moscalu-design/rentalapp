import { VerityConnectionSchema, VerityContextSchema, VerityPageSchema, type VerityContext, type VerityTransaction } from "./schemas";

const MAX_PAGES = 100;
const MAX_RESPONSE_BYTES = 2_000_000;

export class VerityHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "VerityHttpError";
  }
}

export function getVerityBaseUrl() {
  const configured = process.env.VERITY_API_BASE_URL;
  if (!configured) throw new Error("VERITY_API_BASE_URL is not configured on this server.");
  let url: URL;
  try { url = new URL(configured); } catch { throw new Error("Invalid Verity server address."); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "") || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && local && url.protocol === "http:"))) {
    throw new Error("Verity must use an HTTPS origin. Local development may use a loopback HTTP origin.");
  }
  return url.origin;
}

async function boundedJson(response: Response) {
  if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) throw new Error("Verity response exceeds the import limit.");
  if (!response.body) throw new Error("Verity returned an empty response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error("Verity response exceeds the import limit."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new Error("Verity returned an invalid response."); }
}

export function createVerityClient(token: string) {
  const base = getVerityBaseUrl();
  if (!token || token.length > 2048 || /[\r\n]/.test(token)) throw new Error("Invalid Verity connection token.");
  async function request(path: string, init: RequestInit = {}, expectsBody = true): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${base}/api/integrations/rental/v1/${path}`, {
        ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
      });
    } catch { throw new Error("Cannot reach Verity. Check the server address and try again."); }
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) throw new VerityHttpError(response.status, "Verity access expired or was revoked. Reconnect with a new token.");
      if (response.status === 409) throw new VerityHttpError(response.status, "Verity reported a changed transaction or conflicting allocation. Review it before retrying.");
      throw new VerityHttpError(response.status, `Verity could not complete the request (${response.status}). Try again later.`);
    }
    return expectsBody ? boundedJson(response) : undefined;
  }
  async function getConnection() {
    return VerityConnectionSchema.parse(await request("connection"));
  }
  return {
    getConnection,
    async getSnapshot(expectedOwnerId?: string) {
      const connection = await getConnection();
      if (expectedOwnerId && connection.ownerId !== expectedOwnerId) throw new Error("This connection belongs to a different Verity owner.");
      const accounts = new Set(connection.accounts.map((account) => account.id));
      if (accounts.size !== connection.accounts.length) throw new Error("Verity returned duplicate account permissions.");
      const ids = new Set<string>(); const sourceKeys = new Set<string>(); const cursors = new Set<string>();
      const transactions: VerityTransaction[] = [];
      let cursor: string | null = null;
      for (let index = 0; index < MAX_PAGES; index++) {
        const params = new URLSearchParams({ limit: "100" }); if (cursor) params.set("cursor", cursor);
        const page = VerityPageSchema.parse(await request(`transactions?${params}`));
        if (page.ownerId !== connection.ownerId) throw new Error("Verity owner changed during import. Nothing was imported.");
        for (const transaction of page.transactions) {
          if (!accounts.has(transaction.accountId)) throw new Error("Verity returned an account outside this connection's permission.");
          if (ids.has(transaction.id) || (transaction.sourceKey && sourceKeys.has(transaction.sourceKey))) throw new Error("Verity changed or duplicated a transaction during import. Retry a fresh sync.");
          ids.add(transaction.id); if (transaction.sourceKey) sourceKeys.add(transaction.sourceKey);
          transactions.push(transaction);
        }
        if (page.nextCursor === null) return { connection, transactions };
        if (cursors.has(page.nextCursor)) throw new Error("Verity returned a repeated page. Nothing was imported.");
        cursors.add(page.nextCursor); cursor = page.nextCursor;
      }
      throw new Error("This connection exceeds 10,000 transactions. Narrow the account selection before importing.");
    },
    async putContext(payload: VerityContext) { await request("context", { method: "PUT", body: JSON.stringify(VerityContextSchema.parse(payload)) }, false); },
    async deleteContext(id: string) { await request(`context?${new URLSearchParams({ allocationId: id })}`, { method: "DELETE" }, false); },
    async revoke() {
      try { await request("connection", { method: "DELETE" }, false); }
      catch (error) {
        // An expired or revoked credential already has no access. Network failures
        // and other refusals must remain pending until revocation is confirmed.
        if (!(error instanceof VerityHttpError && error.status === 401)) throw error;
      }
    },
  };
}
