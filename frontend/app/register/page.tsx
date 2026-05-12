"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, PasswordInput } from "@/components/ui/input";
import { Turnstile } from "@/components/turnstile";
import { AuthShell } from "@/components/auth-shell";
import { useAuth } from "@/components/auth-context";
import { authApi, ApiError } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!turnstileToken) {
      setError("Please complete the verification.");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.register({
        email,
        password,
        name: name || undefined,
        turnstile_token: turnstileToken,
      });
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
    <AuthShell
      title="Create your account"
      subtitle="Free forever — takes 30 seconds."
    >
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
          type="text"
          name="name"
          label="Name (optional)"
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={100}
        />
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
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          minLength={8}
          hint="Use 8+ characters with a mix of letters and numbers."
        />
        <div className="pt-1">
          <Turnstile onToken={setTurnstileToken} />
        </div>
        <Button type="submit" loading={submitting} className="w-full">
          Create account
        </Button>
        <p className="text-center text-[13px] text-slate">
          Already have one?{" "}
          <Link
            href="/login"
            className="text-link font-medium hover:text-link-pressed"
          >
            Log in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
