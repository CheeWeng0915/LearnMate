"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { Nav } from "@/components/nav";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { agentApi, ApiError, planApi, resourceApi, taskApi } from "@/lib/api";
import type {
  LearningDay,
  LearningReview,
  SavedPlan,
  SavedTask,
  YouTubeVideo,
} from "@/lib/types";

type Props = {
  params: Promise<{ planId: string; dayNumber: string }>;
};

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function DayInner({
  planId,
  dayNumber,
}: {
  planId: string;
  dayNumber: number;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<SavedPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [completingResource, setCompletingResource] = useState<string | null>(
    null
  );
  const [note, setNote] = useState("");
  const [noteSavedAt, setNoteSavedAt] = useState<string | null>(null);
  const [noteLoading, setNoteLoading] = useState(true);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finishMessage, setFinishMessage] = useState<string | null>(null);
  const [finishingDay, setFinishingDay] = useState(false);
  const [review, setReview] = useState<LearningReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewGenerating, setReviewGenerating] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    planApi
      .active()
      .then((res) => {
        if (!mounted) return;
        if (!res.data || res.data.id !== planId) {
          setError("Couldn't find this plan.");
        } else {
          setPlan(res.data);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load plan"
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [planId]);

  useEffect(() => {
    let mounted = true;

    planApi
      .dayNote(planId, dayNumber)
      .then((res) => {
        if (!mounted) return;
        setNote(res.data.note || "");
        setNoteSavedAt(res.data.updated_at || null);
      })
      .catch((err) => {
        if (!mounted) return;
        setNoteError(
          err instanceof ApiError ? err.message : "Couldn't load your note"
        );
      })
      .finally(() => {
        if (mounted) setNoteLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [planId, dayNumber]);

  useEffect(() => {
    let mounted = true;

    agentApi
      .latestReview(planId, dayNumber)
      .then((res) => {
        if (mounted) setReview(res.data ?? null);
      })
      .catch((err) => {
        if (!mounted) return;
        setReviewError(
          err instanceof ApiError ? err.message : "Couldn't load the review"
        );
      })
      .finally(() => {
        if (mounted) setReviewLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [planId, dayNumber]);

  useEffect(() => {
    if (!timerRunning) return;

    const interval = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timerRunning]);

  const dayData: LearningDay | undefined = plan?.plan.days.find(
    (d) => d.day === dayNumber
  );
  const dayTasks: SavedTask[] =
    plan?.tasks?.filter((t) => t.day === dayNumber) ?? [];
  const dayVideos: YouTubeVideo[] =
    plan?.resources_by_day?.[String(dayNumber)] ?? [];

  const completedCount = dayTasks.filter((t) => t.completed).length;
  const totalCount = dayTasks.length;
  const completedVideos = dayVideos.filter((v) => v.completed).length;
  const allDone = totalCount > 0 && completedCount === totalCount;
  const taskPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const noteTimestamp = useMemo(() => {
    if (!noteSavedAt) return null;
    return new Date(noteSavedAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [noteSavedAt]);

  const onToggleTask = async (taskId: string) => {
    setCompleting(taskId);
    try {
      await taskApi.complete(taskId);
      const completedAt = new Date().toISOString();
      setPlan((prev) =>
        prev
          ? {
              ...prev,
              last_studied_at: completedAt,
              tasks: prev.tasks?.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      completed: true,
                      completed_at: completedAt,
                    }
                  : t
              ),
            }
          : prev
      );
    } catch (err) {
      console.error("Complete task failed:", err);
    } finally {
      setCompleting(null);
    }
  };

  const onCompleteResource = async (video: YouTubeVideo) => {
    if (!video.id || video.completed) return;

    setCompletingResource(video.id);
    try {
      const res = await resourceApi.complete(video.id);
      const completedAt = res.data.completed_at;
      setPlan((prev) => {
        if (!prev?.resources_by_day) return prev;
        const key = String(dayNumber);
        return {
          ...prev,
          last_studied_at: completedAt,
          resources_by_day: {
            ...prev.resources_by_day,
            [key]: (prev.resources_by_day[key] || []).map((item) =>
              item.id === video.id
                ? { ...item, completed: true, completed_at: completedAt }
                : item
            ),
          },
        };
      });
    } catch (err) {
      console.error("Complete resource failed:", err);
    } finally {
      setCompletingResource(null);
    }
  };

  const onSaveNote = async () => {
    setNoteSaving(true);
    setNoteError(null);
    try {
      const res = await planApi.saveDayNote(planId, dayNumber, note);
      setNoteSavedAt(res.data.updated_at || new Date().toISOString());
    } catch (err) {
      setNoteError(
        err instanceof ApiError ? err.message : "Couldn't save your note"
      );
    } finally {
      setNoteSaving(false);
    }
  };

  const onCompleteDay = async () => {
    if (!allDone) return;

    setFinishingDay(true);
    setFinishMessage(null);
    try {
      const res = await planApi.completeDay(planId, dayNumber);
      setTimerRunning(false);
      setFinishMessage(
        res.data.is_plan_completed
          ? "Plan complete. Nice work finishing the whole thing."
          : "Day complete. Your progress is saved."
      );
      setPlan((prev) =>
        prev
          ? {
              ...prev,
              last_studied_at: res.data.completed_at,
            }
          : prev
      );
    } catch (err) {
      setFinishMessage(
        err instanceof ApiError ? err.message : "Couldn't finish this day"
      );
    } finally {
      setFinishingDay(false);
    }
  };

  const onGenerateReview = async () => {
    setReviewGenerating(true);
    setReviewError(null);

    try {
      const res = await agentApi.review(planId, dayNumber);
      setReview(res.data);
    } catch (err) {
      setReviewError(
        err instanceof ApiError ? err.message : "Couldn't generate a review"
      );
    } finally {
      setReviewGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="h-8 w-32 bg-surface rounded animate-pulse mb-3" />
        <div className="h-10 w-2/3 bg-surface rounded animate-pulse mb-4" />
        <div className="h-32 bg-surface rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !plan || !dayData) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-tint-rose border border-error/20 text-error rounded-md p-4 mb-4">
          {error || "Day not found"}
        </div>
        <Link
          href="/dashboard"
          className="text-link hover:text-link-pressed text-[13px]"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const prevDay = dayNumber > 1 ? dayNumber - 1 : null;
  const nextDay =
    dayNumber < plan.plan.duration_days ? dayNumber + 1 : null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link
        href="/dashboard"
        className="text-steel hover:text-charcoal text-[13px] inline-flex items-center gap-1 mb-8 font-medium"
      >
        ← Dashboard
      </Link>

      <div className="text-[11px] font-semibold uppercase tracking-[1px] text-primary mb-3">
        Day {dayNumber} of {plan.plan.duration_days}
      </div>
      <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3 text-charcoal">
        {dayData.title}
      </h1>
      <p className="text-slate mb-8">
        {totalCount > 0
          ? `${completedCount} of ${totalCount} tasks done.`
          : `${dayData.tasks.length} task${dayData.tasks.length === 1 ? "" : "s"} for today.`}
      </p>

      <section className="bg-primary text-on-primary rounded-xl p-6 mb-10 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-pink opacity-20 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[1px] text-on-primary/70 mb-1">
                Today workspace
              </div>
              <div className="text-2xl font-semibold">
                {taskPercent}% complete
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTimerRunning((value) => !value)}
              className="inline-flex items-center justify-center h-11 px-4 rounded-md bg-on-dark text-charcoal hover:bg-tint-gray text-[14px] font-medium transition-colors"
            >
              {timerRunning ? "Pause timer" : "Start learning"}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-charcoal">
            <StatusTile label="Tasks" value={`${completedCount}/${totalCount}`} />
            <StatusTile label="Videos" value={`${completedVideos}/${dayVideos.length}`} />
            <StatusTile
              label="Timer"
              value={formatElapsed(elapsedSeconds)}
            />
          </div>
          <div className="h-1.5 bg-on-primary/20 rounded-full overflow-hidden mt-5">
            <div
              className="h-full bg-brand-yellow rounded-full transition-all"
              style={{ width: `${taskPercent}%` }}
            />
          </div>
          <p className="text-on-primary/75 text-[13px] mt-3">
            Planned time: around {plan.plan.daily_minutes} minutes today.
          </p>
        </div>
      </section>

      <div className="mb-10">
        <h2 className="text-[18px] font-semibold mb-4 text-charcoal">
          What to do today
        </h2>
        <div className="space-y-2">
          {dayTasks.length > 0
            ? dayTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onComplete={() => onToggleTask(task.id)}
                  loading={completing === task.id}
                />
              ))
            : dayData.tasks.map((t, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-4 bg-canvas border border-hairline rounded-md"
                >
                  <div className="mt-0.5 w-5 h-5 rounded border-2 border-hairline-strong shrink-0" />
                  <div className="flex-1 text-[14px] text-charcoal">{t}</div>
                </div>
              ))}
        </div>
      </div>

      {dayVideos.length > 0 && (
        <div className="mb-10">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 className="text-[18px] font-semibold text-charcoal">
              Videos for this day
            </h2>
            <span className="text-[12px] text-steel">
              {completedVideos} watched
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {dayVideos.map((v) => (
              <VideoCard
                key={v.id || v.video_id}
                video={v}
                loading={completingResource === v.id}
                onComplete={() => onCompleteResource(v)}
              />
            ))}
          </div>
        </div>
      )}

      <section className="bg-canvas border border-hairline rounded-xl p-5 mb-10">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-[18px] font-semibold text-charcoal">
            Learning notes
          </h2>
          {noteTimestamp && (
            <span className="text-[12px] text-steel">Saved {noteTimestamp}</span>
          )}
        </div>
        {noteError && (
          <div className="bg-tint-rose border border-error/20 text-error text-[13px] rounded-md px-3 py-2 mb-3">
            {noteError}
          </div>
        )}
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={noteLoading}
          rows={5}
          maxLength={5000}
          placeholder="What did you learn today? What still feels unclear?"
          className="w-full resize-none rounded-md border border-hairline-strong bg-canvas px-4 py-3 text-[14px] text-charcoal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-surface"
        />
        <div className="flex justify-between items-center gap-3 mt-3">
          <span className="text-[12px] text-steel">
            {note.length}/5000 characters
          </span>
          <Button
            type="button"
            size="sm"
            onClick={onSaveNote}
            loading={noteSaving}
            disabled={noteLoading}
          >
            Save note
          </Button>
        </div>
      </section>

      <section className="bg-canvas border border-hairline rounded-xl p-5 mb-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[1px] text-primary mb-1">
              Smart Review
            </p>
            <h2 className="text-[18px] font-semibold text-charcoal">
              Review quiz for today
            </h2>
          </div>
          <Button
            type="button"
            size="sm"
            variant="dark"
            onClick={onGenerateReview}
            loading={reviewGenerating}
            disabled={reviewLoading}
          >
            {review ? "Regenerate review" : "Generate review"}
          </Button>
        </div>

        {reviewError && (
          <div className="bg-tint-rose border border-error/20 text-error text-[13px] rounded-md px-3 py-2 mb-3">
            {reviewError}
          </div>
        )}

        {reviewLoading ? (
          <div className="space-y-2">
            <div className="h-4 bg-surface rounded animate-pulse" />
            <div className="h-4 bg-surface rounded animate-pulse w-3/4" />
          </div>
        ) : review ? (
          <div className="space-y-4">
            <p className="text-[14px] text-slate leading-relaxed">
              {review.summary}
            </p>
            <div className="space-y-3">
              {review.questions.map((question, index) => (
                <div
                  key={`${question}-${index}`}
                  className="bg-surface-soft border border-hairline-soft rounded-md p-4"
                >
                  <p className="text-[13px] font-semibold text-charcoal mb-2">
                    {index + 1}. {question}
                  </p>
                  <p className="text-[13px] text-steel leading-relaxed">
                    {review.answer_key[index]}
                  </p>
                </div>
              ))}
            </div>
            <div className="bg-tint-yellow rounded-md p-4 text-[13px] text-charcoal leading-relaxed">
              {review.recommended_review_action}
            </div>
          </div>
        ) : (
          <p className="text-[14px] text-steel leading-relaxed">
            Generate a short quiz from your tasks, notes, and watched resources
            for this day.
          </p>
        )}
      </section>

      {finishMessage && (
        <div className="bg-tint-mint border border-brand-green/20 text-brand-green rounded-md p-4 mb-6 text-[14px] font-medium">
          {finishMessage}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mt-12 border-t border-hairline pt-6">
        {prevDay && (
          <Link
            href={`/plans/${planId}/day/${prevDay}`}
            className="inline-flex items-center justify-center h-11 px-4 rounded-md bg-canvas border border-hairline-strong text-charcoal hover:bg-surface text-[14px] font-medium"
          >
            ← Day {prevDay}
          </Link>
        )}
        <div className="flex-1" />
        {finishMessage && nextDay ? (
          <Button onClick={() => router.push(`/plans/${planId}/day/${nextDay}`)}>
            Day {nextDay} →
          </Button>
        ) : finishMessage ? (
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center h-11 px-4 rounded-md bg-primary text-on-primary hover:bg-primary-pressed text-[14px] font-medium"
          >
            Back to dashboard
          </Link>
        ) : allDone ? (
          <Button onClick={onCompleteDay} loading={finishingDay}>
            Complete today
          </Button>
        ) : nextDay ? (
          <Link
            href={`/plans/${planId}/day/${nextDay}`}
            className="inline-flex items-center justify-center h-11 px-4 rounded-md bg-canvas border border-hairline-strong text-charcoal hover:bg-surface text-[14px] font-medium"
          >
            Skip to Day {nextDay} →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-on-primary/90 rounded-md px-3 py-2 min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-[1px] text-charcoal/60 truncate">
        {label}
      </div>
      <div className="text-[16px] font-semibold text-charcoal truncate">
        {value}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onComplete,
  loading,
}: {
  task: SavedTask;
  onComplete: () => void;
  loading: boolean;
}) {
  const isCompleted = task.completed;
  return (
    <button
      type="button"
      onClick={!isCompleted ? onComplete : undefined}
      disabled={isCompleted || loading}
      className={`w-full text-left flex items-start gap-3 p-4 bg-canvas border rounded-md transition-colors ${
        isCompleted
          ? "border-hairline-soft opacity-60"
          : "border-hairline hover:border-primary/40 cursor-pointer"
      }`}
    >
      <CheckBox checked={isCompleted} />
      <div className="flex-1">
        <div
          className={`text-[14px] ${
            isCompleted ? "line-through text-stone" : "text-charcoal"
          }`}
        >
          {loading ? "Saving..." : task.description}
        </div>
      </div>
    </button>
  );
}

function VideoCard({
  video,
  loading,
  onComplete,
}: {
  video: YouTubeVideo;
  loading: boolean;
  onComplete: () => void;
}) {
  const isCompleted = video.completed;

  return (
    <div
      className={`bg-canvas border rounded-md overflow-hidden transition-shadow ${
        isCompleted ? "border-hairline-soft opacity-70" : "border-hairline"
      }`}
    >
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block hover:shadow-md transition-shadow"
      >
        <div className="aspect-video bg-surface relative">
          {video.thumbnail_url ? (
            <Image
              src={video.thumbnail_url}
              alt={video.title}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-5xl">
              ▶
            </div>
          )}
        </div>
        <div className="p-3 pb-2">
          <div className="font-medium text-[13px] line-clamp-2 mb-1 text-charcoal">
            {video.title}
          </div>
          <div className="text-[12px] text-steel truncate">
            {video.channel_title}
          </div>
        </div>
      </a>
      <button
        type="button"
        onClick={onComplete}
        disabled={isCompleted || loading || !video.id}
        className="w-full border-t border-hairline-soft px-3 py-2 flex items-center gap-2 text-left text-[13px] text-charcoal hover:bg-surface disabled:hover:bg-canvas disabled:cursor-default"
      >
        <CheckBox checked={Boolean(isCompleted)} />
        <span>
          {isCompleted ? "Watched" : loading ? "Saving..." : "Mark watched"}
        </span>
      </button>
    </div>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <div
      className={`mt-0.5 w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center ${
        checked
          ? "bg-primary border-primary text-on-primary"
          : "border-hairline-strong"
      }`}
    >
      {checked && (
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6l3 3 5-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

export default function DayPage({ params }: Props) {
  const { planId, dayNumber } = use(params);
  const dayNum = Number(dayNumber);

  return (
    <>
      <Nav />
      <main className="flex-1">
        <AuthGuard>
          <DayInner planId={planId} dayNumber={dayNum} />
        </AuthGuard>
      </main>
    </>
  );
}
