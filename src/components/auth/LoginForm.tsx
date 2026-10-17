"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "@/actions/auth";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [values, setValues] = useState({ email: "", password: "" });

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
      <button type="submit" disabled={pending} className="rental-button-primary w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
