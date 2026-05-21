# Design: Remove Unused Packages (Slides Template Leftovers)

**Date:** 2026-05-21  
**Branch:** `chore/remove-unused-packages`

## Goal

Remove ~73 npm packages and associated dead files that were carried over from the slides template but are never imported by any live code in the current design.md extractor app.

## Context

The app was bootstrapped from an Agent Native slides template. That template shipped with a collaborative rich-text editor (TipTap + Yjs), diagram/drawing tools (Excalidraw, Mermaid), drag-and-drop (dnd-kit), 3D rendering (Three.js/React Three Fiber), document import handlers (PPTX/DOCX/PDF parsers), image generation via Gemini, and a full shadcn/ui component library. None of these features exist in the current app. The active surface is: one page at `/`, two API routes (`/api/extract`, `/api/enrich-design-md`), a headless Playwright extraction action, and an Anthropic SDK enrichment action.

## Architecture

Single-sweep cleanup: delete dead files → remove packages from package.json → clean up vite.config.ts → install + typecheck. No refactoring, no behavior change.

## What to Delete

### Dead server handler files
- `server/handlers/image-gen.ts`
- `server/handlers/image-providers/` (entire directory: gemini.ts, openai.ts, index.ts, types.ts — not imported by any route)
- `server/handlers/import/pptx-parser.ts`
- `server/handlers/import/docx-parser.ts`
- `server/handlers/import/html-converter.ts`

### Dead shadcn/ui component files
Delete all of `app/components/ui/` EXCEPT these 7 live components:
- `avatar.tsx` — used by AccountChip
- `button.tsx` — used by multiple pages
- `dialog.tsx` — used by SignInModal
- `dropdown-menu.tsx` — used by AccountChip
- `input.tsx` — used by _index route
- `spinner.tsx` — used by SignInModal and _index route
- `tooltip.tsx` — used by root.tsx

Files to delete (42 total):
accordion, alert, alert-dialog, aspect-ratio, badge, breadcrumb, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, drawer, form, hover-card, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toaster, toggle, toggle-group

### Dead hooks
- `app/hooks/use-toast.ts` (toast system is not wired into any live page)
- `app/components/ui/use-toast.ts` (re-export of the above; deleted with the ui/ sweep)

### vite.config.ts cleanup
- Remove from `ssrStubs`: `mermaid`, `@excalidraw/excalidraw`, `@excalidraw/mermaid-to-excalidraw`
- Remove the entire `optimizeDeps.include` block (all TipTap/Yjs entries)

## Packages to Remove

### From `dependencies` (32 packages)

| Package | Reason |
|---|---|
| @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities | Slides drag-and-drop |
| @excalidraw/excalidraw, @excalidraw/mermaid-to-excalidraw | Drawing canvas |
| @google/genai | Only in dead image-gen handlers |
| @tiptap/core, @tiptap/extension-collaboration, @tiptap/extension-collaboration-caret, @tiptap/extension-color, @tiptap/extension-link, @tiptap/extension-placeholder, @tiptap/extension-text-style, @tiptap/pm, @tiptap/react, @tiptap/starter-kit, @tiptap/y-tiptap | Collaborative rich-text editor |
| dompurify | No imports anywhere |
| fast-xml-parser | Only in dead pptx-parser |
| jspdf | No imports anywhere |
| jszip | Only in dead pptx-parser |
| mammoth | Only in dead docx-parser |
| mermaid | Only in vite ssrStubs, no actual imports |
| modern-screenshot | No imports anywhere |
| p-limit | No imports anywhere |
| pdf-parse | No imports anywhere |
| postgres | Replaced by SQLite (@libsql/client); zero imports |
| pptxgenjs | No imports anywhere |
| react-markdown, rehype-raw | No imports anywhere |
| y-protocols, yjs | Collaborative editor, only in vite optimizeDeps |

### From `devDependencies` (41 packages)

| Package | Reason |
|---|---|
| @hookform/resolvers, react-hook-form | Only in dead form.tsx |
| @radix-ui/react-accordion | Dead accordion.tsx |
| @radix-ui/react-alert-dialog | Dead alert-dialog.tsx |
| @radix-ui/react-aspect-ratio | Dead aspect-ratio.tsx |
| @radix-ui/react-checkbox | Dead checkbox.tsx |
| @radix-ui/react-collapsible | Dead collapsible.tsx |
| @radix-ui/react-context-menu | Dead context-menu.tsx |
| @radix-ui/react-hover-card | Dead hover-card.tsx |
| @radix-ui/react-label | Dead label.tsx |
| @radix-ui/react-menubar | Dead menubar.tsx |
| @radix-ui/react-navigation-menu | Dead navigation-menu.tsx |
| @radix-ui/react-popover | Dead popover.tsx |
| @radix-ui/react-progress | Dead progress.tsx |
| @radix-ui/react-radio-group | Dead radio-group.tsx |
| @radix-ui/react-scroll-area | Dead scroll-area.tsx |
| @radix-ui/react-select | Dead select.tsx |
| @radix-ui/react-separator | Dead separator.tsx |
| @radix-ui/react-slider | Dead slider.tsx |
| @radix-ui/react-switch | Dead switch.tsx |
| @radix-ui/react-tabs | Dead tabs.tsx |
| @radix-ui/react-toast | Dead toast.tsx (toast system not wired to any page) |
| @radix-ui/react-toggle | Dead toggle.tsx |
| @radix-ui/react-toggle-group | Dead toggle-group.tsx |
| @react-three/drei, @react-three/fiber, three, @types/three | 3D rendering |
| @tanstack/react-query | No imports anywhere |
| @types/jszip | jszip itself is also being removed |
| cmdk | Dead command.tsx |
| date-fns | No imports anywhere |
| embla-carousel-react | Dead carousel.tsx |
| input-otp | Dead input-otp.tsx |
| lucide-react | No imports anywhere |
| motion | No imports anywhere |
| react-day-picker | Dead calendar.tsx |
| react-resizable-panels | Dead resizable.tsx |
| recharts | Dead chart.tsx |
| sonner | Dead sonner.tsx |
| vaul | Dead drawer.tsx |

## What We Keep

Live packages untouched: `@agent-native/core`, `@agent-native/pinpoint`, `@anthropic-ai/sdk`, `@libsql/client`, `@tabler/icons-react` (used in _index, AccountChip, quality), `@radix-ui/react-avatar`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-slot`, `@radix-ui/react-tooltip`, `class-variance-authority`, `clsx`, `drizzle-orm`, `dotenv`, `h3`, `isbot`, `nanoid`, `playwright`, `playwright-extra`, `puppeteer-extra-plugin-stealth`, `react`, `react-dom`, `react-router`, `@react-router/dev`, `@react-router/fs-routes`, `tailwindcss`, `tailwind-merge`, `yaml`, `zod`, plus build/test tools.

## Verification Steps

1. `pnpm install` — updates lockfile, confirms packages install cleanly
2. `pnpm typecheck` — catches any missed dependency
3. `pnpm test` — regression check
4. `pnpm build` — confirms no dead SSR references remain

## Testing

No functional tests needed — this is pure deletion with no behavior change. The test suite's existing 144 tests cover runtime behavior. `pnpm typecheck` is the primary safety gate.
