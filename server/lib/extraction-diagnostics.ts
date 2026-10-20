import { recordGrowthEvent } from "./analytics.js";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  ExtractionTrace as CoreExtractionTrace,
  ExtractionError,
  classifyExtractionError,
} from "../../skills/extract-design-md/scripts/lib/trace.js";
export {
  ExtractionError,
  classifyExtractionError,
} from "../../skills/extract-design-md/scripts/lib/trace.js";
import {
  recordExtractionResult,
  recordExtractionRecovery,
  recordExtractionStage,
  currentActionMetricCaller,
} from "./metrics.js";
import {
  extractionHistoryUrl,
  recordExtractionHistory,
} from "./extraction-history.js";

export class ExtractionTrace extends CoreExtractionTrace {
  private url: string | null = null;

  constructor() {
    super(recordExtractionStage);
  }

  setUrl(input: unknown) {
    this.url = extractionHistoryUrl(input);
  }

  async finish(error?: ExtractionError) {
    const status = error ? "error" : "success";
    const reason = error?.code ?? "none";
    const stage = error?.stage ?? "complete";
    const durationMs = Math.round(performance.now() - this.startedAt);
    // Only allowlisted fields: no full URLs, paths, queries, user IDs, page
    // content, raw messages or stack traces. Hostnames stay in private logs.
    process.stderr.write(
      JSON.stringify({
        event: "extraction.completed",
        requestId: this.requestId,
        hostname: this.hostname,
        status,
        reason,
        stage,
        upstreamStatus: error?.upstreamStatus ?? this.upstreamStatus,
        durationMs,
        stagesMs: this.stages,
        retries: this.retries,
        warnings: this.warnings,
        issues: this.issues,
      }) + "\n",
    );
    await recordExtractionResult({
      status,
      reason,
      stage,
      retried: this.retries.length > 0,
    });
    await recordGrowthEvent({
      name: error ? "extraction_failed" : "extraction_succeeded",
      key: `extraction:${this.requestId}:completed`,
      artifactId: this.requestId,
      durationMs,
      properties: {
        reason,
        stage,
        stagesMs: this.stages,
        retries: this.retries,
        warnings: this.warnings,
      },
    });
    await recordExtractionHistory({
      requestId: this.requestId,
      url: this.url,
      caller: currentActionMetricCaller(),
      status,
      code: reason,
      stage,
      durationMs,
      upstreamStatus: error?.upstreamStatus ?? this.upstreamStatus ?? null,
      retried: this.retries.length > 0,
    });
    for (const retry of this.retries)
      await recordExtractionRecovery("retry", retry);
    for (const warning of this.warnings)
      await recordExtractionRecovery("warning", warning);
  }
}

const storage = new AsyncLocalStorage<ExtractionTrace>();

export async function withExtractionTrace<T>(
  fn: (trace: ExtractionTrace) => Promise<T>,
  trace = new ExtractionTrace(),
): Promise<T> {
  const existing = storage.getStore();
  if (existing) return fn(existing);
  return storage.run(trace, async () => {
    let failure: ExtractionError | undefined;
    try {
      return await fn(trace);
    } catch (error) {
      failure = classifyExtractionError(error, trace.stage);
      throw failure;
    } finally {
      await trace.finish(failure);
    }
  });
}
