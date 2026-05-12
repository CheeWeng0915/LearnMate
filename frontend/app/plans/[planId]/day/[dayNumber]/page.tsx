"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Nav } from "@/components/nav";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { ApiError, planApi, taskApi } from "@/lib/api";
import type { LearningDay, SavedPlan, SavedTask, YouTubeVideo } from "@/lib/types";

type Props = {
  params: Promise<{ planId: string; dayNumber: string }>;
};

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

  const dayData: LearningDay | undefined = plan?.plan.days.find(
    (d) => d.day === dayNumber
  );
  const dayTasks: SavedTask[] =
    plan?.tasks?.filter((t) => t.day === dayNumber) ?? [];
  const dayVideos: YouTubeVideo[] =
    plan?.resources_by_day?.[String(dayNumber)] ?? [];

  const completedCount = dayTasks.filter((t) => t.completed).length;
  const totalCount = dayTasks.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  const onToggleTask = async (taskId: string) => {
    setCompleting(taskId);
    try {
      await taskApi.complete(taskId);
      setPlan((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks?.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      completed: true,
                      completed_at: new Date().toISOString(),
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
    <div className="max-w-2xl mx-auto px-6 py-12">
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
      <p className="text-slate mb-10">
        {totalCount > 0
          ? `${completedCount} of ${totalCount} done.`
          : `${dayData.tasks.length} task${dayData.tasks.length === 1 ? "" : "s"} for today.`}
      </p>

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
          <h2 className="text-[18px] font-semibold mb-4 text-charcoal">
            Videos for this day
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {dayVideos.map((v) => (
              <VideoCard key={v.video_id} video={v} />
            ))}
          </div>
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
        {allDone && nextDay ? (
          <Button onClick={() => router.push(`/plans/${planId}/day/${nextDay}`)}>
            Day {nextDay} →
          </Button>
        ) : nextDay ? (
          <Link
            href={`/plans/${planId}/day/${nextDay}`}
            className="inline-flex items-center justify-center h-11 px-4 rounded-md bg-canvas border border-hairline-strong text-charcoal hover:bg-surface text-[14px] font-medium"
          >
            Skip to Day {nextDay} →
          </Link>
        ) : (
          allDone && (
            <div className="inline-flex items-center h-11 px-5 rounded-md bg-tint-mint text-brand-green font-medium text-[14px]">
              🎉 You finished the entire plan!
            </div>
          )
        )}
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
      <div
        className={`mt-0.5 w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center ${
          isCompleted
            ? "bg-primary border-primary text-on-primary"
            : "border-hairline-strong"
        }`}
      >
        {isCompleted && (
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
      <div className="flex-1">
        <div
          className={`text-[14px] ${
            isCompleted ? "line-through text-stone" : "text-charcoal"
          }`}
        >
          {task.description}
        </div>
      </div>
    </button>
  );
}

function VideoCard({ video }: { video: YouTubeVideo }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-canvas border border-hairline rounded-md overflow-hidden hover:shadow-md transition-shadow"
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
      <div className="p-3">
        <div className="font-medium text-[13px] line-clamp-2 mb-1 text-charcoal">
          {video.title}
        </div>
        <div className="text-[12px] text-steel truncate">
          {video.channel_title}
        </div>
      </div>
    </a>
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
