import { defineEventHandler } from "h3";
import { listExampleDesignSummaries } from "../../../../app/lib/example-library.js";

export default defineEventHandler(async () => {
  const designs = listExampleDesignSummaries();
  const categories = Array.from(
    new Set(designs.map((design) => design.category)),
  );

  return {
    count: designs.length,
    categories,
    designs,
  };
});
