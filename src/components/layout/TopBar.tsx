interface TopBarProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function TopBar({ title, description, actions }: TopBarProps) {
  return (
    <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 className="text-base font-semibold text-slate-900">{title}</h1>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
