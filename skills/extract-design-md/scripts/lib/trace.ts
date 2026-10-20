import { randomUUID } from "node:crypto";
import {
  extractionFailures,
  type ExtractionFailureCode,
  type ExtractionStage,
  type ExtractionWarning,
} from "./extraction-diagnostics.js";

export class ExtractionError extends Error {
  constructor(
    readonly code: ExtractionFailureCode,
    readonly stage: ExtractionStage,
    readonly upstreamStatus?: number,
  ) {
    super(extractionFailures[code].message);
    this.name = "ExtractionError";
  }
}

export function classifyExtractionError(
  error: unknown,
  stage: ExtractionStage,
): ExtractionError {
  if (error instanceof ExtractionError) return error;
  // Inspect raw errors only in memory. Playwright messages can contain URLs,
  // credentials and page text, so they must never reach logs or responses.
  const message = error instanceof Error ? error.message : String(error);
  let code: ExtractionFailureCode = "internal";
  if (/Internal\/private/.test(message)) code = "private_url";
  else if (/Invalid URL|Only http/.test(message)) code = "invalid_url";
  else if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND|EAI_AGAIN/.test(message))
    code = "dns";
  else if (/ERR_CERT_|ERR_SSL_|certificate/i.test(message)) code = "tls";
  else if (/Target.*closed|browser.*closed|crash/i.test(message))
    code = "browser_crash";
  else if (stage === "browser") code = "browser_unavailable";
  else if (/Timeout|timed out|ERR_TIMED_OUT/i.test(message)) code = "timeout";
  else if (
    /ERR_CONNECTION_|ERR_NETWORK_|ERR_EMPTY_RESPONSE|ECONNRESET|ECONNREFUSED|ERR_HTTP2_PROTOCOL_ERROR/.test(
      message,
    )
  )
    code = "connection";
  return new ExtractionError(code, stage);
}

export class ExtractionTrace {
  readonly requestId = randomUUID();
  readonly warnings: ExtractionWarning[] = [];
  readonly stages: Partial<Record<ExtractionStage, number>> = {};
  readonly retries: ExtractionFailureCode[] = [];
  readonly issues: { stage: ExtractionStage; code: ExtractionFailureCode }[] =
    [];
  stage: ExtractionStage = "validation";
  hostname: string | undefined;
  upstreamStatus: number | undefined;
  protected readonly startedAt = performance.now();

  constructor(
    private readonly onStage?: (
      stage: ExtractionStage,
      status: "success" | "error",
      seconds: number,
    ) => void,
  ) {}

  async run<T>(stage: ExtractionStage, fn: () => Promise<T> | T): Promise<T> {
    this.stage = stage;
    const startedAt = performance.now();
    let status: "success" | "error" = "success";
    try {
      return await fn();
    } catch (error) {
      status = "error";
      const failure = classifyExtractionError(error, stage);
      this.issues.push({ stage: failure.stage, code: failure.code });
      throw failure;
    } finally {
      const duration = performance.now() - startedAt;
      this.stages[stage] = (this.stages[stage] ?? 0) + Math.round(duration);
      this.onStage?.(stage, status, duration / 1000);
    }
  }

  warn(warning: ExtractionWarning) {
    if (!this.warnings.includes(warning)) this.warnings.push(warning);
  }
}
