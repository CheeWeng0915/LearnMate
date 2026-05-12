# feat: initial frontend UI — auth, dashboard, plan generator, day flow

## What this PR does

Builds the full frontend UI on top of CheeWeng's auth proxy + backend API. Replaces the `create-next-app` boilerplate with 6 styled pages wired to every backend endpoint.

## Pages added

| Route | Purpose | Auth required |
|---|---|---|
| `/` | Landing page — hero, CTAs, feature cards. Auto-redirects to `/dashboard` if logged in | No |
| `/login` | Email + password sign-in form | No |
| `/register` | Sign-up form with **Cloudflare Turnstile** widget | No |
| `/dashboard` | Active plan view — today's card, progress squares, completion stats | Yes |
| `/plans/new` | Goal generator form — goal textarea, level radio, daily-minutes slider, language select | Yes |
| `/plans/preview` | Preview AI-generated plan, expandable days, auto-loaded YouTube videos, save/regenerate | Yes |
| `/plans/[planId]/day/[dayNumber]` | Day detail — task checklist, embedded videos, prev/next day navigation | Yes |

## File structure

```
frontend/
├── app/
│   ├── globals.css                          (modified — brand color tokens)
│   ├── layout.tsx                           (modified — Inter font + AuthProvider)
│   ├── page.tsx                             (replaced — landing)
│   ├── login/page.tsx                       (new)
│   ├── register/page.tsx                    (new)
│   ├── dashboard/page.tsx                   (new)
│   ├── plans/new/page.tsx                   (new)
│   ├── plans/preview/page.tsx               (new)
│   └── plans/[planId]/day/[dayNumber]/page.tsx  (new)
├── components/
│   ├── auth-context.tsx                     (new — useAuth hook + AuthProvider)
│   ├── auth-guard.tsx                       (new — protects routes)
│   ├── auth-shell.tsx                       (new — split-panel layout for /login + /register)
│   ├── nav.tsx                              (new — top nav + account menu)
│   ├── turnstile.tsx                        (new — Cloudflare bot check)
│   └── ui/{button,card,input}.tsx           (new — reusable primitives)
├── lib/
│   ├── api.ts                               (new — typed fetch wrappers for every endpoint)
│   └── types.ts                             (new — TypeScript types matching backend schemas)
├── next.config.ts                           (modified — YouTube image domains, turbopack root)
└── .env.local.example                       (new — env template)
```

## Design choices

- **No new heavy deps** — uses only Next 16 / React 19 / Tailwind v4. No shadcn (incompatible with TW v4), no TanStack Query, no react-hook-form. Plain `useState`/`fetch` + custom Tailwind components.
- **Auth flow** uses the existing `app/api/[...path]/route.ts` proxy — cookies, refresh tokens, Cloud Run identity tokens are all handled there. Frontend just calls `/api/...`.
- **Turnstile** — uses Cloudflare's localhost test sitekey (`1x00000000000000000000AA`) by default. Production should set `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- **Auth pages use a 2-column split** (gradient brand panel + form). Collapses to single column on mobile.
- **Brand colors**: indigo-600 primary, amber-500 accent (streaks), slate neutrals. Inter font.
- **All pages mobile-responsive** — verified at 390×844 (iPhone) and 1280×900 (desktop).

## Verified

- ✅ `npm run build` — production build passes, all 9 routes compile
- ✅ `npx tsc --noEmit` — zero TypeScript errors
- ✅ `npm run dev` — boots in < 2s with Turbopack
- ✅ Zero browser console errors on page load
- ✅ Auth guard correctly redirects unauthenticated users to `/login`
- ✅ Cloudflare Turnstile widget loads with test sitekey on localhost
- ✅ Landing, login, register, plan generator forms all render correctly desktop + mobile

## Not yet verified end-to-end

These need backend running locally + a real user account, which I'll do after merging the env values:

- [ ] Register flow → cookie set → land on dashboard
- [ ] Generate plan → Gemini response → preview renders
- [ ] YouTube videos load per day
- [ ] Save plan → redirect to Day 1
- [ ] Mark task complete → state updates
- [ ] Day navigation (prev/next)
- [ ] Logout clears cookies

## Test plan

1. Pull this branch, `cd frontend`, `npm install`
2. `cp .env.local.example .env.local` (defaults are fine for local)
3. Backend: `cd backend`, `pip install -r requirements.txt`, set up `.env`, `uvicorn main:app --reload --port 8080`
4. Frontend: `npm run dev` → open http://localhost:3001
5. Register a test account → walk through register → dashboard → /plans/new → generate → save → day detail → mark tasks → navigate days → logout

## Screenshots

Saved to `Desktop\learnmate-screenshots\` for reference. Will attach to PR via GitHub web UI:
- `01-landing.png` — landing page
- `04-register-v2.png` — register split-panel layout (desktop)
- `mobile-01-login.png` — login (mobile)
- `mobile-02-register.png` — register (mobile)
- `mobile-03-landing.png` — landing (mobile)

## Notes for review

- The `app/api/[...path]/route.ts` proxy is **untouched** — no changes to your auth plumbing.
- All API calls go through typed wrappers in `lib/api.ts` — easy to extend when backend adds endpoints.
- `AuthProvider` is mounted in root `layout.tsx` — every page can call `useAuth()` to get user/loading/refresh/logout.
- Server Components used where possible (most pages have at least a server wrapper); only forms + interactive bits are `"use client"`.

## Open questions

- Should I add the `/dashboard` empty state more prominently (currently shows "Ready to learn something new?" + CTA)?
- For the plan preview, should the YouTube videos load eagerly for all days, or only when a day is expanded? Current behavior: only Day 1 loads on mount, others load on expand to save quota.
- Any preference on font / colors before merge?
