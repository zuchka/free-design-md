# Remove Unused Packages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove 73 npm packages and their associated dead files that were carried over from the Agent Native slides template but are never imported by any live code in the design.md extractor app.

**Architecture:** Pure deletion sweep — no new code, no refactoring, no behavior change. Delete dead files first (so TypeScript catches any missed import), then strip packages from package.json, then reinstall and verify. The safety gate is `pnpm typecheck` after each deletion batch.

**Tech Stack:** pnpm, TypeScript, Vite, React Router

---

### Task 1: Create the feature branch

**Files:**
- No file changes — git operation only

- [ ] **Step 1: Create and switch to the cleanup branch**

```bash
git checkout -b chore/remove-unused-packages
```

Expected output: `Switched to a new branch 'chore/remove-unused-packages'`

---

### Task 2: Delete dead server handler files

These files are never imported by any active route. They are slides-template leftovers that drag in `@google/genai`, `fast-xml-parser`, `jszip`, and `mammoth`.

**Files:**
- Delete: `server/handlers/image-gen.ts`
- Delete: `server/handlers/image-providers/` (entire directory)
- Delete: `server/handlers/import/pptx-parser.ts`
- Delete: `server/handlers/import/docx-parser.ts`
- Delete: `server/handlers/import/html-converter.ts`

- [ ] **Step 1: Delete the files**

```bash
rm server/handlers/image-gen.ts
rm -rf server/handlers/image-providers/
rm server/handlers/import/pptx-parser.ts
rm server/handlers/import/docx-parser.ts
rm server/handlers/import/html-converter.ts
```

- [ ] **Step 2: Verify the import/ directory isn't empty (other files may remain)**

```bash
ls server/handlers/import/
```

If the directory is now empty, remove it too:
```bash
rmdir server/handlers/import/
```

- [ ] **Step 3: Run typecheck to confirm no live code imported these files**

```bash
pnpm typecheck
```

Expected: silent (zero errors). If any errors appear, a live file was importing one of the deleted files — investigate before continuing.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete dead slides-template server handlers"
```

---

### Task 3: Delete dead shadcn/ui component files

42 of 49 components in `app/components/ui/` are never imported outside the `ui/` directory. The 7 live components (avatar, button, dialog, dropdown-menu, input, spinner, tooltip) are kept.

Also delete the toast hook in `app/hooks/` — it is defined but never called by any live page.

**Files:**
- Delete: the following 42 files in `app/components/ui/`
- Delete: `app/hooks/use-toast.ts`

- [ ] **Step 1: Delete the dead shadcn component files**

```bash
cd app/components/ui && rm \
  accordion.tsx \
  alert.tsx \
  alert-dialog.tsx \
  aspect-ratio.tsx \
  badge.tsx \
  breadcrumb.tsx \
  calendar.tsx \
  card.tsx \
  carousel.tsx \
  chart.tsx \
  checkbox.tsx \
  collapsible.tsx \
  command.tsx \
  context-menu.tsx \
  drawer.tsx \
  form.tsx \
  hover-card.tsx \
  input-otp.tsx \
  label.tsx \
  menubar.tsx \
  navigation-menu.tsx \
  pagination.tsx \
  popover.tsx \
  progress.tsx \
  radio-group.tsx \
  resizable.tsx \
  scroll-area.tsx \
  select.tsx \
  separator.tsx \
  sheet.tsx \
  sidebar.tsx \
  skeleton.tsx \
  slider.tsx \
  sonner.tsx \
  switch.tsx \
  table.tsx \
  tabs.tsx \
  textarea.tsx \
  toast.tsx \
  toaster.tsx \
  toggle.tsx \
  toggle-group.tsx \
  use-toast.ts
cd ../../..
```

- [ ] **Step 2: Delete the dead toast hook**

```bash
rm app/hooks/use-toast.ts
```

Check if `app/hooks/` still has other files; if it's empty, remove it:
```bash
ls app/hooks/ 2>/dev/null || rmdir app/hooks/
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: silent. If errors appear, a live file was importing one of the deleted components — fix the import or restore the component.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete 42 unused shadcn/ui components and dead toast hook"
```

---

### Task 4: Clean up vite.config.ts

Remove SSR stubs and optimizeDeps entries for packages we're about to delete. The `shiki` stub and `@agent-native/pinpoint` stub are kept — they are used by the framework internally.

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Replace vite.config.ts with the cleaned-up version**

Open `vite.config.ts`. Replace its contents with:

```typescript
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "@agent-native/core/vite";

export default defineConfig({
  plugins: [reactRouter()],
  ssrStubs: [
    "shiki",
    "@agent-native/pinpoint",
  ],
});
```

(Removed: `mermaid`, `@excalidraw/excalidraw`, `@excalidraw/mermaid-to-excalidraw` from ssrStubs. Removed entire `optimizeDeps.include` block containing all TipTap/Yjs entries.)

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: silent.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "chore: remove dead ssrStubs and optimizeDeps from vite.config"
```

---

### Task 5: Remove unused packages from package.json

Edit `package.json` to delete 32 entries from `dependencies` and 41 entries from `devDependencies`.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove the following entries from `dependencies`**

Delete these lines from the `"dependencies"` block in `package.json`:

```
"@dnd-kit/core": "^6.3.1",
"@dnd-kit/sortable": "^10.0.0",
"@dnd-kit/utilities": "^3.2.2",
"@excalidraw/excalidraw": "^0.18.0",
"@excalidraw/mermaid-to-excalidraw": "^2.2.2",
"@google/genai": "^1.42.0",
"@tiptap/core": "^3.22.2",
"@tiptap/extension-collaboration": "^3.22.2",
"@tiptap/extension-collaboration-caret": "^3.22.2",
"@tiptap/extension-color": "^3.22.2",
"@tiptap/extension-link": "^3.22.2",
"@tiptap/extension-placeholder": "^3.22.2",
"@tiptap/extension-text-style": "^3.22.2",
"@tiptap/pm": "^3.22.2",
"@tiptap/react": "^3.22.2",
"@tiptap/starter-kit": "^3.22.2",
"@tiptap/y-tiptap": "^3.0.2",
"dompurify": "^3.3.1",
"fast-xml-parser": "5.7.2",
"jspdf": "4.2.1",
"jszip": "3.10.1",
"mammoth": "1.12.0",
"mermaid": "^11.14.0",
"modern-screenshot": "^4.7.0",
"p-limit": "^7.3.0",
"pdf-parse": "^2.4.5",
"postgres": "^3.4.9",
"pptxgenjs": "4.0.1",
"react-markdown": "^10.1.0",
"rehype-raw": "^7.0.0",
"y-protocols": "^1.0.7",
"yjs": "^13.6.30",
```

- [ ] **Step 2: Remove the following entries from `devDependencies`**

Delete these lines from the `"devDependencies"` block in `package.json`:

```
"@hookform/resolvers": "^5.2.2",
"@radix-ui/react-accordion": "^1.2.11",
"@radix-ui/react-alert-dialog": "^1.1.14",
"@radix-ui/react-aspect-ratio": "^1.1.7",
"@radix-ui/react-checkbox": "^1.3.2",
"@radix-ui/react-collapsible": "^1.1.11",
"@radix-ui/react-context-menu": "^2.2.15",
"@radix-ui/react-hover-card": "^1.1.14",
"@radix-ui/react-label": "^2.1.7",
"@radix-ui/react-menubar": "^1.1.15",
"@radix-ui/react-navigation-menu": "^1.2.13",
"@radix-ui/react-popover": "^1.1.14",
"@radix-ui/react-progress": "^1.1.7",
"@radix-ui/react-radio-group": "^1.3.7",
"@radix-ui/react-scroll-area": "^1.2.9",
"@radix-ui/react-select": "^2.2.5",
"@radix-ui/react-separator": "^1.1.7",
"@radix-ui/react-slider": "^1.3.5",
"@radix-ui/react-switch": "^1.2.5",
"@radix-ui/react-tabs": "^1.1.12",
"@radix-ui/react-toast": "^1.2.14",
"@radix-ui/react-toggle": "^1.1.9",
"@radix-ui/react-toggle-group": "^1.1.10",
"@react-three/drei": "^10.7.7",
"@react-three/fiber": "^9.6.0",
"@tanstack/react-query": "^5.99.2",
"@types/jszip": "^3.4.1",
"@types/three": "^0.176.0",
"cmdk": "^1.1.1",
"date-fns": "^4.1.0",
"embla-carousel-react": "^8.6.0",
"input-otp": "^1.4.2",
"lucide-react": "^1.8.0",
"motion": "^12.38.0",
"react-day-picker": "^9.14.0",
"react-hook-form": "^7.71.2",
"react-resizable-panels": "^4.10.0",
"recharts": "^3.8.1",
"sonner": "^2.0.7",
"three": "^0.176.0",
"vaul": "^1.1.2",
```

- [ ] **Step 3: Reinstall to update the lockfile**

```bash
pnpm install
```

Expected: pnpm removes the deleted packages from node_modules and updates `pnpm-lock.yaml`. No errors.

- [ ] **Step 4: Run full verification suite**

```bash
pnpm typecheck
```
Expected: silent (zero type errors).

```bash
pnpm test
```
Expected: all tests pass (currently 144 tests).

```bash
pnpm build
```
Expected: clean build, no errors about missing modules.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: remove 73 unused packages (slides template leftovers)"
```

---

### Task 6: Push branch and open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin chore/remove-unused-packages
```

- [ ] **Step 2: Open a PR**

```bash
gh pr create \
  --title "chore: remove 73 unused packages from slides template" \
  --body "$(cat <<'EOF'
## Summary

- Removes 73 npm packages (32 deps, 41 devDeps) that were carried over from the Agent Native slides template but are never imported by any live code
- Deletes dead server handler files: image-gen, image-providers/, import/ (pptx/docx/html parsers)
- Deletes 42 of 49 shadcn/ui wrapper components — only button, dialog, dropdown-menu, avatar, tooltip, input, spinner survive
- Cleans up vite.config.ts: removes dead ssrStubs (mermaid, excalidraw) and entire optimizeDeps block (tiptap/yjs)
- No behavior change — pure deletion, verified by typecheck + full test suite

## Test plan
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm test` — all 144 tests pass
- [ ] `pnpm build` — clean build with no missing module errors
- [ ] Dev server starts and `/` page works normally

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Verification Checklist

After all tasks complete:
- [ ] `pnpm typecheck` — silent
- [ ] `pnpm test` — 144 tests pass
- [ ] `pnpm build` — clean build
- [ ] `git log --oneline` shows 4 clean commits on `chore/remove-unused-packages`
- [ ] PR is open and ready to review
