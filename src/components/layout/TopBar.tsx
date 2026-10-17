import Link from "next/link";

interface TopBarProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}

export function TopBar({ title, description, actions, backHref, backLabel }: TopBarProps) {
  return (
    <div className="shrink-0 px-4 pt-6 pb-2 sm:px-6 lg:px-8 lg:pt-8">
      <div className="mx-auto flex w-full max-w-[1416px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          {backHref && (
            <Link
              href={backHref}
              className="mb-1 inline-flex items-center gap-1 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {backLabel ?? "Back"}
            </Link>
          )}
          <h1 className="break-words text-2xl font-semibold leading-tight tracking-tight text-foreground lg:text-[30px]">{title}</h1>
          {description && (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
