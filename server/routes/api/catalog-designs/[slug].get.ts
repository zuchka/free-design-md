import {
  defineEventHandler,
  getRouterParam,
  setResponseStatus,
} from "h3";
import { getExampleDesignBySlug } from "../../../../app/lib/example-library.js";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    setResponseStatus(event, 400);
    return { error: "catalog design slug is required" };
  }

  const design = getExampleDesignBySlug(slug);
  if (!design) {
    setResponseStatus(event, 404);
    return { error: "catalog design not found" };
  }

  return {
    id: design.slug,
    title: design.title,
    enrichedMarkdown: design.enrichedMarkdown,
    deterministicMarkdown: design.markdown,
  };
});
