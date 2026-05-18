import { defineAction } from "@agent-native/core";
import { z } from "zod";
import { resolveAccess } from "@agent-native/core/sharing";
import "../server/db/index.js"; // ensure registerShareableResource runs
import { designSystemToDesignMd } from "../shared/design-md.js";
import type { DesignSystemData } from "../shared/api.js";

export default defineAction({
  description:
    "Render an existing design system as a Google design.md spec file " +
    "(YAML frontmatter + human-readable Markdown body). Read-only.",
  schema: z.object({
    id: z.string().describe("Design system ID"),
  }),
  readOnly: true,
  http: { method: "GET" },
  run: async ({ id }) => {
    const access = await resolveAccess("design-system", id);
    if (!access) throw new Error(`design system ${id} not found or not accessible`);
    const row = access.resource;
    const data = JSON.parse(row.data) as DesignSystemData;
    const markdown = designSystemToDesignMd({
      title: row.title,
      description: row.description ?? "",
      data,
      customInstructions: row.customInstructions ?? "",
    });
    return { id: row.id, title: row.title, markdown };
  },
});
