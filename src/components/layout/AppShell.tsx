"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sidebarOpen) return;
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (media.matches) setSidebarOpen(false); };
    const focusable = () => Array.from(drawer.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ?? [])
      .filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setSidebarOpen(false); }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const opener = menuButton.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    media.addEventListener("change", closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      media.removeEventListener("change", closeOnDesktop);
      opener?.focus();
    };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen min-h-[100svh] bg-background text-foreground">
      <a href="#main-content" className="rental-skip-link">Skip to content</a>
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}
      <div
        id="app-navigation"
        ref={drawer}
        role={sidebarOpen ? "dialog" : undefined}
        aria-modal={sidebarOpen || undefined}
        aria-label={sidebarOpen ? "Navigation menu" : undefined}
        className={`fixed inset-y-0 left-0 z-40 shrink-0 lg:sticky lg:top-0 lg:block lg:h-dvh ${sidebarOpen ? "block" : "hidden"}`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col" inert={sidebarOpen || undefined}>
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:hidden">
          <button ref={menuButton} type="button" aria-label="Open menu" aria-expanded={sidebarOpen} aria-controls="app-navigation" onClick={() => setSidebarOpen(true)} className="-ml-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted">
            <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth="1.75" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="text-sm font-semibold tracking-tight">Rental App</span>
        </div>
        <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">{children}</main>
      </div>
    </div>
  );
}
