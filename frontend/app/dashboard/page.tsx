"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Nav } from "@/components/nav";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/components/auth-context";
import { agentApi, planApi, profileApi, ApiError } from "@/lib/api";
import type { CoachAgentResponse, LearningProfile, SavedPlan } from "@/lib/types";

function computeProgress(plan: SavedPlan) {
  const total = plan.plan.duration_days;
  const completedDays = plan.tasks
    ? new Set(
        plan.tasks
          .filter((t) => t.completed)
          .map((t) => t.day)
          .filter((day) => {
            const tasksForDay = plan.tasks!.filter((t) => t.day === day);
            return tasksForDay.every((t) => t.completed);
          })
      ).size
    : 0;

  const today = Math.min(completedDays + 1, total);
  const totalTasks = plan.tasks?.length ?? 0;
  const completedTasks = plan.tasks?.filter((t) => t.completed).length ?? 0;
  const percent = total > 0 ? Math.round((completedDays / total) * 100) : 0;

  return { completedDays, today, totalTasks, completedTasks, percent };
}

function finishByDate(plan: SavedPlan, completedDays: number) {
  const remaining = plan.plan.duration_days - completedDays;
  const date = new Date();
  date.setDate(date.getDate() + remaining);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatShortDate(value?: string | null) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function computeStudyInsights(plan: SavedPlan, today: number) {
  const completedDates = new Set(
    (plan.tasks ?? [])
      .map((task) => task.completed_at)
      .filter((value): value is string => Boolean(value))
      .map(dateKey)
  );
  let streak = 0;
  const cursor = new Date();

  while (completedDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const latestTaskDate = (plan.tasks ?? [])
    .map((task) => task.completed_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const stuckDay = plan.plan.days.find((day) => day.day === today);

  return {
    streak,
    lastStudiedAt: plan.last_studied_at || latestTaskDate || null,
    stuckLabel: stuckDay ? `Day ${stuckDay.day}` : "Done",
    stuckTitle: stuckDay?.title || "Plan complete",
  };
}

function DashboardInner() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<SavedPlan | null>(null);
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachResponse, setCoachResponse] =
    useState<CoachAgentResponse | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([planApi.active(), profileApi.get()])
      .then(([planRes, profileRes]) => {
        if (!mounted) return;
        setPlan(planRes.data ?? null);
        setProfile(profileRes.data);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(
          err instanceof ApiError ? err.message : "Failed to load your plan"
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="h-8 w-48 bg-surface rounded animate-pulse mb-4" />
        <div className="h-40 bg-surface rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="bg-tint-rose border border-error/20 text-error rounded-md p-4">
          {error}
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="text-6xl mb-6">📚</div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3 text-charcoal">
          Ready to learn something new?
        </h1>
        <p className="text-slate mb-8 max-w-md mx-auto leading-relaxed">
          You don&rsquo;t have a plan yet. Tell us what you want to learn —
          we&rsquo;ll build the path.
        </p>
        <Link
          href="/plans/new"
          className="inline-flex items-center justify-center h-12 px-6 rounded-md bg-primary text-on-primary font-medium hover:bg-primary-pressed transition-colors"
        >
          Create your first plan →
        </Link>
      </div>
    );
  }

  const progress = computeProgress(plan);
  const todayDay = plan.plan.days.find((d) => d.day === progress.today);
  const insights = computeStudyInsights(plan, progress.today);

  async function askCoach() {
    setCoachLoading(true);
    setCoachError(null);

    try {
      const response = await agentApi.coach(coachQuestion);
      setCoachResponse(response.data);
    } catch (err) {
      setCoachError(
        err instanceof ApiError
          ? err.message
          : "The coach agent could not respond"
      );
    } finally {
      setCoachLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p className="text-slate text-[14px] mb-2">
          Welcome back, {profile?.display_name || user?.name || "learner"}
        </p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-charcoal">
          Let&rsquo;s keep going.
        </h1>
      </div>

      <div className="bg-canvas border border-hairline rounded-xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[1px] text-steel mb-1">
            Your learning profile
          </p>
          <p className="text-[14px] text-charcoal">
            {profile?.learning_style || "Style not set"} ·{" "}
            {profile?.preferred_language || "Language not set"} ·{" "}
            {profile?.daily_minutes_default
              ? `${profile.daily_minutes_default} min default`
              : "No time default"}
          </p>
          {profile?.focus_areas?.length ? (
            <p className="text-[13px] text-steel mt-1">
              Focus: {profile.focus_areas.join(", ")}
            </p>
          ) : null}
        </div>
        <Link
          href="/profile"
          className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-hairline-strong text-[13px] font-medium text-charcoal hover:bg-surface"
        >
          Edit profile
        </Link>
      </div>

      {/* Today's card — purple primary */}
      <div className="bg-primary text-on-primary rounded-xl p-8 md:p-10 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-brand-purple opacity-30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-brand-pink opacity-20 rounded-full blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-on-primary/15 text-on-primary text-[11px] font-semibold uppercase tracking-[1px] rounded-full px-3 py-1 mb-4">
            Today · Day {progress.today} of {plan.plan.duration_days}
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold mb-3 tracking-tight">
            {todayDay?.title || "All wrapped up"}
          </h2>
          <p className="text-on-primary/80 mb-6 max-w-lg">
            {todayDay
              ? `${todayDay.tasks.length} task${todayDay.tasks.length === 1 ? "" : "s"} today, around ${plan.plan.daily_minutes} minutes.`
              : "You finished the entire plan. Time for the next thing!"}
          </p>
          {todayDay && (
            <Link
              href={`/plans/${plan.id}/day/${progress.today}`}
              className="inline-flex items-center h-11 px-[18px] rounded-md bg-on-dark text-charcoal font-medium hover:bg-tint-gray transition-colors text-[14px]"
            >
              Continue learning →
            </Link>
          )}
        </div>
      </div>

      <div className="bg-canvas border border-hairline rounded-xl p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
          <div>
            <div className="inline-flex items-center gap-2 bg-tint-mint text-brand-green text-[11px] font-semibold uppercase tracking-[1px] rounded-full px-3 py-1 mb-3">
              AI Coach
            </div>
            <h3 className="text-2xl font-semibold text-charcoal">
              Ask about your next study move
            </h3>
          </div>
          {coachResponse && (
            <div className="text-[12px] text-steel bg-surface rounded-md px-3 py-2">
              {coachResponse.agent.context_source === "mongodb_mcp_server"
                ? "MongoDB MCP"
                : "MongoDB"}{" "}
              · {coachResponse.agent.model}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <textarea
            value={coachQuestion}
            onChange={(event) => setCoachQuestion(event.target.value)}
            className="min-h-24 w-full resize-none rounded-md border border-hairline bg-surface-soft px-4 py-3 text-[14px] text-charcoal outline-none focus:border-primary"
            maxLength={500}
            placeholder="What should I focus on today?"
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={askCoach}
              disabled={coachLoading}
              className="inline-flex h-11 items-center justify-center rounded-md bg-charcoal px-5 text-[14px] font-medium text-on-dark transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {coachLoading ? "Thinking..." : "Ask coach"}
            </button>
            {coachError && (
              <p className="text-[13px] text-error">{coachError}</p>
            )}
          </div>
        </div>

        {coachResponse && (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-4">
            <div className="bg-surface-soft border border-hairline-soft rounded-lg p-5">
              <p className="text-[12px] font-semibold uppercase tracking-[1px] text-steel mb-2">
                Recommendation
              </p>
              <p className="text-charcoal font-medium leading-relaxed mb-3">
                {coachResponse.coach.recommendation}
              </p>
              <p className="text-[14px] text-slate leading-relaxed">
                {coachResponse.coach.summary}
              </p>
              {coachResponse.coach.question_answer && (
                <p className="text-[14px] text-slate leading-relaxed mt-3">
                  {coachResponse.coach.question_answer}
                </p>
              )}
            </div>
            <div className="bg-tint-yellow rounded-lg p-5">
              <p className="text-[12px] font-semibold uppercase tracking-[1px] text-charcoal/70 mb-3">
                Next actions
              </p>
              <ul className="space-y-2">
                {coachResponse.coach.next_actions.map((action) => (
                  <li
                    key={action}
                    className="text-[14px] text-charcoal leading-relaxed"
                  >
                    {action}
                  </li>
                ))}
              </ul>
              <p className="text-[13px] text-charcoal/75 mt-4 leading-relaxed">
                {coachResponse.coach.motivation}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Progress strip + day grid */}
      <div className="bg-canvas border border-hairline rounded-xl p-6 mb-6">
        <div className="flex justify-between items-baseline mb-3">
          <h3 className="font-semibold text-charcoal">Your progress</h3>
          <span className="text-[13px] text-steel">
            {progress.completedDays} of {plan.plan.duration_days} days
          </span>
        </div>
        <div className="h-1.5 bg-surface rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {plan.plan.days.map((d) => {
            const isCompleted = d.day <= progress.completedDays;
            const isToday = d.day === progress.today;
            return (
              <Link
                key={d.day}
                href={`/plans/${plan.id}/day/${d.day}`}
                className={`w-9 h-9 rounded-md flex items-center justify-center text-[12px] font-semibold transition-colors ${
                  isCompleted
                    ? "bg-tint-mint text-brand-green hover:opacity-80"
                    : isToday
                      ? "bg-primary text-on-primary ring-2 ring-tint-lavender"
                      : "bg-surface text-stone hover:bg-tint-gray"
                }`}
                title={d.title}
              >
                {isCompleted ? "✓" : d.day}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Pastel stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-tint-mint rounded-xl p-6">
          <div className="text-3xl font-semibold text-charcoal mb-1">
            {progress.completedTasks}
          </div>
          <div className="text-[12px] font-semibold uppercase tracking-[1px] text-charcoal/70">
            Tasks done
          </div>
        </div>
        <div className="bg-tint-lavender rounded-xl p-6">
          <div className="text-3xl font-semibold text-charcoal mb-1">
            {progress.completedDays}
          </div>
          <div className="text-[12px] font-semibold uppercase tracking-[1px] text-charcoal/70">
            Days finished
          </div>
        </div>
        <div className="bg-tint-peach rounded-xl p-6">
          <div className="text-3xl font-semibold text-charcoal mb-1">
            {finishByDate(plan, progress.completedDays)}
          </div>
          <div className="text-[12px] font-semibold uppercase tracking-[1px] text-charcoal/70">
            Finish line
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <div className="bg-tint-yellow rounded-xl p-6">
          <div className="text-3xl font-semibold text-charcoal mb-1">
            {insights.streak}
          </div>
          <div className="text-[12px] font-semibold uppercase tracking-[1px] text-charcoal/70">
            Day streak
          </div>
        </div>
        <div className="bg-tint-sky rounded-xl p-6">
          <div className="text-3xl font-semibold text-charcoal mb-1">
            {formatShortDate(insights.lastStudiedAt)}
          </div>
          <div className="text-[12px] font-semibold uppercase tracking-[1px] text-charcoal/70">
            Last studied
          </div>
        </div>
        <div className="bg-tint-rose rounded-xl p-6">
          <div className="text-3xl font-semibold text-charcoal mb-1">
            {insights.stuckLabel}
          </div>
          <div
            className="text-[12px] font-semibold uppercase tracking-[1px] text-charcoal/70 truncate"
            title={insights.stuckTitle}
          >
            Current focus
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <AuthGuard>
          <DashboardInner />
        </AuthGuard>
      </main>
    </>
  );
}
