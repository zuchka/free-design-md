import { createApp } from "h3";
import catalogDesign from "./routes/api/catalog-designs/[slug].get.js";
import catalogDesigns from "./routes/api/catalog-designs/index.get.js";
import designArtifactEvent from "./routes/api/design-artifact-event.post.js";
import enrichDesignMd from "./routes/api/enrich-design-md.post.js";
import extract from "./routes/api/extract.get.js";
import health from "./routes/api/health.get.js";
import iterateDesignMd from "./routes/api/iterate-design-md.post.js";
import credits from "./routes/api/me/credits.get.js";
import metrics from "./routes/api/metrics.get.js";
import deleteSavedEnrichment from "./routes/api/saved-enrichments/[id].delete.js";
import getSavedEnrichment from "./routes/api/saved-enrichments/[id].get.js";
import iterateSavedEnrichment from "./routes/api/saved-enrichments/[id]/iterate.post.js";
import savedEnrichments from "./routes/api/saved-enrichments/index.get.js";

export const apiApp = createApp({ debug: process.env.NODE_ENV !== "production" })
  .on("GET", "/api/health", health)
  .on("GET", "/api/extract", extract)
  .on("POST", "/api/enrich-design-md", enrichDesignMd)
  .on("POST", "/api/iterate-design-md", iterateDesignMd)
  .on("GET", "/api/me/credits", credits)
  .on("GET", "/api/saved-enrichments", savedEnrichments)
  .on("GET", "/api/saved-enrichments/:id", getSavedEnrichment)
  .on("DELETE", "/api/saved-enrichments/:id", deleteSavedEnrichment)
  .on("POST", "/api/saved-enrichments/:id/iterate", iterateSavedEnrichment)
  .on("GET", "/api/catalog-designs", catalogDesigns)
  .on("GET", "/api/catalog-designs/:slug", catalogDesign)
  .on("POST", "/api/design-artifact-event", designArtifactEvent)
  .on("GET", "/api/metrics", metrics);
