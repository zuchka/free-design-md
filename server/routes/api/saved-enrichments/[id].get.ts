import {
  defineEventHandler,
  getRouterParam,
  setResponseStatus,
} from "h3";
import { getPublicSavedEnrichment } from "../../../lib/saved-enrichments.js";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    setResponseStatus(event, 400);
    return { error: "saved enrichment id is required" };
  }

  const saved = await getPublicSavedEnrichment(id);
  if (!saved) {
    setResponseStatus(event, 404);
    return { error: "saved enrichment not found" };
  }

  return saved;
});
