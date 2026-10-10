import { z } from "zod";

export const ANALYTICS_VERSION = 1;
export const clientEventSchema = z
  .object({
    id: z.string().uuid(),
    name: z.enum([
      "page_viewed",
      "artifact_copied",
      "artifact_downloaded",
      "share_link_copied",
    ]),
    page: z.enum([
      "workspace",
      "docs",
      "examples",
      "public_snapshot",
      "quality",
      "other",
    ]),
    artifactId: z
      .string()
      .max(128)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
    format: z.enum(["markdown", "html", "mdx", "link", "cli"]).optional(),
    variant: z.enum(["deterministic", "enriched", "iteration"]).optional(),
    surface: z
      .enum(["home", "example", "saved_design", "saved_library"])
      .optional(),
  })
  .strict();
export type ClientAnalyticsEvent = z.infer<typeof clientEventSchema>;
export type AnalyticsPage = ClientAnalyticsEvent["page"];
export const attributionSchema = z
  .object({
    referrer: z.string().max(2048).optional(),
    source: z.string().max(80).optional(),
    medium: z.string().max(80).optional(),
    campaign: z.string().max(80).optional(),
  })
  .strict();
export function analyticsPage(path: string): AnalyticsPage {
  if (path === "/") return "workspace";
  if (path.startsWith("/docs")) return "docs";
  if (path.startsWith("/examples")) return "examples";
  if (path.startsWith("/d/")) return "public_snapshot";
  if (path === "/quality") return "quality";
  return "other";
}
export const creatorEvents = [
  "extraction_succeeded",
  "ai_succeeded",
  "artifact_copied",
  "artifact_downloaded",
] as const;
export type AnalyticsSource = "browser" | "api" | "direct" | "historical";
export type AnalyticsAudience =
  | "product"
  | "example"
  | "public_share"
  | "internal"
  | "bot"
  | "unknown";
