import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-tint-sky via-tint-lavender to-tint-peach relative overflow-hidden flex flex-col">
      {/* Colorful background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-120px] right-[-80px] w-[460px] h-[460px] bg-primary/25 rounded-full blur-3xl" />
        <div className="absolute top-[15%] left-[-100px] w-[380px] h-[380px] bg-tint-lavender opacity-80 rounded-full blur-3xl" />
        <div className="absolute top-[10%] right-[20%] w-[320px] h-[320px] bg-tint-mint opacity-60 rounded-full blur-3xl" />
        <div className="absolute bottom-[-140px] right-[10%] w-[420px] h-[420px] bg-brand-pink/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[5%] left-[15%] w-[340px] h-[340px] bg-tint-peach opacity-70 rounded-full blur-3xl" />
        <div className="absolute top-[40%] right-[-60px] w-[280px] h-[280px] bg-tint-rose opacity-60 rounded-full blur-3xl" />
        <div className="absolute bottom-[30%] left-[50%] w-[240px] h-[240px] bg-tint-yellow opacity-50 rounded-full blur-3xl" />
      </div>

      {/* Decorative dots */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[8%] left-[12%] w-2 h-2 rounded-full bg-brand-pink" />
        <div className="absolute top-[14%] right-[18%] w-2.5 h-2.5 rounded-full bg-brand-yellow" />
        <div className="absolute top-[35%] left-[6%] w-2 h-2 rounded-full bg-brand-teal" />
        <div className="absolute top-[50%] right-[8%] w-3 h-3 rounded-full bg-brand-orange" />
        <div className="absolute bottom-[22%] left-[18%] w-2 h-2 rounded-full bg-brand-green" />
        <div className="absolute bottom-[12%] right-[28%] w-2.5 h-2.5 rounded-full bg-brand-purple" />
        <div className="absolute top-[65%] left-[42%] w-1.5 h-1.5 rounded-full bg-primary" />
        <div className="absolute top-[20%] left-[45%] w-1.5 h-1.5 rounded-full bg-brand-pink" />
        <div className="absolute bottom-[40%] right-[15%] w-2 h-2 rounded-full bg-brand-teal" />
      </div>

      {/* Header with logo */}
      <header className="relative z-10">
        <div className="px-6 py-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-on-primary font-bold text-sm">
              L
            </div>
            <span className="font-semibold text-[15px] text-charcoal">
              LearnMate
            </span>
          </Link>
        </div>
      </header>

      {/* Centered form with floating cards */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="relative w-full max-w-2xl">
          {/* Floating preview card — top right, slightly tilted */}
          <div
            className="hidden lg:block absolute -top-12 -right-16 xl:-right-24 w-56 bg-canvas rounded-xl border border-hairline shadow-xl p-4 rotate-[5deg] z-20"
            aria-hidden
          >
            <div className="text-[10px] font-semibold uppercase tracking-[1px] text-primary mb-1">
              Day 3 · Today
            </div>
            <div className="text-[14px] font-semibold text-charcoal mb-3">
              Python lists & loops
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[12px]">
                <div className="w-3.5 h-3.5 rounded-sm bg-primary text-on-primary flex items-center justify-center text-[8px]">
                  ✓
                </div>
                <span className="line-through text-stone">
                  Watch list basics
                </span>
              </div>
              <div className="flex items-center gap-2 text-[12px]">
                <div className="w-3.5 h-3.5 rounded-sm bg-primary text-on-primary flex items-center justify-center text-[8px]">
                  ✓
                </div>
                <span className="line-through text-stone">
                  Try a for loop
                </span>
              </div>
              <div className="flex items-center gap-2 text-[12px]">
                <div className="w-3.5 h-3.5 rounded-sm border-2 border-hairline-strong" />
                <span className="text-charcoal">Build mini quiz</span>
              </div>
            </div>
          </div>

          {/* Floating progress card — bottom left */}
          <div
            className="hidden lg:block absolute -bottom-10 -left-14 xl:-left-20 bg-canvas rounded-xl border border-hairline shadow-xl p-4 -rotate-[4deg] z-20"
            aria-hidden
          >
            <div className="text-[10px] font-semibold uppercase tracking-[1px] text-steel mb-2">
              Your progress
            </div>
            <div className="flex items-end gap-1 mb-2">
              <div className="text-2xl font-semibold text-charcoal">12</div>
              <div className="text-[12px] text-steel mb-1.5">/ 14 days</div>
            </div>
            <div className="h-1.5 w-32 bg-surface rounded-full overflow-hidden">
              <div className="h-full w-[85%] bg-primary rounded-full" />
            </div>
          </div>

          {/* Floating streak badge — middle left */}
          <div
            className="hidden xl:flex absolute top-1/2 -translate-y-1/2 -left-32 bg-tint-peach rounded-xl border border-brand-orange/20 shadow-lg p-3 rotate-[-8deg] items-center gap-2 z-20"
            aria-hidden
          >
            <div className="text-2xl">🔥</div>
            <div>
              <div className="text-[16px] font-semibold text-charcoal leading-none">
                5 day streak
              </div>
              <div className="text-[11px] text-charcoal/70 mt-0.5">
                Don&rsquo;t break it!
              </div>
            </div>
          </div>

          {/* Floating "all done" pill — top left */}
          <div
            className="hidden xl:flex absolute -top-6 -left-14 bg-tint-mint border border-brand-green/20 rounded-full px-3 py-1.5 shadow rotate-[-6deg] items-center gap-1.5 z-20"
            aria-hidden
          >
            <div className="w-2 h-2 rounded-full bg-brand-green" />
            <span className="text-[12px] font-semibold text-charcoal">
              Day done!
            </span>
          </div>

          {/* The form */}
          <div className="relative z-10 bg-canvas rounded-2xl border border-hairline shadow-xl p-8">
            <div className="text-center mb-7">
              <h1 className="text-3xl font-semibold tracking-tight text-charcoal mb-2">
                {title}
              </h1>
              <p className="text-slate text-[14px]">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
