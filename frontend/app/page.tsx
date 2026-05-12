"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-context";
import { Nav } from "@/components/nav";

const FEATURES = [
  {
    tint: "bg-tint-peach",
    icon: "🎯",
    title: "Goals, not endless lists",
    body: "Tell us a clear goal — our AI breaks it into a real plan with the right pace.",
  },
  {
    tint: "bg-tint-mint",
    icon: "📺",
    title: "The right videos",
    body: "Hand-picked YouTube content for each day. No bottomless scrolling.",
  },
  {
    tint: "bg-tint-lavender",
    icon: "✓",
    title: "Tick things off",
    body: "Small daily tasks. The kind you can finish before your coffee gets cold.",
  },
  {
    tint: "bg-tint-rose",
    icon: "📊",
    title: "See real progress",
    body: "A simple visual of where you are and how close to the finish line.",
  },
  {
    tint: "bg-tint-sky",
    icon: "🌐",
    title: "Any topic, any pace",
    body: "From SQL to watercolor to Italian grammar. 5 to 180 minutes a day.",
  },
  {
    tint: "bg-tint-yellow",
    icon: "🚀",
    title: "Free to start",
    body: "Make as many plans as you want. No card required to try it out.",
  },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <>
      <Nav />
      <main className="flex-1">
        {/* Navy hero band — Notion signature */}
        <section className="relative bg-brand-navy text-on-dark overflow-hidden">
          {/* Sticky-note dots */}
          <div className="absolute inset-0 opacity-90 pointer-events-none">
            <div className="absolute top-[15%] left-[8%] w-4 h-4 rounded-full bg-brand-pink" />
            <div className="absolute top-[18%] right-[12%] w-3 h-3 rounded-full bg-brand-yellow" />
            <div className="absolute top-[55%] left-[6%] w-2.5 h-2.5 rounded-full bg-brand-teal" />
            <div className="absolute top-[68%] right-[8%] w-3.5 h-3.5 rounded-full bg-brand-orange" />
            <div className="absolute top-[35%] right-[20%] w-2 h-2 rounded-full bg-brand-green" />
            <div className="absolute top-[78%] left-[18%] w-2.5 h-2.5 rounded-full bg-brand-purple" />
          </div>

          <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-32 text-center">
            <div className="inline-flex items-center gap-2 bg-brand-navy-mid border border-on-dark-muted/20 text-on-dark text-[13px] font-medium rounded-full px-3 py-1.5 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
              AI-powered learning paths
            </div>
            <h1 className="text-5xl md:text-7xl font-semibold leading-[1.05] tracking-[-0.02em] mb-6">
              Stop bookmarking videos
              <br />
              <span className="text-brand-yellow">you&rsquo;ll never watch.</span>
            </h1>
            <p className="text-lg md:text-xl text-on-dark-muted max-w-2xl mx-auto mb-10 leading-relaxed">
              LearnMate turns your goal into a small daily plan you can
              actually finish — with the right videos, in the right order.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center h-12 px-6 rounded-md bg-primary text-on-primary font-medium hover:bg-primary-pressed transition-colors"
              >
                Get LearnMate free
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center h-12 px-6 rounded-md bg-on-dark text-charcoal font-medium hover:bg-tint-gray transition-colors"
              >
                I have an account
              </Link>
            </div>
          </div>
        </section>

        {/* Feature cards section */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <p className="text-[11px] font-semibold uppercase tracking-[1px] text-primary mb-3">
              How it works
            </p>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-charcoal mb-4">
              Built for finishers,
              <br />not collectors.
            </h2>
            <p className="text-slate text-[17px] leading-relaxed">
              You&rsquo;ve probably got 12 half-watched playlists right now.
              We do the structuring so you just have to show up.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`${f.tint} rounded-xl p-7 hover:translate-y-[-2px] transition-transform`}
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-[18px] font-semibold text-charcoal mb-2">
                  {f.title}
                </h3>
                <p className="text-[14px] text-charcoal/80 leading-relaxed">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Light CTA banner */}
        <section className="max-w-5xl mx-auto px-6 pb-20">
          <div className="bg-surface rounded-xl p-12 md:p-16 text-center">
            <h2 className="text-3xl md:text-4xl font-semibold text-charcoal mb-3 tracking-tight">
              Pick a goal. We&rsquo;ll do the rest.
            </h2>
            <p className="text-slate mb-8 max-w-md mx-auto">
              Free to start. Takes a minute to set up.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center justify-center h-12 px-6 rounded-md bg-primary text-on-primary font-medium hover:bg-primary-pressed transition-colors"
            >
              Start your first plan →
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
