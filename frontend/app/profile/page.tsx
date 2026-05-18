"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError, profileApi } from "@/lib/api";
import type { LearningProfile } from "@/lib/types";

const DEFAULT_PROFILE: Omit<
  LearningProfile,
  "id" | "user_id" | "created_at" | "updated_at"
> = {
  display_name: "",
  learning_style: "",
  preferred_language: "en",
  daily_minutes_default: 30,
  weekly_goal: "",
  focus_areas: [],
};

function ProfileInner() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [focusInput, setFocusInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    profileApi
      .get()
      .then((res) => {
        if (!mounted) return;
        setProfile({
          display_name: res.data.display_name || "",
          learning_style: res.data.learning_style || "",
          preferred_language: res.data.preferred_language || "en",
          daily_minutes_default: res.data.daily_minutes_default ?? 30,
          weekly_goal: res.data.weekly_goal || "",
          focus_areas: res.data.focus_areas || [],
        });
        setFocusInput((res.data.focus_areas || []).join(", "));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Couldn't load your learning profile"
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const focusAreas = focusInput
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12);

      const res = await profileApi.update({
        ...profile,
        daily_minutes_default: profile.daily_minutes_default || null,
        focus_areas: focusAreas,
      });

      setProfile({
        display_name: res.data.display_name || "",
        learning_style: res.data.learning_style || "",
        preferred_language: res.data.preferred_language || "en",
        daily_minutes_default: res.data.daily_minutes_default ?? 30,
        weekly_goal: res.data.weekly_goal || "",
        focus_areas: res.data.focus_areas || [],
      });
      setFocusInput((res.data.focus_areas || []).join(", "));
      setMessage("Learning profile saved.");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't save your learning profile"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="h-8 w-48 bg-surface rounded animate-pulse mb-4" />
        <div className="h-80 bg-surface rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <p className="text-[11px] font-semibold uppercase tracking-[1px] text-primary mb-3">
        Account profile
      </p>
      <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3 text-charcoal">
        Your learning profile
      </h1>
      <p className="text-slate mb-8 leading-relaxed">
        These preferences personalize plans, coaching, and review prompts for
        this account.
      </p>

      <form
        onSubmit={onSubmit}
        className="bg-canvas border border-hairline rounded-xl p-7 space-y-6"
      >
        {error && (
          <div className="bg-tint-rose border border-error/20 text-error text-[13px] rounded-md px-3 py-2">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-tint-mint border border-brand-green/20 text-brand-green text-[13px] rounded-md px-3 py-2">
            {message}
          </div>
        )}

        <Input
          label="Display name"
          value={profile.display_name}
          onChange={(event) =>
            setProfile((prev) => ({ ...prev, display_name: event.target.value }))
          }
          maxLength={120}
          placeholder="How LearnMate should address you"
        />

        <div className="grid md:grid-cols-2 gap-4">
          <Input
            label="Learning style"
            value={profile.learning_style}
            onChange={(event) =>
              setProfile((prev) => ({
                ...prev,
                learning_style: event.target.value,
              }))
            }
            maxLength={120}
            placeholder="Visual, hands-on, example-first"
          />
          <Input
            label="Preferred language"
            value={profile.preferred_language}
            onChange={(event) =>
              setProfile((prev) => ({
                ...prev,
                preferred_language: event.target.value,
              }))
            }
            maxLength={40}
            placeholder="en"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Input
            label="Default daily minutes"
            type="number"
            min={5}
            max={480}
            value={profile.daily_minutes_default ?? ""}
            onChange={(event) =>
              setProfile((prev) => ({
                ...prev,
                daily_minutes_default: event.target.value
                  ? Number(event.target.value)
                  : null,
              }))
            }
          />
          <Input
            label="Weekly goal"
            value={profile.weekly_goal}
            onChange={(event) =>
              setProfile((prev) => ({ ...prev, weekly_goal: event.target.value }))
            }
            maxLength={240}
            placeholder="Finish 4 study sessions per week"
          />
        </div>

        <Textarea
          label="Focus areas"
          rows={3}
          value={focusInput}
          onChange={(event) => setFocusInput(event.target.value)}
          placeholder="projects, interview prep, fundamentals"
          hint="Separate focus areas with commas."
        />

        <Button type="submit" loading={saving}>
          Save profile
        </Button>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <AuthGuard>
          <ProfileInner />
        </AuthGuard>
      </main>
    </>
  );
}
