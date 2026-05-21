# Docker + GHCR Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Containerize the app into a Docker image, verify it locally, push it to GHCR at `ghcr.io/zuchka/free-design-md`, and configure Railway to pull from that image.

**Architecture:** Multi-stage Dockerfile — `node:22-bookworm` builder compiles native modules (`better-sqlite3`) and downloads the Playwright Chromium binary, then a `node:22-bookworm-slim` runtime stage copies only what's needed and installs Playwright's OS-level dependencies. Railway pulls the published image directly; no build happens on Railway.

**Tech Stack:** Docker (multi-stage), GHCR, Railway Docker image deploy, Playwright `install-deps`, `better-sqlite3` native module, Nitro production server (`node .output/server/index.mjs`), pnpm 10.14.0 via corepack

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `Dockerfile` | Create | Multi-stage build |
| `.dockerignore` | Create | Exclude non-essential files from build context |
| `railpack.json` | Delete | No longer building on Railway |
| `railway.toml` | Modify | Remove build comment, keep healthcheck/restart |

---

## Task 1: Create `.dockerignore`

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: Create the file**

```
# .dockerignore
node_modules/
.output/
data/
.env.local
.env.development
.git/
.gitignore
docs/
*.log
```

- [ ] **Step 2: Verify the file was created**

```bash
cat .dockerignore
```

Expected: the 9 lines above printed to stdout.

- [ ] **Step 3: Commit**

```bash
git add .dockerignore
git commit -m "chore: add .dockerignore for Docker build"
```

---

## Task 2: Create the Dockerfile

**Context:**
- The app is built with `pnpm build` → `agent-native build` → outputs to `.output/server/index.mjs` (Nitro production server)
- `better-sqlite3` is a native Node.js module that must be compiled on the same OS as the runtime image; both stages use `bookworm` so binaries are compatible
- Playwright browser binary is downloaded in the builder stage at `/ms-playwright`, then copied into the runtime image; `playwright install-deps chromium` in the runtime stage installs only the OS libraries (no re-download)
- Railway injects `PORT` at runtime; Nitro reads `process.env.PORT` automatically

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create the Dockerfile**

```dockerfile
# ─── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:22-bookworm AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

# Compile-time deps for better-sqlite3 native module
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Download Chromium browser binary to a fixed, copy-friendly path
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN pnpm exec playwright install chromium

# ─── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:22-bookworm-slim
WORKDIR /app

# Copy built app, all node_modules, and the browser binary from builder
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /ms-playwright /ms-playwright

# Install Playwright's OS-level deps using playwright's own logic
# (no browser download — binary was copied above)
RUN apt-get update \
    && node node_modules/playwright/cli.js install-deps chromium \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NODE_ENV=production

EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
```

- [ ] **Step 2: Commit**

```bash
git add Dockerfile
git commit -m "feat: add multi-stage Dockerfile for Docker/GHCR deployment"
```

---

## Task 3: Remove Railpack config, slim down `railway.toml`

`railpack.json` and the build-oriented comment in `railway.toml` are no longer needed — the image arrives pre-built.

**Files:**
- Delete: `railpack.json`
- Modify: `railway.toml`

- [ ] **Step 1: Delete railpack.json**

```bash
git rm railpack.json
```

- [ ] **Step 2: Update railway.toml**

Replace the full contents with:

```toml
[deploy]
healthcheckPath = "/"
healthcheckTimeout = 120
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

- [ ] **Step 3: Commit**

```bash
git add railway.toml
git commit -m "chore: remove railpack config, Railway now deploys from Docker image"
```

---

## Task 4: Build and smoke-test locally (arm64 native — fast)

Local build runs native arm64 (no emulation). This is for fast iteration only; the GHCR push in Task 5 produces the amd64 image Railway needs.

**Prerequisites:** Docker Desktop running locally.

- [ ] **Step 1: Build the local image**

```bash
docker build -t free-design-md:local .
```

Expected: build completes with output ending in `=> exporting to image` and no errors. The Playwright install-deps step will print apt-get output — that's normal.

- [ ] **Step 2: Run the container**

```bash
docker run --rm -p 8080:8080 -e PORT=8080 free-design-md:local
```

Expected: server starts and logs something like `Listening on http://0.0.0.0:8080`.

- [ ] **Step 3: Smoke-test the root route** (new terminal)

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/
```

Expected: `200`

- [ ] **Step 4: Smoke-test the extract endpoint**

```bash
curl -s "http://localhost:8080/api/extract?url=stripe.com&format=json" | head -c 200
```

Expected: JSON response starting with `{"url":"` — confirms Playwright launched Chromium successfully inside the container.

- [ ] **Step 5: Stop the container**

Press `Ctrl+C` in the terminal where the container is running.

---

## Task 5: Push to GHCR

This step builds for `linux/amd64` (Railway's target platform). Building for a different architecture than your Mac's arm64 uses QEMU emulation via Docker Desktop's buildx — it's slower but produces the correct image.

**Prerequisites:**
- A GitHub Personal Access Token (PAT) with `write:packages` scope. Generate at: `https://github.com/settings/tokens/new` — check `write:packages` (this implicitly includes `read:packages`).
- The PAT stored in an env var: `export GHCR_PAT=ghp_...`

- [ ] **Step 1: Log in to GHCR**

```bash
echo $GHCR_PAT | docker login ghcr.io -u zuchka --password-stdin
```

Expected: `Login Succeeded`

- [ ] **Step 2: Build for linux/amd64 and push directly to GHCR**

```bash
docker buildx build \
  --platform linux/amd64 \
  -t ghcr.io/zuchka/free-design-md:latest \
  --push \
  .
```

Expected: build runs (slower than local due to QEMU emulation), ends with `=> pushing layers` and no errors. The `--push` flag pushes directly without a local copy.

- [ ] **Step 3: Verify the image is on GHCR**

```bash
docker manifest inspect ghcr.io/zuchka/free-design-md:latest | grep architecture
```

Expected: `"architecture": "amd64"` — confirms the pushed image is the right platform.

- [ ] **Step 4: Make the package public (so Railway can pull without credentials)**

Visit: `https://github.com/users/zuchka/packages/container/free-design-md/settings`

Under "Danger Zone" → Package visibility → change to **Public**. This lets Railway pull the image without a registry credential.

*(Skip this step if you want to keep it private and supply a deploy token to Railway in Task 6 instead.)*

- [ ] **Step 5: Commit and push the branch**

```bash
git push
```

---

## Task 6: Configure Railway to pull from GHCR

Railway needs to know to use the Docker image instead of building from source.

- [ ] **Step 1: In the Railway dashboard, open your service**

Navigate to your `free-design-md` service.

- [ ] **Step 2: Change the deployment source to Docker image**

Settings → Source → click the current source (likely "GitHub Repo") → choose **Docker Image** → enter:

```
ghcr.io/zuchka/free-design-md:latest
```

*(If you kept the image private, also go to Settings → Image Credentials → Add Credential: registry `ghcr.io`, username `zuchka`, password = your PAT with `read:packages` scope.)*

- [ ] **Step 3: Add required environment variables**

In Railway → Variables, ensure these are set:

```
ANTHROPIC_API_KEY=<your key>       # required for Enrich with AI
PUBLIC_ORIGIN=https://<your-railway-domain>  # required for Builder.io SSO callback
BUILDER_CLIENT_ID=free-design-md   # already in .env.example
```

Do **not** set `DATABASE_URL` — leaving it unset activates the SQLite path (`./data/app.db`).

- [ ] **Step 4: Add a Railway Volume for SQLite persistence**

Railway dashboard → your service → Volumes → Add Volume:
- Mount path: `/app/data`

This makes SQLite data survive redeploys.

- [ ] **Step 5: Trigger a deploy**

Click **Deploy** (or push a commit to the tracked branch). Watch the deploy logs — the container should start and the healthcheck at `/` should pass within 120 seconds.

- [ ] **Step 6: Verify the live deployment**

```bash
curl -s -o /dev/null -w "%{http_code}" https://<your-railway-domain>/
```

Expected: `200`

```bash
curl -s "https://<your-railway-domain>/api/extract?url=stripe.com&format=json" | head -c 200
```

Expected: JSON with design data — full end-to-end working.

---

## Self-Review Notes

- **arm64/amd64 split**: Task 4 builds arm64 for local speed; Task 5 explicitly builds `linux/amd64` for Railway. This is intentional and must not be collapsed.
- **`better-sqlite3` compatibility**: both Dockerfile stages use `bookworm`; the native binary compiled in the builder works in the runtime stage.
- **No `DATABASE_URL` in Railway**: this is a deliberate action item in Task 6, not an omission.
- **Playwright system deps**: using `node node_modules/playwright/cli.js install-deps chromium` (not a manual package list) so playwright determines the correct package names for bookworm — avoids the `libasound2` vs `libasound2t64` naming difference.
