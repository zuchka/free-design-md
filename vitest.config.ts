import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  test: {
    include: ["**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/.output/**",
    ],
    // Database integration files use one local Postgres schema and clean up
    // deterministic test owners, so keep files sequential.
    fileParallelism: false,
  },
});
