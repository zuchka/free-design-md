import { defineAction } from "./define-action.js";
import { z } from "zod";
import { getDbExec } from "../server/db/index.js";
import { designSystemToDesignMd } from "../shared/design-md.js";
import type { DesignSystemData } from "../shared/api.js";
import { recordActionRun } from "../server/lib/metrics.js";

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
    try {
      const result = await getDbExec().execute({
        sql: `SELECT id, title, description, data, custom_instructions
              FROM design_systems WHERE id = ? AND visibility = 'public'`,
        args: [id],
      });
      const row = result.rows[0];
      if (!row) {
        throw new Error(`design system ${id} not found or not accessible`);
      }
      const data = JSON.parse(String(row.data)) as DesignSystemData;
      const markdown = designSystemToDesignMd({
        title: String(row.title),
        description: row.description ? String(row.description) : "",
        data,
        customInstructions: row.custom_instructions
          ? String(row.custom_instructions)
          : "",
      });
      await recordActionRun({ action: "export-design-md", status: "success" });
      return { id: String(row.id), title: String(row.title), markdown };
    } catch (err) {
      await recordActionRun({ action: "export-design-md", status: "error" });
      throw err;
    }
  },
});
