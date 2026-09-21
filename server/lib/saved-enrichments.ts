import { getDbExec } from "../db/index.js";
import { nanoid } from "nanoid";

export interface SavedEnrichmentOwner {
  ownerId: string;
}

export interface SaveEnrichmentInput {
  owner: SavedEnrichmentOwner;
  sourceUrl: string;
  deterministicMarkdown: string;
  enrichedMarkdown: string;
  designSystemData: unknown;
  signals: unknown;
  parentId?: string | null;
  rootId?: string | null;
  iterationPrompt?: string | null;
  screenshotDataUrl?: string | null;
  model: string;
  usage: unknown;
  stopReason?: string | null;
}

export interface PublicSavedEnrichment {
  id: string;
  sourceUrl: string;
  title: string;
  parentId: string | null;
  rootId: string | null;
  iterationPrompt: string | null;
  deterministicMarkdown: string;
  enrichedMarkdown: string;
  designSystemData: unknown;
  signals: unknown;
  screenshotDataUrl: string | null;
  model: string;
  usage: unknown;
  stopReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavedEnrichmentListItem {
  id: string;
  sourceUrl: string;
  title: string;
  parentId: string | null;
  rootId: string | null;
  iterationPrompt: string | null;
  model: string;
  stopReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SavedEnrichmentRow {
  id: string;
  source_url: string;
  title: string;
  parent_id: string | null;
  root_id: string | null;
  iteration_prompt: string | null;
  deterministic_markdown: string;
  enriched_markdown: string;
  design_system_data_json: string;
  signals_json: string;
  screenshot_data_url: string | null;
  model: string;
  usage_json: string;
  stop_reason: string | null;
  created_at: string;
  updated_at: string;
}

export function savedDesignUrl(id: string): string {
  return `/d/${id}`;
}

export async function saveEnrichmentSnapshot(
  input: SaveEnrichmentInput,
): Promise<{ id: string; url: string }> {
  const id = nanoid();
  const now = new Date().toISOString();
  const title = titleFromSignals(input.signals, input.sourceUrl);
  const exec = getDbExec();

  await exec.execute({
    sql: `INSERT INTO fdmd_saved_enrichments (
            id,
            owner_id,
            source_url,
            title,
            parent_id,
            root_id,
            iteration_prompt,
            deterministic_markdown,
            enriched_markdown,
            design_system_data_json,
            signals_json,
            screenshot_data_url,
            model,
            usage_json,
            stop_reason,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.owner.ownerId,
      input.sourceUrl,
      title,
      input.parentId ?? null,
      input.rootId ?? input.parentId ?? id,
      input.iterationPrompt ?? null,
      input.deterministicMarkdown,
      input.enrichedMarkdown,
      JSON.stringify(input.designSystemData),
      JSON.stringify(input.signals ?? {}),
      input.screenshotDataUrl ?? null,
      input.model,
      JSON.stringify(input.usage ?? {}),
      input.stopReason ?? null,
      now,
      now,
    ],
  });

  return { id, url: savedDesignUrl(id) };
}

export async function listSavedEnrichmentsForOwner(
  ownerId: string,
): Promise<SavedEnrichmentListItem[]> {
  const exec = getDbExec();
  const result = await exec.execute({
    sql: `SELECT id, source_url, title, parent_id, root_id, iteration_prompt, model, stop_reason, created_at, updated_at
          FROM fdmd_saved_enrichments
          WHERE owner_id = ?
          ORDER BY created_at DESC`,
    args: [ownerId],
  });

  return result.rows.map((row) => {
    const r = row as unknown as Pick<
      SavedEnrichmentRow,
      | "id"
      | "source_url"
      | "title"
      | "parent_id"
      | "root_id"
      | "iteration_prompt"
      | "model"
      | "stop_reason"
      | "created_at"
      | "updated_at"
    >;
    return {
      id: r.id,
      sourceUrl: r.source_url,
      title: r.title,
      parentId: r.parent_id,
      rootId: r.root_id,
      iterationPrompt: r.iteration_prompt,
      model: r.model,
      stopReason: r.stop_reason,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export async function getPublicSavedEnrichment(
  id: string,
): Promise<PublicSavedEnrichment | null> {
  const exec = getDbExec();
  const result = await exec.execute({
    sql: `SELECT id,
                 source_url,
                 title,
                 parent_id,
                 root_id,
                 iteration_prompt,
                 deterministic_markdown,
                 enriched_markdown,
                 design_system_data_json,
                 signals_json,
                 screenshot_data_url,
                 model,
                 usage_json,
                 stop_reason,
                 created_at,
                 updated_at
          FROM fdmd_saved_enrichments
          WHERE id = ?`,
    args: [id],
  });
  const row = result.rows[0] as unknown as SavedEnrichmentRow | undefined;
  if (!row) return null;
  return toPublicSavedEnrichment(row);
}

export async function deleteSavedEnrichmentForOwner(
  id: string,
  ownerId: string,
): Promise<boolean> {
  const exec = getDbExec();
  const result = await exec.execute({
    sql: `DELETE FROM fdmd_saved_enrichments
          WHERE id = ? AND owner_id = ?`,
    args: [id, ownerId],
  });
  return Number(result.rowsAffected ?? 0) > 0;
}

function toPublicSavedEnrichment(
  row: SavedEnrichmentRow,
): PublicSavedEnrichment {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    title: row.title,
    parentId: row.parent_id,
    rootId: row.root_id,
    iterationPrompt: row.iteration_prompt,
    deterministicMarkdown: row.deterministic_markdown,
    enrichedMarkdown: row.enriched_markdown,
    designSystemData: parseJson(row.design_system_data_json, null),
    signals: parseJson(row.signals_json, {}),
    screenshotDataUrl: row.screenshot_data_url,
    model: row.model,
    usage: parseJson(row.usage_json, {}),
    stopReason: row.stop_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseJson(value: string, fallback: unknown): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function titleFromSignals(signals: unknown, sourceUrl: string): string {
  if (
    signals &&
    typeof signals === "object" &&
    "title" in signals &&
    typeof signals.title === "string" &&
    signals.title.trim()
  ) {
    return signals.title.trim();
  }
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return sourceUrl;
  }
}
