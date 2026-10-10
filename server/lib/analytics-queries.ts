import { getDbExec, type DbExecutor } from "../db/client.js";
import { analyticsEnabled, analyticsHealth } from "./analytics-db.js";

export interface ReportOptions {
  start: string;
  end: string;
  asOf: string;
  identity: "all" | "anonymous" | "account";
  source: "all" | "browser" | "api" | "direct" | "historical";
}
export function reportOptions(url: URL, now = new Date()): ReportOptions {
  const currentMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const previousMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const parse = (value: string | null, fallback: Date) => {
    if (!value) return fallback;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new Response("Use YYYY-MM-DD dates", { status: 400 });
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value)
      throw new Response("Invalid date", { status: 400 });
    return date;
  };
  const start = parse(url.searchParams.get("start"), previousMonth);
  const end = parse(url.searchParams.get("end"), currentMonth);
  if (+end <= +start || +end - +start > 397 * 86400000 || +start > +now)
    throw new Response("Choose a date range of 1–397 days", { status: 400 });
  const identity = url.searchParams.get("identity") || "all";
  const source = url.searchParams.get("source") || "all";
  if (
    !["all", "anonymous", "account"].includes(identity) ||
    !["all", "browser", "api", "direct", "historical"].includes(source)
  )
    throw new Response("Invalid filter", { status: 400 });
  return {
    start: start.toISOString(),
    end: new Date(Math.min(+end, +now)).toISOString(),
    asOf: now.toISOString(),
    identity: identity as ReportOptions["identity"],
    source: source as ReportOptions["source"],
  };
}

export interface GrowthReport {
  enabled: boolean;
  available: boolean;
  options: ReportOptions;
  collectionStartedAt: string | null;
  retainedFrom: string;
  lastMaintenanceAt: string | null;
  processHealth: typeof analyticsHealth;
  overview: {
    active: number;
    new: number;
    returning: number;
    anonymous: number;
    verified: number;
    rolling1: number;
    rolling7: number;
    rolling30: number;
    previous: number;
    previousStart: string;
    previousEnd: string;
  };
  daily: { day: string; active: number; events: number }[];
  monthly: { month: string; active: number }[];
  retention: {
    period: "week" | "month";
    cohort: string;
    size: number;
    retained: number;
    mature: boolean;
  }[];
  activation: {
    visitors: number;
    extracted: number;
    exported: number;
    matureVisitors: number;
    matureExported: number;
    openVisitors: number;
    successfulExtractors: number;
    exportingExtractors: number;
  };
  purchaseFunnel: {
    activated: number;
    verified: number;
    purchased: number;
    open: number;
    checkouts: number;
    fulfilledCheckouts: number;
    openCheckouts: number;
    directPurchasers: number;
  };
  acquisition: {
    channel: string;
    visitors: number;
    active: number;
    retained: number;
    retentionEligible: number;
    purchasers: number;
  }[];
  sales: {
    currency: string;
    purchases: number;
    purchasers: number;
    firstTime: number;
    repeat: number;
    amountMinor: number;
    missingAmounts: number;
  }[];
  coverage: {
    source: string;
    audience: string;
    events: number;
    attributed: number;
  }[];
  performance: {
    name: string;
    count: number;
    p50: number | null;
    p95: number | null;
  }[];
}
type DatabaseReport = Omit<
  GrowthReport,
  "enabled" | "available" | "options" | "processHealth"
>;

// All reports resolve aliases at query time. A later verified link therefore
// deduplicates past months as well as current activity without rewriting events.
export const growthReportSql = `WITH
 params AS (SELECT $1::timestamptz AS start_at,$2::timestamptz AS end_at,$3::timestamptz AS as_of),
 bounds AS (SELECT *,
   CASE WHEN start_at=date_trunc('month',start_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AND end_at<=start_at+interval '1 month'
     THEN start_at-interval '1 month' ELSE start_at-(end_at-start_at) END AS previous_start,
   CASE WHEN start_at=date_trunc('month',start_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AND end_at<=start_at+interval '1 month'
     THEN CASE WHEN end_at=start_at+interval '1 month' THEN start_at ELSE least(start_at,(start_at-interval '1 month')+(end_at-start_at)) END ELSE start_at END AS previous_end
   FROM params),
 events AS MATERIALIZED (
   SELECT e.*,coalesce(i.canonical_id,i.id) AS person,c.kind,c.user_id,c.first_active_at,c.first_visited_at,coalesce(c.internal,false) AS is_internal
   FROM app.analytics_events e LEFT JOIN app.analytics_identities i ON i.id=e.identity_id
   LEFT JOIN app.analytics_identities c ON c.id=coalesce(i.canonical_id,i.id), params p
   WHERE e.occurred_at<p.as_of AND e.occurred_at>=p.as_of-interval '13 months'
     AND ($4='all' OR c.kind=$4) AND ($5='all' OR e.source=$5)

 ),
 creators AS MATERIALIZED (
   SELECT * FROM events WHERE person IS NOT NULL AND source='browser' AND audience='product' AND NOT is_internal
   AND name IN ('extraction_succeeded','ai_succeeded','artifact_copied','artifact_downloaded')
 ),
 people AS (SELECT person,min(first_active_at) AS first_at,max(kind) AS kind FROM creators GROUP BY person),
 period_people AS (SELECT DISTINCT person,kind FROM creators,bounds WHERE occurred_at>=start_at AND occurred_at<end_at),
 visits AS (SELECT person,min(coalesce(first_visited_at,occurred_at)) AS visited FROM events WHERE source='browser' AND person IS NOT NULL
   AND audience NOT IN ('internal','bot') AND NOT is_internal AND name='page_viewed' GROUP BY person),
 artifact_exports AS MATERIALIZED (
   SELECT x.person,x.artifact_id,x.occurred_at AS extracted,min(d.occurred_at) AS exported
   FROM creators x LEFT JOIN creators d ON d.person=x.person AND d.artifact_id=x.artifact_id
     AND d.name IN ('artifact_copied','artifact_downloaded') AND d.occurred_at>=x.occurred_at AND d.occurred_at<x.occurred_at+interval '7 days'
   WHERE x.name='extraction_succeeded' GROUP BY x.person,x.artifact_id,x.occurred_at
 ),
 visitor_funnel AS (
   SELECT v.person,v.visited,min(a.extracted) AS extracted,
     min(a.exported) FILTER(WHERE a.exported<v.visited+interval '7 days') AS exported
   FROM visits v LEFT JOIN artifact_exports a ON a.person=v.person AND a.extracted>=v.visited AND a.extracted<v.visited+interval '7 days'
   GROUP BY v.person,v.visited
 ),
 checkouts AS (SELECT p.* FROM app.purchases p LEFT JOIN app.analytics_identities i ON i.user_id=p.owner_id
   WHERE NOT coalesce(i.internal,false) AND ($4 IN ('all','account'))),
 purchases AS MATERIALIZED (
   SELECT p.*,i.id AS person,(p.fulfilled_at::timestamp AT TIME ZONE 'UTC') AS paid_at,
     min(p.fulfilled_at::timestamp AT TIME ZONE 'UTC') OVER(PARTITION BY p.owner_id) AS first_paid,
     row_number() OVER(PARTITION BY p.owner_id ORDER BY p.fulfilled_at,p.id) AS purchase_number
   FROM app.purchases p LEFT JOIN app.analytics_identities i ON i.user_id=p.owner_id
   WHERE p.status='fulfilled' AND p.fulfilled_at::timestamp AT TIME ZONE 'UTC'<(SELECT as_of FROM params) AND NOT coalesce(i.internal,false) AND ($4 IN ('all','account'))
 ),
 verifications AS (
   SELECT p.person,p.first_at,min(e.occurred_at) AS verified FROM people p LEFT JOIN events e
     ON e.person=p.person AND e.name='account_verified' AND e.occurred_at>=p.first_at AND e.occurred_at<p.first_at+interval '30 days'
   GROUP BY p.person,p.first_at
 ),
 buyer_funnel AS (
   SELECT v.person,v.first_at,v.verified,min(p.paid_at) AS paid FROM verifications v LEFT JOIN purchases p
     ON p.person=v.person AND p.paid_at>=v.verified AND p.paid_at<v.first_at+interval '30 days' AND p.paid_at=p.first_paid
   GROUP BY v.person,v.first_at,v.verified
 ),
 visitor_activity AS (
   SELECT v.person,v.visited,bool_or(c.occurred_at<v.visited+interval '7 days') AS active,
     bool_or(c.occurred_at>=v.visited+interval '7 days' AND c.occurred_at<v.visited+interval '14 days') AS retained
   FROM visits v LEFT JOIN creators c ON c.person=v.person AND c.occurred_at>=v.visited AND c.occurred_at<v.visited+interval '14 days'
   GROUP BY v.person,v.visited
 ),
 visitor_purchases AS (
   SELECT v.person,min(p.paid_at) AS purchased FROM visits v LEFT JOIN purchases p
     ON p.person=v.person AND p.paid_at>=v.visited AND p.paid_at<v.visited+interval '30 days'
   GROUP BY v.person
 ),
 activity_periods AS (
   SELECT DISTINCT person,'week' AS period,date_trunc('week',occurred_at) AS period_at FROM creators
   UNION ALL SELECT DISTINCT person,'month',date_trunc('month',occurred_at) FROM creators
 ),
 cohorts AS (
   SELECT 'week' AS period,date_trunc('week',first_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS cohort,person FROM people
   UNION ALL SELECT 'month',date_trunc('month',first_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',person FROM people
 ),
 retention AS (
   SELECT c.period,c.cohort,count(*) AS size,count(a.person) AS retained,
     c.cohort+CASE WHEN c.period='week' THEN interval '2 weeks' ELSE interval '2 months' END <= (SELECT as_of FROM params) AS mature
   FROM cohorts c LEFT JOIN activity_periods a ON a.person=c.person AND a.period=c.period
     AND a.period_at=c.cohort+CASE WHEN c.period='week' THEN interval '1 week' ELSE interval '1 month' END
   GROUP BY c.period,c.cohort
 ),
 daily_activity AS (SELECT date_trunc('day',occurred_at) AS day,count(DISTINCT person) AS active,count(*) AS events FROM creators,bounds WHERE occurred_at>=start_at AND occurred_at<end_at GROUP BY 1),
 monthly_activity AS (SELECT date_trunc('month',occurred_at) AS month,count(DISTINCT person) AS active FROM creators GROUP BY 1),
 channels AS (
   SELECT DISTINCT ON (coalesce(i.canonical_id,i.id)) coalesce(i.canonical_id,i.id) AS person,
     coalesce(nullif(v.attribution->>'source',''),nullif(v.attribution->>'referrer',''),'unknown') AS channel
   FROM app.analytics_visitors v JOIN app.analytics_identities i ON i.id=v.identity_id ORDER BY coalesce(i.canonical_id,i.id),v.created_at
 )
 SELECT json_build_object(
 'retainedFrom',(SELECT as_of-interval '13 months' FROM params),
 'collectionStartedAt',(SELECT collection_started_at FROM app.analytics_state WHERE id),
 'lastMaintenanceAt',(SELECT last_maintenance_at FROM app.analytics_state WHERE id),
 'overview',(SELECT json_build_object(
   'active',(SELECT count(*) FROM period_people),
   'new',(SELECT count(*) FROM period_people p JOIN people f USING(person) WHERE f.first_at>=b.start_at),
   'returning',(SELECT count(*) FROM period_people p JOIN people f USING(person) WHERE f.first_at<b.start_at),
   'anonymous',(SELECT count(*) FROM period_people WHERE kind='anonymous'),
   'verified',(SELECT count(*) FROM period_people WHERE kind='account'),
   'rolling1',(SELECT count(DISTINCT person) FROM creators WHERE occurred_at>=b.as_of-interval '24 hours'),
   'rolling7',(SELECT count(DISTINCT person) FROM creators WHERE occurred_at>=b.as_of-interval '7 days'),
   'rolling30',(SELECT count(DISTINCT person) FROM creators WHERE occurred_at>=b.as_of-interval '30 days'),
   'previous',(SELECT count(DISTINCT person) FROM creators WHERE occurred_at>=b.previous_start AND occurred_at<b.previous_end),
   'previousStart',b.previous_start,'previousEnd',b.previous_end) FROM bounds b),
 'daily',coalesce((SELECT json_agg(x ORDER BY day) FROM (
   SELECT to_char(day,'YYYY-MM-DD') AS day,coalesce(c.active,0) AS active,coalesce(c.events,0) AS events
   FROM bounds,generate_series(date_trunc('day',start_at),end_at-interval '1 microsecond',interval '1 day') day
   LEFT JOIN daily_activity c USING(day)) x),'[]'),
 'monthly',coalesce((SELECT json_agg(x ORDER BY month) FROM (
   SELECT to_char(month,'YYYY-MM') AS month,coalesce(c.active,0) AS active
   FROM bounds,generate_series(date_trunc('month',start_at),end_at-interval '1 microsecond',interval '1 month') month
   LEFT JOIN monthly_activity c USING(month)) x),'[]'),
 'retention',coalesce((SELECT json_agg(r ORDER BY cohort,period) FROM retention r,bounds WHERE cohort>=date_trunc(r.period,start_at) AND cohort<end_at),'[]'),
 'activation',(SELECT json_build_object(
   'visitors',count(person),'extracted',count(extracted),'exported',count(exported),
   'matureVisitors',count(person) FILTER(WHERE visited+interval '7 days'<=as_of),
   'matureExported',count(exported) FILTER(WHERE visited+interval '7 days'<=as_of),
   'openVisitors',count(person) FILTER(WHERE visited+interval '7 days'>as_of),
   'successfulExtractors',(SELECT count(DISTINCT c.person) FROM creators c,bounds WHERE c.name='extraction_succeeded' AND c.occurred_at>=start_at AND c.occurred_at<end_at),
   'exportingExtractors',(SELECT count(DISTINCT person) FROM artifact_exports,bounds WHERE extracted>=start_at AND extracted<end_at AND exported IS NOT NULL)
   ) FROM bounds LEFT JOIN visitor_funnel ON visited>=start_at AND visited<end_at GROUP BY start_at,end_at,as_of),
 'purchaseFunnel',(SELECT json_build_object(
   'activated',count(person),'verified',count(verified),'purchased',count(paid),
   'open',count(person) FILTER(WHERE first_at+interval '30 days'>as_of),
   'checkouts',(SELECT count(*) FROM checkouts p WHERE p.created_at::timestamp AT TIME ZONE 'UTC'>=start_at AND p.created_at::timestamp AT TIME ZONE 'UTC'<end_at),
   'fulfilledCheckouts',(SELECT count(*) FROM purchases p WHERE p.created_at::timestamp AT TIME ZONE 'UTC'>=start_at AND p.created_at::timestamp AT TIME ZONE 'UTC'<end_at AND paid_at<p.created_at::timestamp AT TIME ZONE 'UTC'+interval '7 days'),
   'openCheckouts',(SELECT count(*) FROM checkouts p WHERE p.created_at::timestamp AT TIME ZONE 'UTC'>=start_at AND p.created_at::timestamp AT TIME ZONE 'UTC'<end_at AND p.created_at::timestamp AT TIME ZONE 'UTC'+interval '7 days'>as_of),
   'directPurchasers',(SELECT count(DISTINCT owner_id) FROM purchases p WHERE paid_at>=start_at AND paid_at<end_at AND NOT EXISTS(SELECT 1 FROM people WHERE person=p.person AND first_at<=p.paid_at))
   ) FROM bounds LEFT JOIN buyer_funnel ON first_at>=start_at AND first_at<end_at GROUP BY start_at,end_at,as_of),
 'acquisition',coalesce((SELECT json_agg(x ORDER BY visitors DESC) FROM (
   SELECT coalesce(ch.channel,'unknown') AS channel,count(DISTINCT v.person) AS visitors,
     count(DISTINCT v.person) FILTER(WHERE v.active) AS active,
     count(DISTINCT v.person) FILTER(WHERE v.visited+interval '14 days'<=b.as_of) AS "retentionEligible",
     count(DISTINCT v.person) FILTER(WHERE v.visited+interval '14 days'<=b.as_of AND v.retained) AS retained,
     count(DISTINCT v.person) FILTER(WHERE p.purchased IS NOT NULL) AS purchasers
   FROM visitor_activity v LEFT JOIN channels ch USING(person) LEFT JOIN visitor_purchases p USING(person),bounds b
   WHERE v.visited>=b.start_at AND v.visited<b.end_at GROUP BY coalesce(ch.channel,'unknown')) x),'[]'),
 'sales',coalesce((SELECT json_agg(x ORDER BY currency) FROM (
   SELECT coalesce(currency,'unknown') AS currency,count(*) AS purchases,count(DISTINCT owner_id) AS purchasers,
    count(DISTINCT owner_id) FILTER(WHERE first_paid>=start_at) AS "firstTime",
    count(DISTINCT owner_id) FILTER(WHERE purchase_number>1) AS repeat,
    coalesce(sum(amount_total),0) AS "amountMinor",count(*) FILTER(WHERE amount_total IS NULL) AS "missingAmounts"
   FROM purchases,bounds WHERE paid_at>=start_at AND paid_at<end_at GROUP BY currency) x),'[]'),
 'coverage',coalesce((SELECT json_agg(x) FROM (
   SELECT source,audience,count(*) AS events,count(person) AS attributed FROM events,bounds WHERE occurred_at>=start_at AND occurred_at<end_at GROUP BY source,audience) x),'[]'),
 'performance',coalesce((SELECT json_agg(x) FROM (
   SELECT name,count(*) AS count,percentile_cont(0.5) WITHIN GROUP(ORDER BY duration_ms) AS p50,
    percentile_cont(0.95) WITHIN GROUP(ORDER BY duration_ms) AS p95 FROM events,bounds
   WHERE occurred_at>=start_at AND occurred_at<end_at AND duration_ms IS NOT NULL GROUP BY name) x),'[]')
 ) AS report`;

export async function getGrowthReport(
  options: ReportOptions,
  db: DbExecutor = getDbExec(),
): Promise<GrowthReport> {
  const result = await db.transaction(async (tx) => {
    await tx.execute("SET LOCAL TIME ZONE 'UTC'");
    await tx.execute("SET LOCAL statement_timeout = '5s'");
    return tx.execute<{ report: DatabaseReport }>({
      sql: growthReportSql,
      args: [
        options.start,
        options.end,
        options.asOf,
        options.identity,
        options.source,
      ],
    });
  });
  return {
    ...result.rows[0].report,
    enabled: analyticsEnabled(),
    available: true,
    options,
    processHealth: { ...analyticsHealth },
  };
}
export function growthReportCsv(report: GrowthReport) {
  const rows: unknown[][] = [
    ["section", "period_or_segment", "metric", "value"],
  ];
  for (const [key, value] of Object.entries({
    ...report.options,
    collectionStartedAt: report.collectionStartedAt,
    retainedFrom: report.retainedFrom,
    lastMaintenanceAt: report.lastMaintenanceAt,
    definitionVersion: 1,
  }))
    rows.push(["metadata", "", key, value]);
  for (const [key, value] of Object.entries(report.overview))
    rows.push(["overview", report.options.start, key, value]);
  for (const row of report.monthly)
    rows.push(["monthly", row.month, "active_creators", row.active]);
  for (const row of report.retention)
    for (const metric of ["size", "retained", "mature"] as const)
      rows.push([`retention_${row.period}`, row.cohort, metric, row[metric]]);
  for (const section of [
    "daily",
    "acquisition",
    "sales",
    "coverage",
    "performance",
  ] as const)
    for (const row of report[section])
      for (const [key, value] of Object.entries(row))
        rows.push([section, Object.values(row)[0], key, value]);
  for (const section of ["activation", "purchaseFunnel"] as const)
    for (const [key, value] of Object.entries(report[section]))
      rows.push([section, report.options.start, key, value]);
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

// Cache only aggregates, after per-request authorization. Bounded and process-local.
const reports = new Map<
  string,
  { expires: number; value: Promise<GrowthReport> }
>();
export function getCachedGrowthReport(
  options: ReportOptions,
): Promise<GrowthReport> {
  const key = JSON.stringify([
    options.start,
    options.end.slice(0, 10),
    options.identity,
    options.source,
  ]);
  const current = reports.get(key);
  if (current && current.expires > Date.now()) return current.value;
  if (reports.size >= 16) reports.delete(reports.keys().next().value!);
  const value = getGrowthReport(options).catch((error) => {
    reports.delete(key);
    throw error;
  });
  reports.set(key, { expires: Date.now() + 30000, value });
  return value;
}
