import {
  data,
  Form,
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useNavigation,
  useRouteError,
  type LoaderFunctionArgs,
} from "react-router";
import {
  IconArrowDown,
  IconArrowUp,
  IconDownload,
  IconChartLine,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requireAnalyticsAdmin } from "../../server/lib/analytics-admin.js";
import {
  getCachedGrowthReport,
  reportOptions,
  type GrowthReport,
} from "../../server/lib/analytics-queries.js";
import { analyticsHeaders } from "../../server/lib/analytics-http.js";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAnalyticsAdmin(request);
  const options = reportOptions(new URL(request.url));
  try {
    return data(
      { report: await getCachedGrowthReport(options), options, error: null },
      { headers: analyticsHeaders },
    );
  } catch {
    return data(
      {
        report: null,
        options,
        error:
          "Analytics is unavailable. Check the database connection and migrations, then retry.",
      },
      { status: 503, headers: analyticsHeaders },
    );
  }
}
export function meta() {
  return [
    { title: "Growth analytics — Free design.md" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}
const number = (value: number) => value.toLocaleString("en-US");
const percent = (part: number, total: number) =>
  total ? `${((part / total) * 100).toFixed(1)}%` : "—";
const date = (value: string) => value.slice(0, 10);

export default function AnalyticsDashboard() {
  const { report, options, error } = useLoaderData<typeof loader>();
  const busy = useNavigation().state !== "idle";
  const query = new URLSearchParams({
    start: date(options.start),
    end: date(options.end),
    identity: options.identity,
    source: options.source,
    format: "csv",
  });
  return (
    <main
      className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-8"
      aria-busy={busy}
    >
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Private / Growth
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Is useful work becoming a habit?
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Creators, repeat use, and purchases across Free design.md. Anonymous
            browsers and verified accounts are deduplicated when linked.
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href={`/api/admin/analytics?${query}`}>
            <IconDownload />
            Export CSV
          </a>
        </Button>
      </header>
      <Form
        method="get"
        className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
      >
        <label className="grid gap-2 text-xs font-medium">
          From · UTC
          <Input
            name="start"
            type="date"
            defaultValue={date(options.start)}
            required
          />
        </label>
        <label className="grid gap-2 text-xs font-medium">
          Until · exclusive, UTC
          <Input
            name="end"
            type="date"
            defaultValue={date(options.end)}
            required
          />
        </label>
        <div className="grid gap-2">
          <label htmlFor="identity-filter" className="text-xs font-medium">
            Identity
          </label>
          <Select name="identity" defaultValue={options.identity}>
            <SelectTrigger id="identity-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All identities</SelectItem>
                <SelectItem value="anonymous">Anonymous browsers</SelectItem>
                <SelectItem value="account">Verified accounts</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <label htmlFor="source-filter" className="text-xs font-medium">
            Event source
          </label>
          <Select name="source" defaultValue={options.source}>
            <SelectTrigger id="source-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {["all", "browser", "api", "direct", "historical"].map(
                  (value) => (
                    <SelectItem key={value} value={value}>
                      {value === "all"
                        ? "All sources"
                        : value === "direct"
                          ? "CLI / direct"
                          : value}
                    </SelectItem>
                  ),
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="self-end" disabled={busy}>
          {busy ? "Updating…" : "Apply dates"}
        </Button>
      </Form>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 p-6"
        >
          <h2 className="font-semibold">Report unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      ) : (
        report && <Report report={report} />
      )}
    </main>
  );
}
function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="grid gap-2 border-l-2 border-primary/40 pl-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-4xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
function Report({ report: r }: { report: GrowthReport }) {
  const change = r.overview.previous
    ? ((r.overview.active - r.overview.previous) / r.overview.previous) * 100
    : null;
  const traffic = r.coverage.reduce(
    (a, row) => ({
      events: a.events + row.events,
      attributed: a.attributed + row.attributed,
    }),
    { events: 0, attributed: 0 },
  );
  const partial =
    !r.collectionStartedAt ||
    r.collectionStartedAt > r.options.start ||
    r.retainedFrom > r.options.start;
  return (
    <>
      {(!r.enabled || partial) && (
        <div
          role="status"
          className="rounded-lg border border-border bg-muted/30 px-5 py-4 text-sm"
        >
          <strong>
            {!r.enabled
              ? "Collection is disabled. "
              : "Partial historical coverage. "}
          </strong>
          {r.collectionStartedAt
            ? `Activity collection began ${date(r.collectionStartedAt)}. Event history is retained from ${date(r.retainedFrom)}. Earlier free activity is unknown; billing history may extend further back.`
            : "No live product activity has been collected yet. Enable collection after applying the migration; historical free activity cannot be reconstructed."}
        </div>
      )}
      <section
        className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Growth overview"
      >
        <Stat
          label="Active creators · selected period"
          value={number(r.overview.active)}
          detail={`${number(r.overview.anonymous)} anonymous · ${number(r.overview.verified)} verified`}
        />
        <Stat
          label="Newly observed creators"
          value={number(r.overview.new)}
          detail={`${number(r.overview.returning)} returning creators`}
        />
        <Stat
          label="Active creators · trailing 30 days"
          value={number(r.overview.rolling30)}
          detail={`${number(r.overview.rolling7)} in 7 days · ${number(r.overview.rolling1)} in 24 hours`}
        />
        <Stat
          label="Visit → export · mature cohorts"
          value={percent(
            r.activation.matureExported,
            r.activation.matureVisitors,
          )}
          detail={`${number(r.activation.matureExported)} of ${number(r.activation.matureVisitors)} observed visitors`}
        />
      </section>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {change !== null &&
        !partial &&
        r.collectionStartedAt! <= r.overview.previousStart &&
        r.retainedFrom <= r.overview.previousStart ? (
          <>
            {change >= 0 ? (
              <IconArrowUp className="size-4 text-primary" />
            ) : (
              <IconArrowDown className="size-4" />
            )}
            <strong className="text-foreground">
              {Math.abs(change).toFixed(1)}% {change >= 0 ? "more" : "fewer"}{" "}
              active creators
            </strong>
          </>
        ) : (
          <strong>Growth comparison unavailable</strong>
        )}
        <span>
          versus {date(r.overview.previousStart)}–{date(r.overview.previousEnd)}
          . All times UTC.
        </span>
      </div>
      <Section
        title="Activity over time"
        description="A creator completed an extraction or paid AI run, or exported their own generated artifact. Daily counts are never added to calculate monthly users."
      >
        <ActivityChart rows={r.daily} />
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-4">
          {r.monthly.map((row) => (
            <p key={row.month} className="text-sm">
              <span className="text-muted-foreground">{row.month} MAU </span>
              <strong className="tabular-nums">{number(row.active)}</strong>
            </p>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          MAU covers each full calendar month; the current month is provisional.
          Creator metrics always require browser product activity.
        </p>
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="From visit to usable artifact"
          description="Ordered actions within seven days of a first observed visit; exports must match the extraction."
        >
          <Funnel
            rows={[
              ["Observed visitors", r.activation.visitors],
              ["Successful extraction", r.activation.extracted],
              ["Copied or downloaded", r.activation.exported],
            ]}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            {r.activation.openVisitors} visitors still have an open conversion
            window. Separately, {r.activation.exportingExtractors} of{" "}
            {r.activation.successfulExtractors} successful extractors exported
            within seven days (provisional).
          </p>
        </Section>
        <Section
          title="From first use to first purchase"
          description="First creator activity → observed verification → first fulfilled purchase, within 30 days."
        >
          <Funnel
            rows={[
              ["Newly active creators", r.purchaseFunnel.activated],
              ["Verified after activation", r.purchaseFunnel.verified],
              ["First fulfilled purchase", r.purchaseFunnel.purchased],
            ]}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            {r.purchaseFunnel.open} creator windows remain open.{" "}
            {r.purchaseFunnel.fulfilledCheckouts} of{" "}
            {r.purchaseFunnel.checkouts} checkouts fulfilled within seven days;{" "}
            {r.purchaseFunnel.openCheckouts} windows remain open.{" "}
            {r.purchaseFunnel.directPurchasers} purchasers had no observed prior
            activation.
          </p>
        </Section>
      </div>
      <Section
        title="Do creators return?"
        description="First-use cohorts returning in the following calendar week or month. Incomplete follow-up windows are pending."
      >
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "Cohort (UTC)",
                "Period",
                "Creators",
                "Returned",
                "Retention",
              ].map((t) => (
                <TableHead key={t}>{t}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.retention.map((row) => (
              <TableRow key={`${row.period}:${row.cohort}`}>
                <TableCell>{date(row.cohort)}</TableCell>
                <TableCell>{row.period}</TableCell>
                <TableCell>{number(row.size)}</TableCell>
                <TableCell>{row.mature ? number(row.retained) : "—"}</TableCell>
                <TableCell className="font-semibold">
                  {row.mature ? percent(row.retained, row.size) : "Pending"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!r.retention.length && (
          <Empty text="Retention appears after the first creators are observed. A full follow-up period is needed to measure returns." />
        )}
      </Section>
      <Section
        title="Where useful visits come from"
        description="First observed campaign source or external referring hostname. Retention here is activity 7–14 days after the first visit; purchases use a 30-day window."
      >
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "Source",
                "Visitors",
                "Activated ≤7d",
                "Week-two retention",
                "Purchased ≤30d",
              ].map((t) => (
                <TableHead key={t}>{t}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.acquisition.map((row) => (
              <TableRow key={row.channel}>
                <TableCell className="max-w-60 truncate font-medium">
                  {row.channel}
                </TableCell>
                <TableCell>{number(row.visitors)}</TableCell>
                <TableCell>{number(row.active)}</TableCell>
                <TableCell>
                  {percent(row.retained, row.retentionEligible)}
                </TableCell>
                <TableCell>{number(row.purchasers)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!r.acquisition.length && (
          <Empty text="No attributed visits in this period. Missing referrers are recorded as unknown." />
        )}
      </Section>
      <Section
        title="Purchases and gross receipts"
        description="Fulfilled purchases from the billing ledger, by currency. Includes Checkout discounts and any tax; cash refunds/disputes are not deducted. First-time buyers can also repurchase in this period. Event-source filters do not filter the billing ledger."
      >
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "Currency",
                "Packs",
                "Purchasers",
                "First-time",
                "Repeat purchasers",
                "Gross receipts",
              ].map((t) => (
                <TableHead key={t}>{t}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.sales.map((row) => (
              <TableRow key={row.currency}>
                <TableCell className="uppercase">{row.currency}</TableCell>
                <TableCell>{number(row.purchases)}</TableCell>
                <TableCell>{number(row.purchasers)}</TableCell>
                <TableCell>{number(row.firstTime)}</TableCell>
                <TableCell>{number(row.repeat)}</TableCell>
                <TableCell className="font-semibold">
                  {money(row.amountMinor, row.currency)}
                  {row.missingAmounts > 0 && (
                    <span className="ml-2 text-xs font-normal">
                      ({row.missingAmounts} amounts missing)
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!r.sales.length && (
          <Empty text="No fulfilled purchases in this period." />
        )}
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Performance alongside growth"
          description="Durations stored with completed operations, including failures. Values are in seconds."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Outcome</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Median</TableHead>
                <TableHead>p95</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.performance.map((row) => (
                <TableRow key={row.name}>
                  <TableCell>{row.name.replace(/_/g, " ")}</TableCell>
                  <TableCell>{number(row.count)}</TableCell>
                  <TableCell>
                    {row.p50 === null ? "—" : (row.p50 / 1000).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {row.p95 === null ? "—" : (row.p95 / 1000).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!r.performance.length && (
            <Empty text="No completed operation timings in this period." />
          )}
        </Section>
        <Section
          title="Measurement coverage"
          description={`${percent(traffic.attributed, traffic.events)} of stored events have an identity. Unattributed requests never become invented users.`}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source / audience</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Attributed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.coverage.map((row) => (
                <TableRow key={`${row.source}:${row.audience}`}>
                  <TableCell>
                    {row.source} / {row.audience}
                  </TableCell>
                  <TableCell>{number(row.events)}</TableCell>
                  <TableCell>{number(row.attributed)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-4 text-xs text-muted-foreground">
            This server process: {r.processHealth.dropped} dropped/timed-out
            writes, {r.processHealth.failed} failures since restart. These are
            not historical fleet totals. Last maintenance:{" "}
            {r.lastMaintenanceAt ? date(r.lastMaintenanceAt) : "not run"}.
          </p>
        </Section>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Anonymous browsers are an estimate of people. Cleared cookies, unlinked
        devices, and account changes can split one person. Verified linking can
        revise recent history. Examples, other people’s public artifacts,
        automation, internal accounts, and failed attempts do not qualify as
        creators. Data before collection began is unknown. Definition v1 · As of{" "}
        {r.options.asOf}.
      </p>
    </>
  );
}
function Funnel({ rows }: { rows: [string, number][] }) {
  return (
    <ol className="grid gap-4">
      {rows.map(([label, value], i) => (
        <li key={label} className="grid gap-2">
          <div className="flex justify-between gap-3 text-sm">
            <span>
              <span className="mr-3 text-muted-foreground">0{i + 1}</span>
              {label}
            </span>
            <strong className="tabular-nums">{number(value)}</strong>
          </div>
          <progress
            aria-label={label}
            value={value}
            max={Math.max(1, rows[0][1])}
            className="h-1.5 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
          />
        </li>
      ))}
    </ol>
  );
}
function ActivityChart({ rows }: { rows: GrowthReport["daily"] }) {
  const max = Math.max(1, ...rows.map((r) => r.active));
  const points = rows
    .map(
      (r, i) =>
        `${20 + (i * 760) / Math.max(1, rows.length - 1)},${165 - (r.active / max) * 140}`,
    )
    .join(" ");
  return (
    <div>
      <svg
        viewBox="0 0 800 190"
        role="img"
        aria-label={`Daily active creators, peak ${max}`}
        className="h-44 w-full text-primary sm:h-56"
      >
        <line x1="20" x2="780" y1="165" y2="165" className="stroke-border" />
        <line
          x1="20"
          x2="780"
          y1="95"
          y2="95"
          className="stroke-border"
          strokeDasharray="3 5"
        />
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <text x="20" y="185" className="fill-muted-foreground text-[10px]">
          {rows[0]?.day}
        </text>
        <text
          x="780"
          y="185"
          textAnchor="end"
          className="fill-muted-foreground text-[10px]"
        >
          {rows[rows.length - 1]?.day}
        </text>
        <text x="20" y="15" className="fill-muted-foreground text-[10px]">
          {max} creators
        </text>
      </svg>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Daily values</summary>
        <div className="mt-3 max-h-44 overflow-auto">
          <Table>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.day}>
                  <TableCell>{row.day}</TableCell>
                  <TableCell>{row.active} active creators</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </details>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="py-6 text-sm text-muted-foreground">{text}</p>;
}
function money(amount: number, currency: string) {
  try {
    const format = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    });
    const digits = format.resolvedOptions().maximumFractionDigits || 0;
    return format.format(amount / 10 ** digits);
  } catch {
    return `${number(amount)} minor units`;
  }
}
export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-6 py-20">
      <IconChartLine className="size-8 text-primary" />
      <h1 className="text-2xl font-semibold">
        {isRouteErrorResponse(error) && error.status === 403
          ? "Analytics access required"
          : "Unable to load analytics"}
      </h1>
      <p className="text-muted-foreground">
        {isRouteErrorResponse(error)
          ? String(error.data)
          : "Please retry after checking database availability."}
      </p>
      <Button variant="outline" asChild>
        <Link to="/">Back to workspace</Link>
      </Button>
    </main>
  );
}
