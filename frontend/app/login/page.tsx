"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, PasswordInput } from "@/components/ui/input";
import { AuthShell } from "@/components/auth-shell";
import { useAuth } from "@/components/auth-context";
import { authApi, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authApi.login({ email, password });
      await refresh();
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to continue your plan.">
      <form
        onSubmit={onSubmit}
        className="bg-canvas p-7 rounded-xl border border-hairline space-y-4"
      >
        {error && (
          <div className="bg-tint-rose border border-error/20 text-error text-[13px] rounded-md px-3 py-2">
            {error}
          </div>
        )}
        <Input
          type="email"
          name="email"
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <PasswordInput
          name="password"
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          minLength={1}
        />
        <Button type="submit" loading={submitting} className="w-full">
          Log in
        </Button>
        <p className="text-center text-[13px] text-slate">
          New to LearnMate?{" "}
          <Link
            href="/register"
            className="text-link font-medium hover:text-link-pressed"
          >
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
