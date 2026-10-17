"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { ConnectionProgress } from "./ConnectionProgress";
import { runVerityOperation } from "@/lib/verity/progress-client";
import type { VerityProgress } from "@/lib/verity/progress";

export type RentalTarget = { id: string; kind: "rent" | "expense" | "mortgage"; label: string; detail: string; href: string };
type Allocation = { id: string; kind: RentalTarget["kind"]; targetId: string; amountMinor: number; mode: string; status: string; contextStatus: string };
type Transaction = { id: string; externalId: string; amountMinor: number; currency: string; postedDate: string; description: string; accountName: string; counterpartyIban?: string | null; status: string; allocations: Allocation[] };
type Connection = { id: string; remoteOwnerId: string; accounts: { id: string; name: string; currency: string }[]; lastSyncedAt: string | null; lastError: string | null; status: string; pendingContextCount?: number; revokePending?: boolean };
const API = "/api/integrations/verity";
async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(API + path, { method, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({ error: "The server did not return a valid response. Please try again." }));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The request could not be completed.");
  return data;
}
function money(amount: number, currency = "EUR") { return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount / (10 ** new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits!)); }

export function VerityWorkspace({ targets, configured, accountEmail }: { targets: RentalTarget[]; configured: boolean; accountEmail: string }) {
  const router = useRouter();
  const [truncated, setTruncated] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<{ kind: "connection" | "sync"; startedAt: number; progress: VerityProgress } | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(100);
  const running = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("review");
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const uid = useId();
  const refresh = useCallback(async () => {
    const [status, inbox] = await Promise.all([request<{ connection: Connection | null }>("/connection"), request<{ transactions: Transaction[]; truncated?: boolean }>("/transactions")]);
    setConnection(status.connection); setTransactions(inbox.transactions); setTruncated(Boolean(inbox.truncated));
  }, []);
  useEffect(() => {
    let mounted = true;
    Promise.all([request<{ connection: Connection | null }>("/connection"), request<{ transactions: Transaction[]; truncated?: boolean }>("/transactions")])
      .then(([status, inbox]) => { if (mounted) { setConnection(status.connection); setTransactions(inbox.transactions); setTruncated(Boolean(inbox.truncated)); } })
      .catch((e) => { if (mounted) setError(e.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); await refresh(); router.refresh(); setMessage(success); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Please try again."); } finally { setBusy(false); }
  }
  async function runOperation(kind: "connection" | "sync") {
    if (running.current) return;
    running.current = true;
    setBusy(true); setError(""); setMessage("");
    const startedAt = Date.now();
    setOperation({ kind, startedAt, progress: { stage: kind === "connection" ? "checking_key" : "checking_email" } });
    try {
      const result = await runVerityOperation(kind, (progress) => setOperation({ kind, startedAt, progress }), kind === "connection" ? { token } : undefined);
      if (kind === "connection") {
        setToken(""); setConnection((result as { connection: Connection }).connection);
        setMessage("Connection ready. Your email and selected accounts are confirmed. Import transactions when you’re ready.");
      } else {
        const summary = result as { imported: number; updated: number; total: number; needsReview: number };
        setMessage(`Import complete: ${summary.total.toLocaleString()} transactions checked, ${summary.imported.toLocaleString()} added, ${summary.updated.toLocaleString()} updated${summary.needsReview ? `, ${summary.needsReview.toLocaleString()} need review` : ""}. Review and match payments below; no rent has been recorded automatically.`);
      }
      setOperation(null);
      try { await refresh(); } catch { setError("The operation completed, but this view could not refresh. Reload the page to see the saved result."); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The operation could not finish. Refresh to check the saved state.");
    } finally { setOperation(null); setBusy(false); running.current = false; }
  }
  const connected = connection?.status === "CONNECTED";
  const pending = transactions.filter((tx) => tx.status === "NEEDS_REVIEW").length;
  const visible = transactions.filter((tx) => {
    const allocated = tx.allocations.filter((a) => a.status === "CONFIRMED").reduce((sum, a) => sum + a.amountMinor, 0);
    return (filter !== "review" || tx.status === "NEEDS_REVIEW" || (tx.status === "READY" && allocated < Math.abs(tx.amountMinor))) && `${tx.description} ${tx.accountName} ${tx.postedDate}`.toLowerCase().includes(query.toLowerCase());
  });
  return <div className="rental-page" aria-busy={loading}>
    {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
    {message && <p role="status" className="rounded-lg bg-success/10 p-4 text-sm text-success">{message}</p>}
    {!configured && <div className="rental-panel p-5"><h2 className="font-semibold">Server setup required</h2><p className="mt-2 text-sm text-muted-foreground">Set the Verity server address and apply both apps’ connector migrations before linking an account. No bank data has been imported.</p></div>}
    <section className="rental-panel p-5 sm:p-6" aria-labelledby={`${uid}-connection`}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id={`${uid}-connection`} className="text-lg font-semibold">{connected ? "Connected to Verity" : "Connect your Verity account"}</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Signed in to Rental App as <strong className="break-all font-medium text-foreground">{accountEmail}</strong>. Sign in to Verity with this same email address before creating a connection key. Imported transactions stay in review until you confirm where they belong.</p></div>{connected && <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">Connected</span>}</div>
      {loading ? <p role="status" className="mt-5 text-sm text-muted-foreground">Loading connection…</p> : connected ? <>
        <p className="mt-4 text-sm">{connection.accounts.map((account) => account.name).join(" · ")}</p><p className="mt-1 text-xs text-muted-foreground">{connection.lastSyncedAt ? `Last import: ${new Date(connection.lastSyncedAt).toLocaleString("en-GB")}` : "No transactions imported yet"}</p>
        {connection.lastError && <p className="mt-2 text-sm text-destructive">{connection.lastError}</p>}
        <div className="mt-5 flex flex-wrap gap-3"><button disabled={busy} className="rental-button-primary" onClick={() => void runOperation("sync")}>{operation?.kind === "sync" ? "Importing transactions…" : "Import transactions"}</button><button disabled={busy} className="rental-button-secondary" onClick={() => void act(() => request("/retry-context", "POST"), "Pending updates retried.")}>Retry pending updates</button><button disabled={busy} className="text-sm text-muted-foreground underline" onClick={() => setConfirmDisconnect(true)}>Disconnect</button></div>
        {confirmDisconnect && <div className="mt-4 border-t border-border pt-4"><p className="text-sm">Stop imports and revoke Verity access? Existing matches and your rental records will be kept.</p><div className="mt-3 flex gap-3"><button disabled={busy} className="rental-button-secondary" onClick={() => void act(async () => { await request("/connection", "DELETE"); setConfirmDisconnect(false); }, "Disconnected. Existing records are kept.")}>Confirm disconnect</button><button className="text-sm text-muted-foreground" onClick={() => setConfirmDisconnect(false)}>Cancel</button></div></div>}
      </> : <form className="mt-5 max-w-xl space-y-3" onSubmit={(event) => { event.preventDefault(); void runOperation("connection"); }}>
        <label htmlFor={`${uid}-token`} className="block text-sm font-medium">Connection token from Verity</label><input id={`${uid}-token`} type="password" disabled={busy} autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} required maxLength={2048} className="rental-input" aria-describedby={`${uid}-token-help`} /><p id={`${uid}-token-help`} className="text-xs leading-relaxed text-muted-foreground">In Verity, open Rental App connection, select the bank accounts, and create a token. It is stored encrypted on the server.</p><button disabled={busy || !configured || Boolean(connection?.revokePending)} className="rental-button-primary">{busy ? "Connecting…" : "Connect Verity"}</button>
      </form>}
      {operation && <ConnectionProgress progress={operation.progress} startedAt={operation.startedAt} />}
      {connection?.revokePending && <div className="mt-4 text-sm"><p className="text-destructive">Verity could not confirm revocation. Retry before reconnecting, or revoke the token directly in Verity.</p><button disabled={busy} className="rental-button-secondary mt-3" onClick={() => void act(() => request("/retry-context", "POST"), "Revocation retried.")}>Retry revocation</button></div>}
    </section>
    <section className="rental-panel overflow-hidden" aria-labelledby={`${uid}-inbox`}>
      <div className="border-b border-border p-5"><h2 id={`${uid}-inbox`} className="text-lg font-semibold">Transaction review</h2><p className="mt-1 text-sm text-muted-foreground">Rent received, mortgage payments, and utility bills. EUR allocations are supported in this first version.</p>{pending > 0 && <p className="mt-2 text-sm text-destructive">{pending} source {pending === 1 ? "transaction has" : "transactions have"} changed. Undo affected matches before reviewing again.</p>}
      {truncated && <p role="status" className="mt-2 text-sm text-warning">Showing the latest 10,000 imported transactions. Older matches remain saved.</p>}
      <div className="mt-4 flex flex-wrap gap-3"><input aria-label="Search imported transactions" placeholder="Search description, account or date" value={query} onChange={(e) => setQuery(e.target.value)} className="rental-input max-w-md" /><select aria-label="Transaction review filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="rental-input w-auto"><option value="review">Needs matching</option><option value="all">All imported transactions</option></select></div></div>
      {!loading && visible.length === 0 && <div className="px-5 py-12 text-center"><h3 className="font-semibold">{transactions.length ? "No transactions in this view" : "Your bank matches will appear here"}</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{transactions.length ? "Try another filter or search." : "Connect Verity and import transactions, then choose the rental record for each payment."}</p></div>}
      <div className="divide-y divide-border">{visible.slice(0, visibleLimit).map((tx) => {
        const allocations = tx.allocations.filter((a) => a.status === "CONFIRMED");
        const available = Math.max(0, Math.abs(tx.amountMinor) - allocations.reduce((sum, a) => sum + a.amountMinor, 0));
        return <article key={tx.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{tx.description || "Bank transaction"}</p><p className="mt-1 text-xs text-muted-foreground">{tx.postedDate} · {tx.accountName}</p>{tx.counterpartyIban && <p className="mt-1 break-all text-xs text-muted-foreground">{tx.counterpartyIban}</p>}</div><div className="text-right"><p className={`text-base font-semibold ${tx.amountMinor > 0 ? "text-success" : "text-foreground"}`}>{money(tx.amountMinor, tx.currency)}</p><p className="mt-1 text-xs text-muted-foreground">{tx.status === "READY" ? (available ? "Awaiting match" : "Matched") : tx.status.replaceAll("_", " ").toLowerCase()}</p></div></div>
          {allocations.length > 0 && <ul className="mt-4 space-y-2">{allocations.map((a) => { const target = targets.find((target) => target.id === a.targetId && target.kind === a.kind); return <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm"><div>{target ? <Link href={target.href} className="text-primary hover:underline">{target.label}</Link> : <span>{a.kind} match</span>}<p className="mt-1 text-xs text-muted-foreground">{money(a.amountMinor)} · {a.mode === "link_existing" ? "Linked to existing record" : a.kind === "mortgage" ? "Actual mortgage payment" : "Receipt recorded"}{a.contextStatus !== "SYNCED" ? " · Verity update pending" : " · Shared with Verity"}</p></div><button disabled={busy} className="text-xs text-primary underline" onClick={() => void act(() => request(`/allocations/${a.id}`, "DELETE"), "Match undone. Review the updated record before matching again.")}>Undo match</button></li>; })}</ul>}
          {selected === tx.id ? <MatchForm key={tx.id} transaction={tx} available={available} targets={targets} busy={busy} onCancel={() => setSelected(null)} onConfirm={(payload) => act(async () => { await request("/allocations", "POST", payload); setSelected(null); }, "Match saved. Any pending Verity update can be retried without posting it twice.")} /> : connected && tx.status === "READY" && tx.currency === "EUR" && available > 0 && <button disabled={busy} className="rental-button-secondary mt-4" onClick={() => setSelected(tx.id)}>Match {money(available)}</button>}
        </article>;
      })}</div>
      {visible.length > visibleLimit && <div className="border-t border-border p-5"><button className="rental-button-secondary" onClick={() => setVisibleLimit((limit) => limit + 100)}>Show more transactions</button><span className="ml-3 text-sm text-muted-foreground">Showing {visibleLimit.toLocaleString()} of {visible.length.toLocaleString()}</span></div>}
    </section>
  </div>;
}

function MatchForm({ transaction, available, targets, busy, onCancel, onConfirm }: { transaction: Transaction; available: number; targets: RentalTarget[]; busy: boolean; onCancel: () => void; onConfirm: (value: unknown) => Promise<void> }) {
  const uid = useId();
  const [kind, setKind] = useState<RentalTarget["kind"]>(transaction.amountMinor > 0 ? "rent" : "expense");
  const [targetId, setTargetId] = useState("");
  const [mode, setMode] = useState("link_existing");
  const [amount, setAmount] = useState((available / 100).toFixed(2));
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState("");
  const requestKey = useRef({ signature: "", id: "" });
  const choices = targets.filter((target) => target.kind === kind && target.label.toLowerCase().includes(search.toLowerCase()));
  const chosen = targets.find((target) => target.id === targetId && target.kind === kind);
  return <form className="mt-5 space-y-4 border-t border-border pt-5" onSubmit={(event) => { event.preventDefault(); setFormError(""); if (!/^\d+(\.\d{1,2})?$/.test(amount)) { setFormError("Enter a positive amount with no more than two decimal places."); return; } const [whole, fraction = ""] = amount.split("."); const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, "0")); if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > available) { setFormError("The amount must fit within the unmatched bank transaction."); return; } const payload = { transactionId: transaction.id, kind, targetId, amountMinor, mode: kind === "mortgage" ? "add_receipt" : kind === "expense" ? "link_existing" : mode }; const signature = JSON.stringify(payload); if (requestKey.current.signature !== signature) requestKey.current = { signature, id: crypto.randomUUID() }; void onConfirm({ ...payload, idempotencyKey: requestKey.current.id }); }}>
    <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor={`${uid}-kind`} className="mb-1.5 block text-sm font-medium">Payment type</label><select id={`${uid}-kind`} value={kind} onChange={(event) => { setKind(event.target.value as RentalTarget["kind"]); setTargetId(""); }} className="rental-input">{transaction.amountMinor > 0 ? <option value="rent">Rent received</option> : <><option value="expense">Utility or property cost</option><option value="mortgage">Mortgage payment</option></>}</select></div><div><label htmlFor={`${uid}-amount`} className="mb-1.5 block text-sm font-medium">Amount to match (EUR)</label><input id={`${uid}-amount`} inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} className="rental-input" /></div></div>
    <div><label htmlFor={`${uid}-search`} className="mb-1.5 block text-sm font-medium">Find a rental record</label><input id={`${uid}-search`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Property, tenant or period" className="rental-input" /></div>
    <div><label htmlFor={`${uid}-target`} className="mb-1.5 block text-sm font-medium">{kind === "rent" ? "Tenancy and rent period" : kind === "mortgage" ? "Property and mortgage" : "Existing bill"}</label><select id={`${uid}-target`} required value={targetId} onChange={(event) => setTargetId(event.target.value)} className="rental-input"><option value="">Choose a record</option>{choices.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select>{chosen && <p className="mt-2 text-sm text-muted-foreground">{chosen.detail}</p>}{choices.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No matching record. Add the {kind === "expense" ? "bill with its reporting period" : kind === "mortgage" ? "mortgage" : "tenancy and rent period"} in Rental App, then return here.</p>}</div>
    {kind === "rent" && <div><label htmlFor={`${uid}-mode`} className="mb-1.5 block text-sm font-medium">How should this affect recorded rent?</label><select id={`${uid}-mode`} value={mode} onChange={(event) => setMode(event.target.value)} className="rental-input"><option value="link_existing">Already recorded — link evidence only</option><option value="add_receipt">Not recorded yet — add this receipt</option></select><p className="mt-2 text-xs text-muted-foreground">Link any existing manual receipts first. This prevents importing money you have already recorded.</p></div>}
    {kind === "mortgage" && <p className="text-sm leading-relaxed text-muted-foreground">This records the actual bank payment. It does not change loan terms or treat forecast principal and interest as bank-confirmed amounts.</p>}
    {kind === "expense" && <p className="text-sm leading-relaxed text-muted-foreground">This links bank evidence to the existing bill. Its amount, receipt, and service period remain as recorded.</p>}
    {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
    <div className="flex gap-3"><button disabled={busy || !targetId} className="rental-button-primary">{busy ? "Saving…" : "Confirm match"}</button><button type="button" onClick={onCancel} disabled={busy} className="rental-button-secondary">Cancel</button></div>
  </form>;
}
