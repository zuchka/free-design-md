FROM node:22.12.0-bookworm

# Pinned package manager (matches packageManager field in package.json).
# Node 22.12.0's bundled Corepack cannot verify newer pnpm signatures.
RUN npm install -g pnpm@10.14.0

WORKDIR /app

# Dependency layer (cached unless lockfile changes)
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Source
COPY . .

# Build the React Router server and browser bundles.
RUN pnpm build

# Install Playwright Chromium + all required OS libs
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers
RUN pnpm exec playwright install --with-deps chromium

# Runtime
EXPOSE 3000
ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["pnpm", "start"]
