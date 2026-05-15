"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Nav } from "@/components/nav";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { ApiError, planApi, youtubeApi } from "@/lib/api";
import type {
  LearningPlan,
  ResourcesByDay,
  YouTubeVideo,
} from "@/lib/types";

function readDraftPlan() {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.sessionStorage.getItem("learnmate.draft_plan");

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as LearningPlan;
  } catch {
    return null;
  }
}

function PreviewInner() {
  const router = useRouter();
  const [plan] = useState<LearningPlan | null>(() => readDraftPlan());
  const [openDay, setOpenDay] = useState<number | null>(1);
  const [resources, setResources] = useState<ResourcesByDay>({});
  const [loadingDay, setLoadingDay] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plan) {
      router.replace("/plans/new");
    }
  }, [plan, router]);

  const loadVideosForDay = async (day: number) => {
    if (!plan || resources[String(day)] || loadingDay === day) return;
    const dayData = plan.days.find((d) => d.day === day);
    if (!dayData?.search_queries.length) return;

    setLoadingDay(day);
    try {
      const query = dayData.search_queries[0];
      const res = await youtubeApi.search(query, 4);
      setResources((prev) => ({
        ...prev,
        [String(day)]: res.data.videos,
      }));
    } catch (err) {
      console.error("Video search failed:", err);
    } finally {
      setLoadingDay(null);
    }
  };

  const toggleDay = async (day: number) => {
    if (openDay === day) {
      setOpenDay(null);
    } else {
      setOpenDay(day);
      await loadVideosForDay(day);
    }
  };

  useEffect(() => {
    if (plan && plan.days.length > 0) {
      const timeout = window.setTimeout(() => {
        void loadVideosForDay(plan.days[0].day);
      }, 0);

      return () => window.clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const onSave = async () => {
    if (!plan) return;
    setError(null);
    setSaving(true);
    try {
      const res = await planApi.save(plan, resources);
      sessionStorage.removeItem("learnmate.draft_plan");
      router.push(`/plans/${res.data.id}/day/1`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't save the plan"
      );
      setSaving(false);
    }
  };

  if (!plan) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-steel text-[14px]">Loading…</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 pb-32">
      <div className="inline-flex items-center gap-2 bg-tint-lavender text-brand-purple-800 text-[12px] font-semibold rounded-full px-3 py-1 mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        Plan ready
      </div>
      <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3 text-charcoal">
        {plan.topic || plan.goal}
      </h1>
      <div className="flex gap-5 text-[14px] text-slate mb-8 flex-wrap">
        <span>📅 {plan.duration_days} days</span>
        <span>⏱ {plan.daily_minutes} min/day</span>
        <span className="capitalize">🎯 {plan.level}</span>
      </div>

      {plan.learning_outcome && (
        <div className="bg-tint-cream border border-hairline rounded-xl p-5 mb-8">
          <p className="text-charcoal text-[14px] leading-relaxed">
            <span className="font-semibold">By the end:</span>{" "}
            {plan.learning_outcome}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-tint-rose border border-error/20 text-error text-[13px] rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="space-y-2 mb-8">
        {plan.days.map((d) => {
          const isOpen = openDay === d.day;
          const dayVideos = resources[String(d.day)] || [];
          return (
            <div
              key={d.day}
              className="bg-canvas border border-hairline rounded-xl overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleDay(d.day)}
                className={`w-full p-5 flex items-center gap-4 text-left transition-colors ${
                  isOpen ? "bg-surface" : "hover:bg-surface-soft"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-md flex items-center justify-center font-semibold text-[13px] shrink-0 ${
                    isOpen
                      ? "bg-primary text-on-primary"
                      : "bg-surface text-steel"
                  }`}
                >
                  {d.day}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-charcoal truncate">
                    {d.title}
                  </div>
                  <div className="text-[13px] text-steel mt-0.5">
                    {d.tasks.length} task{d.tasks.length === 1 ? "" : "s"}
                    {dayVideos.length > 0 && ` · ${dayVideos.length} videos`}
                  </div>
                </div>
                <span className="text-stone text-sm shrink-0">
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pl-[3.75rem] space-y-5 animate-fade-in border-t border-hairline-soft pt-5">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[1px] text-steel mb-3">
                      Tasks
                    </div>
                    <ul className="space-y-2 text-[14px] text-charcoal">
                      {d.tasks.map((task, i) => (
                        <li key={i} className="flex gap-2.5">
                          <span className="text-primary mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[1px] text-steel mb-3">
                      Suggested videos
                    </div>
                    {loadingDay === d.day ? (
                      <div className="grid grid-cols-2 gap-2">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="aspect-video bg-surface rounded-md animate-pulse"
                          />
                        ))}
                      </div>
                    ) : dayVideos.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {dayVideos.map((v) => (
                          <VideoCard key={v.video_id} video={v} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] text-stone">
                        Videos will load when you save the plan.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 max-w-md sm:max-w-sm ml-auto">
        <div className="bg-canvas p-3 rounded-xl border border-hairline shadow-lg flex gap-2">
          <Button
            variant="secondary"
            onClick={() => router.push("/plans/new")}
            disabled={saving}
            className="flex-1"
          >
            ↻ Try another
          </Button>
          <Button onClick={onSave} loading={saving} className="flex-1">
            Save & Start →
          </Button>
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video }: { video: YouTubeVideo }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block border border-hairline rounded-md overflow-hidden hover:shadow-md transition-shadow bg-canvas"
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
          <div className="absolute inset-0 flex items-center justify-center text-3xl">
            ▶
          </div>
        )}
      </div>
      <div className="p-2">
        <div className="text-[12px] font-medium line-clamp-2 text-charcoal">
          {video.title}
        </div>
        <div className="text-[11px] text-steel mt-0.5 truncate">
          {video.channel_title}
        </div>
      </div>
    </a>
  );
}

export default function PreviewPage() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <AuthGuard>
          <PreviewInner />
        </AuthGuard>
      </main>
    </>
  );
}
