import { afterAll, afterEach, describe, expect, it } from "vitest";
import { closeDbClient } from "../db/client.js";
import { getDbExec } from "../db/index.js";
import {
  deleteSavedEnrichmentForOwner,
  getPublicSavedEnrichment,
  listSavedEnrichmentsForOwner,
  saveEnrichmentSnapshot,
} from "./saved-enrichments.js";

const OWNER_A = "integration-owner-a";
const OWNER_B = "integration-owner-b";

async function cleanup(): Promise<void> {
  await getDbExec().execute({
    sql: `DELETE FROM app.fdmd_saved_enrichments
          WHERE owner_id IN ($1, $2)`,
    args: [OWNER_A, OWNER_B],
  });
}

afterEach(cleanup);
afterAll(closeDbClient);

describe("saved enrichment ownership", () => {
  it("lists and deletes only the requesting owner's records", async () => {
    const first = await saveEnrichmentSnapshot({
      owner: { ownerId: OWNER_A },
      sourceUrl: "https://example.test/a",
      deterministicMarkdown: "# deterministic",
      enrichedMarkdown: "# enriched",
      designSystemData: { colors: [] },
      signals: { title: "Owner A" },
      model: "integration-model",
      usage: { inputTokens: 1 },
    });
    await saveEnrichmentSnapshot({
      owner: { ownerId: OWNER_B },
      sourceUrl: "https://example.test/b",
      deterministicMarkdown: "# deterministic",
      enrichedMarkdown: "# enriched",
      designSystemData: { colors: [] },
      signals: { title: "Owner B" },
      model: "integration-model",
      usage: { inputTokens: 1 },
    });

    expect(await listSavedEnrichmentsForOwner(OWNER_A)).toHaveLength(1);
    expect(await deleteSavedEnrichmentForOwner(first.id, OWNER_B)).toBe(false);
    expect(await getPublicSavedEnrichment(first.id)).toMatchObject({
      id: first.id,
      title: "Owner A",
    });
    expect(await deleteSavedEnrichmentForOwner(first.id, OWNER_A)).toBe(true);
  });
});
