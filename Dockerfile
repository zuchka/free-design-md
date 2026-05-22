FROM node:22-bookworm

# pnpm via corepack (matches packageManager field in package.json)
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

WORKDIR /app

# Dependency layer (cached unless lockfile changes)
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Source
COPY . .

# Build (agent-native build → .output/server/index.mjs)
RUN pnpm build

# Install Playwright Chromium + all required OS libs
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers
RUN pnpm exec playwright install --with-deps chromium

# Runtime
EXPOSE 3000
ENV NITRO_HOST=0.0.0.0
ENV PORT=3000

CMD ["node", ".output/server/index.mjs"]
