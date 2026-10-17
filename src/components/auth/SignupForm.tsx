"use client";

import { useActionState, useState } from "react";
import { signupAction, type SignupState } from "@/actions/auth";

const initialState: SignupState = {};
const fields = [
  { name: "name", label: "Name", type: "text", autoComplete: "name" },
  { name: "email", label: "Email address", type: "email", autoComplete: "email" },
  { name: "phone", label: "Phone number", type: "tel", autoComplete: "tel" },
  { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Confirm password", type: "password", autoComplete: "new-password" },
] as const;

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);
  const [values, setValues] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });

  return (
    <form action={formAction} aria-busy={pending} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-lg bg-destructive/5 px-3 py-3 text-sm leading-relaxed text-destructive">
          {state.error}
        </p>
      )}
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-foreground">
            {field.label}
          </label>
          <input
            id={field.name}
            name={field.name}
            type={field.type}
            required
            autoComplete={field.autoComplete}
            minLength={field.type === "password" ? 8 : undefined}
            aria-describedby={field.name === "password" ? "password-hint" : undefined}
            className="rental-input"
            value={values[field.name]}
            onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
          />
          {field.name === "password" && (
            <p id="password-hint" className="mt-2 text-xs text-muted-foreground">Use at least 8 characters.</p>
          )}
        </div>
      ))}
      <button type="submit" disabled={pending} className="rental-button-primary w-full">
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
