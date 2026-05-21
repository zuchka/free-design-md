# Navbar Design Spec
**Date:** 2026-05-21

## Goal
Add a top navigation bar that matches the agent-native.com aesthetic — minimal, developer-focused, single line — to give free design.md a proper product identity.

## Architecture

New component `app/components/NavBar.tsx` added to `root.tsx` so it renders globally on all routes (`/` and `/quality`). AccountChip and the Quality link are removed from the inline header block in `_index.tsx` (they move into the nav). The `h1` heading and description remain as page content below the nav.

## NavBar Component

**File:** `app/components/NavBar.tsx`

**Dimensions:** full-width, `bg-background`, `border-b border-border`, `h-14`

**Inner container:** `max-w-7xl mx-auto px-6` — matches the page content container so everything lines up.

**Left side:**
- Brand text: `free design` in `font-semibold text-foreground` + `.md` in `text-primary` (Builder cyan `#18b6f6`)
- Separator: `·` in `text-muted-foreground mx-2`
- Attribution: `powered by Agent Native ↗` as a link to `https://agent-native.com` — `text-xs text-muted-foreground hover:text-foreground`

**Right side (left to right):**
- `Quality` — `<Link to="/quality">` — `text-sm text-muted-foreground hover:text-foreground transition-colors`
- `agent-native.com ↗` — external `<a>` to `https://agent-native.com` — same style
- `<AccountChip />` — already handles the null-user case (returns null), so no sign-in button needed in nav; unauthenticated users get sign-in via the EnrichBanner

## Changes to `_index.tsx`

Remove from the inline header block:
- The `<AccountChip />` import usage (it now lives in NavBar)
- The `<Link to="/quality">` nav link
- The wrapping flex row (`flex items-start justify-between gap-4`) can collapse — the `<header>` h1+description stands alone

`<SignInModal>` stays in `_index.tsx` unchanged.

## Changes to `root.tsx`

Import and render `<NavBar />` inside `<TooltipProvider>` above `<Outlet />`.

## Out of Scope
- Sign-in button in the nav (EnrichBanner handles that flow)
- Mobile hamburger / responsive collapse (single-line nav wraps gracefully at small sizes)
- Dark mode logo variants (app is locked to light mode)
