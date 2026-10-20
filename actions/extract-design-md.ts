import { defineAction } from "./define-action.js";
import { z } from "zod";
import { extractDesignMd } from "../skills/extract-design-md/scripts/lib/extract.js";
import { recordActionRun } from "../server/lib/metrics.js";
import { withExtractionTrace } from "../server/lib/extraction-diagnostics.js";

export {
  CONSENT_DISMISSAL_CANDIDATES,
  CONSENT_OVERLAY_SELECTORS,
  dismissConsent,
} from "../skills/extract-design-md/scripts/lib/extract.js";

export default defineAction({
  description:
    "Headlessly visit a URL with Playwright, collect computed CSS signals, " +
    "and render a design.md spec. Deterministic — no LLM, no agent. CLI-only.",
  schema: z.object({
    url: z.string().describe("URL of the page to extract a design system from"),
  }),
  readOnly: true,
  run: async ({ url }) =>
    withExtractionTrace(async (trace) => {
      trace.setUrl(url);
      try {
        return await extractDesignMd(url, trace);
      } catch (err) {
        await recordActionRun({ action: "extract-design-md", status: "error" });
        throw err;
      }
    }).then(async (result) => {
      await recordActionRun({ action: "extract-design-md", status: "success" });
      return result;
    }),
});
