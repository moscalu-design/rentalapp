export type VerityStage = "checking_key" | "checking_email" | "saving_connection" | "reading_transactions" | "saving_transactions" | "committing" | "sharing_context";
export type VerityProgress = { stage: VerityStage; processed?: number; total?: number; accounts?: number; page?: number };
export type ReportProgress = (progress: VerityProgress) => void;
export type VerityEvent = { type: "progress"; progress: VerityProgress } | { type: "result"; result: unknown } | { type: "error"; error: string };
