"use client";

import { useEffect, useState } from "react";
import type { VerityProgress, VerityStage } from "@/lib/verity/progress";

const copy: Record<VerityStage, { title: string; detail: string }> = {
  checking_key: { title: "Checking your connection key", detail: "Contacting Verity to confirm access to your selected accounts." },
  checking_email: { title: "Confirming your account", detail: "Checking that Rental App and Verity use the same email address." },
  saving_connection: { title: "Saving your connection", detail: "Storing the connection key securely. Transactions have not been imported yet." },
  reading_transactions: { title: "Reading transactions from Verity", detail: "Fetching the complete account history. Nothing is posted to your rental records." },
  saving_transactions: { title: "Preparing your transaction review", detail: "Checking duplicates and preparing the import. Changes are saved together when this finishes." },
  committing: { title: "Saving the complete import", detail: "Finalising the import so it is ready for review." },
  sharing_context: { title: "Sending previously confirmed matches to Verity", detail: "The import is saved. Updating the property details attached to your existing matches." },
};

export function ConnectionProgress({ progress, startedAt }: { progress: VerityProgress; startedAt: number }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const state = copy[progress.stage];
  const determinate = progress.stage === "saving_transactions" && Boolean(progress.total);
  return <div className="mt-5 border-t border-border pt-5">
    <div className="flex items-start justify-between gap-4"><div role="status" aria-live="polite" aria-atomic="true">
      <p className="font-medium text-foreground">{state.title}</p>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{state.detail}</p>
      {progress.stage === "reading_transactions" && <p className="mt-2 text-sm tabular-nums">{(progress.processed ?? 0).toLocaleString()} transactions read{progress.accounts ? ` from ${progress.accounts} selected ${progress.accounts === 1 ? "account" : "accounts"}` : ""}</p>}
      {determinate && <p className="mt-2 text-sm tabular-nums">{(progress.processed ?? 0).toLocaleString()} of {progress.total!.toLocaleString()} transactions prepared</p>}
    </div><span aria-label="Elapsed time" className="shrink-0 text-sm tabular-nums text-muted-foreground">{seconds}s</span></div>
    {determinate && <progress aria-label="Transactions prepared for saving" value={progress.processed ?? 0} max={progress.total} className="mt-3 h-1.5 w-full accent-primary" />}
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{seconds >= 15 ? "Still working. Larger account histories can take longer. " : ""}Keep this page open until the result appears. If you leave, refresh this page to check the saved state before retrying.</p>
  </div>;
}
