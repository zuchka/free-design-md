import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import action from "../actions/extract-design-md.js";
import { renderPreview } from "../shared/preview-template.js";
import type { DesignSystemData } from "../shared/api.js";

const URLS = [
  "tailwindcss.com",
  "vercel.com",
  "stripe.com",
  "linear.app",
  "anthropic.com",
  "github.com",
  "news.ycombinator.com",
  "posthog.com",
  "notion.so",
  "supabase.com",
];

interface ExtractResult {
  url: string;
  designSystemData: DesignSystemData;
  markdown: string;
  signals: { title?: string };
}

interface RowData {
  host: string;
  url: string;
  result: ExtractResult | null;
  screenshotRelPath: string | null;
  error: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function screenshotSite(
  fullUrl: string,
  outputPath: string,
): Promise<boolean> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto(fullUrl, {
      waitUntil: "domcontentloaded",
      timeout: 10_000,
    });
    await page.waitForTimeout(1_500);
    await page.screenshot({ path: outputPath, fullPage: false });
    return true;
  } catch (err) {
    console.error(
      `screenshot failed for ${fullUrl}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return false;
  } finally {
    await browser.close();
  }
}

function renderRow(row: RowData): string {
  const titleHref = row.url.startsWith("http") ? row.url : `https://${row.url}`;

  const screenshotPanel = row.screenshotRelPath
    ? `<img class="screenshot" src="${escapeHtml(row.screenshotRelPath)}" alt="${escapeHtml(row.host)} screenshot">`
    : `<div class="empty">screenshot failed</div>`;

  let previewPanel: string;
  let markdownPanel: string;
  if (row.result) {
    const previewHtml = renderPreview(row.result.designSystemData, {
      title: row.result.signals?.title || row.host,
    });
    previewPanel = `<iframe class="preview" srcdoc="${escapeHtml(previewHtml)}" sandbox="allow-same-origin"></iframe>`;
    markdownPanel = `<pre class="markdown">${escapeHtml(row.result.markdown)}</pre>`;
  } else {
    previewPanel = `<div class="empty">extract failed</div>`;
    markdownPanel = `<pre class="markdown error">${escapeHtml(row.error || "extract failed")}</pre>`;
  }

  return `
<section class="row">
  <header class="row-head">
    <h2><a href="${escapeHtml(titleHref)}" target="_blank" rel="noopener">${escapeHtml(row.host)}</a></h2>
  </header>
  <div class="grid">
    <div class="panel"><div class="panel-label">Real site</div>${screenshotPanel}</div>
    <div class="panel"><div class="panel-label">Templated preview</div>${previewPanel}</div>
    <div class="panel"><div class="panel-label">design.md</div>${markdownPanel}</div>
  </div>
</section>`;
}

function renderReport(rows: string[]): string {
  const generatedAt = new Date().toISOString();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Fidelity Report</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #f7f7f7;
    color: #1a1a1a;
  }
  h1 { font-size: 22px; margin: 0 0 4px 0; }
  .meta { font-size: 13px; color: #666; margin-bottom: 32px; }
  .row {
    margin-bottom: 32px;
    background: #ffffff;
    border: 1px solid #e4e4e7;
    border-radius: 12px;
    overflow: hidden;
  }
  .row-head {
    padding: 14px 20px;
    background: #fafafa;
    border-bottom: 1px solid #e4e4e7;
  }
  .row-head h2 { margin: 0; font-size: 15px; font-weight: 600; }
  .row-head a { color: #2563eb; text-decoration: none; }
  .row-head a:hover { text-decoration: underline; }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0;
  }
  .panel {
    padding: 0;
    border-right: 1px solid #e4e4e7;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .panel:last-child { border-right: 0; }
  .panel-label {
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #71717a;
    background: #fafafa;
    border-bottom: 1px solid #e4e4e7;
  }
  .screenshot {
    width: 100%;
    height: auto;
    display: block;
  }
  .preview {
    width: 100%;
    height: 520px;
    border: 0;
    display: block;
    background: #fff;
  }
  .markdown {
    margin: 0;
    padding: 12px 14px;
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 11px;
    line-height: 1.5;
    background: #fafafa;
    color: #1a1a1a;
    white-space: pre-wrap;
    word-break: break-word;
    overflow: auto;
    max-height: 520px;
  }
  .markdown.error { color: #b91c1c; }
  .empty {
    padding: 32px;
    color: #71717a;
    font-size: 13px;
    text-align: center;
  }
  @media (max-width: 1200px) {
    .grid { grid-template-columns: 1fr; }
    .panel { border-right: 0; border-bottom: 1px solid #e4e4e7; }
    .panel:last-child { border-bottom: 0; }
  }
</style>
</head>
<body>
<h1>free-design-md — fidelity report</h1>
<div class="meta">Generated ${escapeHtml(generatedAt)} · ${rows.length} URLs</div>
${rows.join("\n")}
</body>
</html>
`;
}

async function main() {
  const outputDir = join(process.cwd(), "tools", "fidelity-output");
  const screenshotsDir = join(outputDir, "screenshots");
  mkdirSync(screenshotsDir, { recursive: true });

  const rows: string[] = [];

  for (const url of URLS) {
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
    const host = new URL(fullUrl).hostname;
    process.stdout.write(`${host}... `);

    let result: ExtractResult | null = null;
    let error = "";
    try {
      result = await (
        action as unknown as {
          run: (args: { url: string }) => Promise<ExtractResult>;
        }
      ).run({ url });
      process.stdout.write("extracted ");
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      process.stdout.write("extract-failed ");
    }

    const screenshotAbsPath = join(screenshotsDir, `${host}.png`);
    const screenshotOk = await screenshotSite(fullUrl, screenshotAbsPath);
    process.stdout.write(screenshotOk ? "screenshot\n" : "no-screenshot\n");

    rows.push(
      renderRow({
        host,
        url,
        result,
        screenshotRelPath: screenshotOk ? `screenshots/${host}.png` : null,
        error,
      }),
    );
  }

  const reportPath = join(outputDir, "report.html");
  writeFileSync(reportPath, renderReport(rows));
  console.log(`\nreport: ${reportPath}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
