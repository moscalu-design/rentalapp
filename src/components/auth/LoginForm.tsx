"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "@/actions/auth";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [values, setValues] = useState({ email: "", password: "", totpCode: "" });

  return (
    <form action={formAction} aria-busy={pending} className="space-y-5">
      {state.error && (
        <p role="alert" className="rounded-lg bg-destructive/5 px-3 py-3 text-sm leading-relaxed text-destructive">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rental-input"
          placeholder="you@example.com"
          value={values.email}
          onChange={(event) => setValues({ ...values, email: event.target.value })}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rental-input"
          value={values.password}
          onChange={(event) => setValues({ ...values, password: event.target.value })}
        />
      </div>
      <div>
        <label htmlFor="totpCode" className="mb-1.5 block text-sm font-medium text-foreground">Two-factor code</label>
        <input
          id="totpCode"
          name="totpCode"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-describedby="totp-hint"
          className="rental-input tabular-nums"
          value={values.totpCode}
          onChange={(event) => setValues({ ...values, totpCode: event.target.value })}
        />
        <p id="totp-hint" className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Enter the code from your authenticator if two-factor authentication is enabled.
        </p>
      </div>
      <button type="submit" disabled={pending} className="rental-button-primary w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
