"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Nav } from "@/components/nav";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { planApi, profileApi, ApiError } from "@/lib/api";

type Level = "beginner" | "intermediate" | "advanced";

const LEVELS: { value: Level; label: string; tint: string }[] = [
  { value: "beginner", label: "Beginner", tint: "bg-tint-mint" },
  { value: "intermediate", label: "Intermediate", tint: "bg-tint-lavender" },
  { value: "advanced", label: "Advanced", tint: "bg-tint-peach" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ms", label: "Bahasa Malaysia" },
  { value: "zh", label: "中文" },
];

function GenerateInner() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState<Level>("beginner");
  const [dailyMinutes, setDailyMinutes] = useState(30);
  const [language, setLanguage] = useState("en");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    profileApi
      .get()
      .then((res) => {
        if (!mounted) return;
        if (res.data.daily_minutes_default) {
          setDailyMinutes(res.data.daily_minutes_default);
        }
        if (res.data.preferred_language) {
          setLanguage(res.data.preferred_language);
        }
      })
      .catch(() => {
        // Profile defaults are optional; plan creation still works without them.
      });

    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (goal.trim().length < 3) {
      setError("Tell us a bit more about your goal.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await planApi.generate({
        goal: goal.trim(),
        level,
        daily_minutes: dailyMinutes,
        language,
      });
      sessionStorage.setItem(
        "learnmate.draft_plan",
        JSON.stringify(res.data)
      );
      router.push("/plans/preview");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't build the plan. Try again?"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="text-[11px] font-semibold uppercase tracking-[1px] text-primary mb-3">
        New plan
      </p>
      <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3 text-charcoal">
        What do you want to learn?
      </h1>
      <p className="text-slate mb-10 leading-relaxed">
        Be specific. &ldquo;Master Excel formulas and build a budget
        tracker&rdquo; works better than &ldquo;learn Excel&rdquo;.
      </p>

      <form
        onSubmit={onSubmit}
        className="bg-canvas p-7 rounded-xl border border-hairline space-y-7"
      >
        {error && (
          <div className="bg-tint-rose border border-error/20 text-error text-[13px] rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <Textarea
          label="Your goal"
          name="goal"
          rows={3}
          placeholder="e.g. Learn Python basics and build a small calculator app"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          maxLength={500}
          required
          minLength={3}
        />

        <div>
          <label className="block text-[13px] font-semibold mb-2.5 text-charcoal">
            Your starting level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLevel(l.value)}
                className={`py-3 px-3 rounded-md text-[13px] font-medium transition-all border ${
                  level === l.value
                    ? `${l.tint} border-charcoal text-charcoal`
                    : "bg-canvas border-hairline-strong text-slate hover:bg-surface"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="dailyMinutes"
            className="block text-[13px] font-semibold mb-2.5 text-charcoal"
          >
            Time per day
          </label>
          <div className="flex items-center gap-4">
            <input
              id="dailyMinutes"
              type="range"
              min={5}
              max={480}
              step={5}
              value={dailyMinutes}
              onChange={(e) => setDailyMinutes(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <div className="bg-tint-lavender text-brand-purple-800 px-4 py-2 rounded-md font-semibold w-24 text-center text-[13px]">
              {dailyMinutes} min
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="language"
            className="block text-[13px] font-semibold mb-2.5 text-charcoal"
          >
            Language
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full h-11 px-4 border border-hairline-strong rounded-md bg-canvas text-charcoal text-[14px] focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          >
            {!LANGUAGES.some((item) => item.value === language) && (
              <option value={language}>{language}</option>
            )}
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" loading={submitting} className="w-full" size="lg">
          {submitting ? "Building your plan…" : "Generate my plan"}
        </Button>
        {submitting && (
          <p className="text-center text-[12px] text-steel">
            This takes about 5–15 seconds.
          </p>
        )}
      </form>
    </div>
  );
}

export default function NewPlanPage() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <AuthGuard>
          <GenerateInner />
        </AuthGuard>
      </main>
    </>
  );
}
