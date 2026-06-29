# Task: Visual/UX overhaul of the BSV Faucet front end (BSV Blockchain brand system)

You are redesigning the UI/UX of a Next.js (App Router) BSV faucet app. This is a
**presentation-only** overhaul. You must NOT change, break, or refactor any business
logic, API routes, data flow, or backend behavior. If a change risks altering runtime
behavior, don't make it.

## Hard constraints — DO NOT TOUCH (logic/backend/contracts)
- `app/api/**` — every route handler (wallet/*, transactions, users, requests/export,
  settings, sign-up, deposit-history, webhooks/clerk). Leave 100% as-is.
- `lib/**` — Prisma client (`lib/prisma.ts`), all wallet logic (`lib/wallet/*`:
  generateWallet, monitorTransactions, transactions, updateSpentStatus, regest),
  `lib/depositHistory.ts`. Do not edit.
- `prisma/**` — schema, migrations, seed. `middleware.ts` — Clerk route protection. Do not edit.
- `hooks/useWalletMonitor.ts`, `hooks/useUpdateSpentStatus.ts` — data/logic hooks. Consume
  what they return; do not change behavior. (`hooks/use-toast.ts` is UI — fine to use.)
- Env var usage, server actions, data-fetching calls — keep identical.
- **Component prop contracts**: do not rename or change the props/types pages pass into
  components. Restyle internals freely, but keep each component's public API stable.

## What you MAY change (the design surface)
- JSX structure, classNames, Tailwind utilities, layout, spacing, composition.
- Design tokens in `app/globals.css` and `tailwind.config.ts`.
- Restyle the shadcn/ui primitives in `components/ui/**` (keep their prop APIs intact).
- Feature components' presentation: `components/AdminTreasuryHistory.tsx`,
  `components/adminTreasuryHistory/**`, `components/icons.tsx`, `components/ui/DbBreadcrumb.tsx`.
- Add new purely-presentational components.
- Customize Clerk auth pages (`app/sign-in`, `app/sign-up`) via Clerk's `appearance`/
  `baseTheme` props and their wrapping layout — not by replacing Clerk.
- Keep light/dark mode working (`context/ThemeContext.tsx` toggles the `.dark` class).

## Stack
- Next.js App Router, React, TypeScript (root layout is `export const dynamic = 'force-dynamic'`).
- Tailwind CSS + shadcn/ui (`components.json`) + Radix. Tokens are HSL CSS variables in
  `app/globals.css`. Re-theme by editing those variables, not by hardcoding colors.
- Auth: Clerk. DB: Prisma/Postgres. Analytics: @vercel/analytics.

## Pages in scope
- App shell / sidebar / nav: `app/(dashboard)/layout.tsx`
- `app/(dashboard)/page.tsx`, `dashboard/`, `wallet/`, `transactions/`, `requests/`,
  `customers/`, `users/`, `refer/`, `settings/`, `admin/`, `admin/wallet-settings/`
- Auth: `app/sign-in/[[...sign-in]]`, `app/sign-up/[[...sign-up]]`
- Root: `app/layout.tsx` (you may add fonts/metadata — keep ClerkProvider, ThemeProvider,
  Toaster, Analytics in place).

---

# BSV Blockchain brand system (apply this consistently)

This is a calm, premium, trustworthy aesthetic adapted to a dashboard/admin tool. Restrained,
high-contrast, generous spacing. No decorative gradients, no glassmorphism, no all-caps
anywhere (buttons/badges/labels included). Thin-line icons only.

The logo and favicons are already installed (`public/bsv-blockchain-logo.png`, `app/favicon.ico`,
`app/icon.png`, `app/apple-icon.png`) — don't regenerate them. `BsvLogo` in
`components/icons.tsx` already points at the new mark.

## Color tokens — paste into `app/globals.css`
Brand source colors: Navy #1B1EA9, Blue #003FFF, Cyan #00E6FF, Ice #DAE3FF, Soft Black
#2D2D31. Mapped to the existing shadcn HSL variables:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 5% 18%;        /* Soft Black #2D2D31 */
  --card: 0 0% 100%;
  --card-foreground: 240 5% 18%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 5% 18%;
  --primary: 239 72% 38%;          /* Navy #1B1EA9 */
  --primary-foreground: 0 0% 100%;
  --secondary: 232 33% 95%;        /* Hairline #EFF0F7 */
  --secondary-foreground: 239 72% 38%;
  --muted: 232 33% 95%;
  --muted-foreground: 230 6% 41%;  /* #63656F */
  --accent: 225 100% 93%;          /* Ice #DAE3FF */
  --accent-foreground: 239 72% 38%;
  --destructive: 4 49% 46%;        /* #B0443C — badges/errors only */
  --destructive-foreground: 0 0% 100%;
  --border: 232 33% 95%;           /* Hairline */
  --input: 225 100% 93%;           /* Ice input border */
  --ring: 186 100% 50%;            /* Cyan focus #00E6FF */
  --radius: 0.75rem;
}

.dark {
  --background: 240 5% 15%;        /* #232327 */
  --foreground: 0 0% 100%;
  --card: 240 5% 18%;              /* #2D2D31 */
  --card-foreground: 0 0% 100%;
  --popover: 240 5% 23%;           /* #38383E */
  --popover-foreground: 0 0% 100%;
  --primary: 225 100% 50%;         /* Blue #003FFF */
  --primary-foreground: 0 0% 100%;
  --secondary: 240 5% 23%;         /* #38383E */
  --secondary-foreground: 0 0% 100%;
  --muted: 240 6% 24%;             /* #3A3A41 */
  --muted-foreground: 229 13% 76%; /* #B9BCC9 */
  --accent: 237 32% 22%;           /* #26284A */
  --accent-foreground: 0 0% 100%;
  --destructive: 4 62% 68%;        /* #E0837C */
  --destructive-foreground: 0 0% 100%;
  --border: 240 6% 24%;            /* #3A3A41 */
  --input: 240 6% 24%;
  --ring: 186 100% 50%;            /* Cyan */
}
```

### Color discipline (binding)
- **Green and red live ONLY in status badges** (positive #1D9E75 text / 10% fill; negative
  #B0443C). Never use them for chrome, borders, or general UI.
- **Cyan is sparing** — focus rings and dark-mode links/active states only. Never large surfaces.
- Status-badge positive: text `#1D9E75` (light) / `#5DCAA5` (dark) on a 10–14% fill of the same.
- Links / text-actions: Blue `#003FFF` (light) / Cyan `#00E6FF` (dark).

## Typography
Load two families; map to Tailwind.
- **Chillax** — emphasis only: page titles, section/card headings, key figures (balances,
  stats). SemiBold 600 default. Fontshare:
  `https://api.fontshare.com/v2/css?f[]=chillax@400,500,600&display=swap` (add a `<link>` in
  the root layout `<head>`, or use next/font/local).
- **Noto Sans** — everything else: body, labels, captions, buttons. Load via
  `next/font/google` (weights 300–600), Regular default.

`tailwind.config.ts`:
```ts
fontFamily: {
  sans: ['var(--font-noto-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  display: ['Chillax', 'var(--font-noto-sans)', 'sans-serif'],
}
```

Scale (generalized for a dashboard; no all-caps):

| Role | Font | Size / weight |
|---|---|---|
| Page title | Chillax (font-display) | 26 / 600 |
| Section & card heading | Chillax | 18–20 / 600 |
| Key figure / balance / lead stat | Chillax | 22–24 / 600 |
| Body | Noto Sans | 15–16 / 400, line-height 1.55–1.6 |
| Table cell / list item | Noto Sans | 15 / 400–500 |
| Caption, field label, date, meta | Noto Sans | 13 / 400–500 |
| Badge / chip | Noto Sans | 13 / 500 (12 in chips) |

## Spacing, radii, shadows
- 8pt grid. Page padding 24px. Section rhythm ~26–30px vertical, separated by 1px hairline
  (`border-border`) top borders rather than heavy cards.
- Radii: inputs 12px (`rounded-xl`) · panels/bands 16px · cards & dialogs 20px
  (`rounded-[20px]`) · pills & buttons full (`rounded-full`).
- Hit targets ≥44px; inputs & buttons 48–52px tall.
- Primary button shadow: `0 10px 24px -8px rgba(27,30,169,0.5)` light /
  `0 12px 28px -8px rgba(0,63,255,0.55)` dark.
- Toast shadow: `0 8px 28px rgba(45,45,49,0.10)`.

## Buttons (one filled primary per view; all pills, no all-caps, Noto Sans 15–16/500)
- **Primary:** Navy `#1B1EA9` fill / white text, 48–52px (light); Blue `#003FFF` fill (dark).
- **In-progress:** same button at 75% opacity, label swaps to "Saving…" — **never a spinner**.
- **Secondary:** 1.5px brand-navy outline, navy text (light); 1.5px `rgba(255,255,255,0.28)`
  outline, white text (dark).
- **Text action:** Blue `#003FFF` (light) / Cyan `#00E6FF` (dark), 15/500.
- **Focus:** 3px ring `rgba(0,230,255,0.55)` on every control.

## Icons & motion restraint
- Thin-line, Lucide-weight icons, sparse. No emoji.
- Calm surfaces: no card hover-lift. Hovers darken primaries slightly; text actions underline.
- Success feedback is a quiet top-center toast (white pill, hairline border, navy check),
  not a spinner or banner.

## Design direction notes (tune to taste)
- It's still a dashboard/admin tool — keep dense data tables, sidebar nav, and forms
  legible and efficient. Apply the brand as *finish and discipline*, not by forcing a
  consumer-retail layout onto admin screens.
- [Add your own specifics here: density, any must-keep layouts, reference apps.]

---

## Verification before you finish (prove nothing broke)
- `npx tsc --noEmit` passes (no new type errors).
- `pnpm lint` clean for touched files.
- `git diff --name-only` shows **zero** files under `app/api/`, `lib/`, `prisma/`, and no
  change to `middleware.ts`.
- If env is available (`.env.local` with Clerk keys etc.), run `pnpm dev` and visually check
  every route in light AND dark mode. Without those vars the app 500s on render — that's an
  env issue, not your redesign.
- Summarize exactly which files changed and confirm all changes are presentational.
