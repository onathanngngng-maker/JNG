"use client";

import { FormEvent, useState } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";

type Props = {
  nextPath: string;
};

export function PasswordForm({ nextPath }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError("Wrong password.");
        setPending(false);
        return;
      }
      window.location.assign(nextPath);
    } catch {
      setError("Could not check the password. Try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none ring-blue-600 focus:ring-2"
        />
      </label>
      <ErrorMessage message={error} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex rounded-full bg-blue-700 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {pending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
