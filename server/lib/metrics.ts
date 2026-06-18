import { getDbExec } from "@agent-native/core/db";

type LabelValue = string | number | boolean | null | undefined;
type Labels = Record<string, LabelValue>;

const DEFAULT_BUCKETS = [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60];

function nowSeconds(): number {
  return Date.now() / 1000;
}

function escapeHelp(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
}

function escapeLabel(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/"/g, '\\"');
}

function labelKey(labelNames: string[], labels: Labels): string {
  return labelNames
    .map((name) => `${name}:${String(labels[name] ?? "")}`)
    .join("|");
}

function labelsForNames(labelNames: string[], labels: Labels): Labels {
  return Object.fromEntries(
    labelNames.map((name) => [name, String(labels[name] ?? "")]),
  );
}

function renderLabels(labelNames: string[], labels: Labels): string {
  if (labelNames.length === 0) return "";
  const pairs = labelNames.map(
    (name) => `${name}="${escapeLabel(String(labels[name] ?? ""))}"`,
  );
  return `{${pairs.join(",")}}`;
}

function renderLabelsWithExtra(
  labelNames: string[],
  labels: Labels,
  extra: Labels,
): string {
  const mergedNames = [...labelNames, ...Object.keys(extra)];
  const merged = { ...labels, ...extra };
  return renderLabels(mergedNames, merged);
}

export function safeMetricLabel(value: unknown, fallback = "unknown"): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned ? cleaned.slice(0, 64) : fallback;
}

class CounterMetric {
  private readonly values = new Map<
    string,
    { labels: Labels; value: number }
  >();

  constructor(
    readonly name: string,
    readonly help: string,
    private readonly labelNames: string[],
  ) {}

  inc(labels: Labels, value = 1): void {
    const normalizedLabels = labelsForNames(this.labelNames, labels);
    const key = labelKey(this.labelNames, normalizedLabels);
    const current = this.values.get(key);
    if (current) {
      current.value += value;
      return;
    }
    this.values.set(key, { labels: normalizedLabels, value });
  }

  async record(labels: Labels, value = 1): Promise<void> {
    const normalizedLabels = labelsForNames(this.labelNames, labels);
    this.inc(normalizedLabels, value);
    try {
      await persistCounterIncrement(this, normalizedLabels, value);
    } catch (err) {
      logPersistentMetricsError(err);
    }
  }

  reset(): void {
    this.values.clear();
  }

  render(): string {
    const lines = [
      `# HELP ${this.name} ${escapeHelp(this.help)}`,
      `# TYPE ${this.name} counter`,
    ];
    for (const { labels, value } of this.values.values()) {
      lines.push(
        `${this.name}${renderLabels(this.labelNames, labels)} ${value}`,
      );
    }
    return lines.join("\n");
  }

  renderPersisted(rows: PersistedCounterRow[]): string {
    const lines = [
      `# HELP ${this.name} ${escapeHelp(this.help)}`,
      `# TYPE ${this.name} counter`,
    ];
    for (const { labels, value } of rows) {
      lines.push(
        `${this.name}${renderLabels(this.labelNames, labels)} ${value}`,
      );
    }
    return lines.join("\n");
  }
}

class HistogramMetric {
  private readonly values = new Map<
    string,
    { labels: Labels; buckets: number[]; count: number; sum: number }
  >();

  constructor(
    readonly name: string,
    readonly help: string,
    private readonly labelNames: string[],
    private readonly bucketBounds = DEFAULT_BUCKETS,
  ) {}

  observe(labels: Labels, value: number): void {
    const key = labelKey(this.labelNames, labels);
    let current = this.values.get(key);
    if (!current) {
      current = {
        labels,
        buckets: new Array(this.bucketBounds.length).fill(0),
        count: 0,
        sum: 0,
      };
      this.values.set(key, current);
    }
    current.count += 1;
    current.sum += value;
    for (let i = 0; i < this.bucketBounds.length; i += 1) {
      if (value <= this.bucketBounds[i]) {
        current.buckets[i] += 1;
      }
    }
  }

  reset(): void {
    this.values.clear();
  }

  render(): string {
    const lines = [
      `# HELP ${this.name} ${escapeHelp(this.help)}`,
      `# TYPE ${this.name} histogram`,
    ];
    for (const { labels, buckets, count, sum } of this.values.values()) {
      for (let i = 0; i < this.bucketBounds.length; i += 1) {
        lines.push(
          `${this.name}_bucket${renderLabelsWithExtra(this.labelNames, labels, {
            le: this.bucketBounds[i],
          })} ${buckets[i]}`,
        );
      }
      lines.push(
        `${this.name}_bucket${renderLabelsWithExtra(this.labelNames, labels, {
          le: "+Inf",
        })} ${count}`,
      );
      lines.push(
        `${this.name}_sum${renderLabels(this.labelNames, labels)} ${sum}`,
      );
      lines.push(
        `${this.name}_count${renderLabels(this.labelNames, labels)} ${count}`,
      );
    }
    return lines.join("\n");
  }
}

const extractRequests = new CounterMetric(
  "fdmd_extract_requests_total",
  "Deterministic design.md extraction requests by outcome.",
  ["status", "format"],
);

const extractDuration = new HistogramMetric(
  "fdmd_extract_duration_seconds",
  "Deterministic design.md extraction duration by outcome.",
  ["status"],
);

const enrichRequests = new CounterMetric(
  "fdmd_enrich_requests_total",
  "AI enrichment requests by outcome, key source, and quota handling.",
  ["status", "key_source", "quota"],
);

const iterateRequests = new CounterMetric(
  "fdmd_iterate_requests_total",
  "AI iteration requests by route, outcome, key source, and quota handling.",
  ["route", "status", "key_source", "quota"],
);

const aiStreamDuration = new HistogramMetric(
  "fdmd_ai_stream_duration_seconds",
  "AI stream request duration by route and outcome.",
  ["route", "status"],
);

const builderConnectResolutions = new CounterMetric(
  "fdmd_builder_connect_resolutions_total",
  "Builder Connect credential resolution attempts by outcome.",
  ["status", "org_kind"],
);

const quotaEvents = new CounterMetric(
  "fdmd_quota_events_total",
  "Hosted credit quota events by route.",
  ["route", "event"],
);

const designArtifactEvents = new CounterMetric(
  "fdmd_design_artifact_events_total",
  "Design artifact copy, download, share, and saved snapshot events.",
  ["action", "source", "variant", "format"],
);

const metrics = [
  extractRequests,
  extractDuration,
  enrichRequests,
  iterateRequests,
  aiStreamDuration,
  builderConnectResolutions,
  quotaEvents,
  designArtifactEvents,
];

const counterMetrics = [
  extractRequests,
  enrichRequests,
  iterateRequests,
  builderConnectResolutions,
  quotaEvents,
  designArtifactEvents,
];

const histogramMetrics = [extractDuration, aiStreamDuration];

interface PersistedCounterRow {
  labels: Labels;
  value: number;
}

interface RawCounterRow {
  name: string;
  labels_json: string;
  value: number | bigint;
}

let ensureCountersTablePromise: Promise<void> | null = null;
let loggedPersistentMetricsError = false;

async function ensurePersistentCountersTable(): Promise<void> {
  if (!ensureCountersTablePromise) {
    ensureCountersTablePromise = (async () => {
      const exec = getDbExec();
      await exec.execute({
        sql: `CREATE TABLE IF NOT EXISTS fdmd_metric_counters (
          name TEXT NOT NULL,
          label_key TEXT NOT NULL,
          labels_json TEXT NOT NULL,
          value INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (name, label_key)
        )`,
        args: [],
      });
    })().catch((err) => {
      ensureCountersTablePromise = null;
      throw err;
    });
  }
  await ensureCountersTablePromise;
}

function logPersistentMetricsError(err: unknown): void {
  if (loggedPersistentMetricsError) return;
  loggedPersistentMetricsError = true;
  console.warn("[metrics] persistent counter write failed", err);
}

async function persistCounterIncrement(
  metric: CounterMetric,
  labels: Labels,
  value: number,
): Promise<void> {
  await ensurePersistentCountersTable();
  const exec = getDbExec();
  const key = labelKey(Object.keys(labels), labels);
  await exec.execute({
    sql: `INSERT INTO fdmd_metric_counters (name, label_key, labels_json, value)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(name, label_key) DO UPDATE SET
            labels_json = excluded.labels_json,
            value = fdmd_metric_counters.value + excluded.value,
            updated_at = datetime('now')`,
    args: [metric.name, key, JSON.stringify(labels), value],
  });
}

async function loadPersistedCounters(): Promise<
  Map<string, PersistedCounterRow[]>
> {
  await ensurePersistentCountersTable();
  const names = counterMetrics.map((metric) => metric.name);
  const placeholders = names.map(() => "?").join(", ");
  const exec = getDbExec();
  const result = await exec.execute({
    sql: `SELECT name, labels_json, value
          FROM fdmd_metric_counters
          WHERE name IN (${placeholders})
          ORDER BY name, label_key`,
    args: names,
  });
  const rowsByMetric = new Map<string, PersistedCounterRow[]>();
  for (const row of result.rows as unknown as RawCounterRow[]) {
    let labels: Labels;
    try {
      labels = JSON.parse(row.labels_json) as Labels;
    } catch {
      continue;
    }
    const rows = rowsByMetric.get(row.name) ?? [];
    rows.push({
      labels,
      value: typeof row.value === "bigint" ? Number(row.value) : row.value,
    });
    rowsByMetric.set(row.name, rows);
  }
  return rowsByMetric;
}

async function resetPersistedCountersForTests(): Promise<void> {
  try {
    await ensurePersistentCountersTable();
    const exec = getDbExec();
    await exec.execute({
      sql: `DELETE FROM fdmd_metric_counters`,
      args: [],
    });
  } catch {
    // Some unit tests import metrics before the framework DB is available.
    // In-memory reset still keeps those tests isolated.
  }
}

export function metricsStartedAt(): number {
  return nowSeconds();
}

export function keySourceLabel(source: string | null | undefined): string {
  if (source === "server") return "hosted_server";
  if (source === "self-host") return "self_hosted_env";
  return "none";
}

export function recordExtractRequest(input: {
  status: string;
  format: "json" | "markdown" | "mdx" | "invalid";
  startedAt: number;
}): Promise<void> {
  const status = safeMetricLabel(input.status);
  const duration = Math.max(0, nowSeconds() - input.startedAt);
  extractDuration.observe({ status }, duration);
  return extractRequests.record({ status, format: input.format });
}

export function recordEnrichRequest(input: {
  status: string;
  keySource: string;
  quota: string;
  startedAt: number;
}): Promise<void> {
  const status = safeMetricLabel(input.status);
  const labels = {
    status,
    key_source: safeMetricLabel(input.keySource, "none"),
    quota: safeMetricLabel(input.quota, "not_applicable"),
  };
  aiStreamDuration.observe(
    { route: "enrich", status },
    Math.max(0, nowSeconds() - input.startedAt),
  );
  return enrichRequests.record(labels);
}

export function recordIterateRequest(input: {
  route: "iterate" | "saved_iterate";
  status: string;
  keySource: string;
  quota: string;
  startedAt: number;
}): Promise<void> {
  const status = safeMetricLabel(input.status);
  const route = safeMetricLabel(input.route);
  const labels = {
    route,
    status,
    key_source: safeMetricLabel(input.keySource, "none"),
    quota: safeMetricLabel(input.quota, "not_applicable"),
  };
  aiStreamDuration.observe(
    { route, status },
    Math.max(0, nowSeconds() - input.startedAt),
  );
  return iterateRequests.record(labels);
}

export function recordBuilderConnectResolution(input: {
  status: "connected" | "missing_credentials" | "error";
  orgKind?: string | null;
}): Promise<void> {
  return builderConnectResolutions.record({
    status: input.status,
    org_kind: safeMetricLabel(input.orgKind, "unknown"),
  });
}

export function recordQuotaEvent(input: {
  route: "enrich" | "iterate" | "saved_iterate";
  event: "decremented" | "exhausted" | "refunded";
}): Promise<void> {
  return quotaEvents.record({ route: input.route, event: input.event });
}

export function recordDesignArtifactEvent(input: {
  action: string;
  source: string;
  variant: string;
  format: string;
}): Promise<void> {
  return designArtifactEvents.record({
    action: safeMetricLabel(input.action),
    source: safeMetricLabel(input.source),
    variant: safeMetricLabel(input.variant),
    format: safeMetricLabel(input.format),
  });
}

export async function renderPrometheusMetrics(): Promise<string> {
  let renderedCounters: string[];
  try {
    const rowsByMetric = await loadPersistedCounters();
    renderedCounters = counterMetrics.map((metric) =>
      metric.renderPersisted(rowsByMetric.get(metric.name) ?? []),
    );
  } catch {
    renderedCounters = counterMetrics.map((metric) => metric.render());
  }
  const rendered = [
    ...renderedCounters,
    ...histogramMetrics.map((metric) => metric.render()),
  ].join("\n\n");
  return `${rendered}\n`;
}

export function resetInMemoryMetricsForTests(): void {
  for (const metric of metrics) metric.reset();
}

export async function resetMetricsForTests(): Promise<void> {
  resetInMemoryMetricsForTests();
  await resetPersistedCountersForTests();
}
