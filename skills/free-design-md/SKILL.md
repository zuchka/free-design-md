---
name: free-design-md
description: Call the hosted Free design.md API to deterministically extract portable design.md artifacts from public website URLs. Use when Codex needs to generate, save, or download deterministic design.md, JSON extraction payloads, or MDX exports from a URL.
---

# Free design.md

## Overview

Call the hosted deterministic extraction API:

```text
GET https://freedesign.md/api/extract?url=<url>&format=<format>
```

The helper script lives at `scripts/free-design-md.mjs` relative to this skill folder. It has no local browser, Docker, API-key, or AI-enrichment behavior.

## Workflow

1. Find this skill folder and set `SKILL_DIR` to it.
2. Call the hosted API through the helper:

```bash
node "$SKILL_DIR/scripts/free-design-md.mjs" "https://stripe.com" --out design.md
```

3. Return the saved file path and format.

## Outputs

- `markdown` or `md`: raw deterministic `design.md` text. This is the default.
- `json`: full deterministic payload with `url`, `markdown`, `designSystemData`, `signals`, and `screenshotDataUrl`.
- `mdx`: deterministic MDX artifact with embedded preview.

## Examples

```bash
# design.md Markdown
node "$SKILL_DIR/scripts/free-design-md.mjs" "https://example.com" --out design.md

# Full extraction payload
node "$SKILL_DIR/scripts/free-design-md.mjs" "https://example.com" --format json --out extract.json

# MDX export
node "$SKILL_DIR/scripts/free-design-md.mjs" "https://example.com" --format mdx --out design.mdx
```

Options:

- `--out <path>` or `-o <path>`: Save output to a file instead of stdout.
- `--format markdown|json|mdx`: Select hosted deterministic API output.

## Agent Behavior

- Only call the hosted deterministic extraction API.
- Do not run Playwright, Docker, local servers, or AI enrichment.
- Save Markdown as `design.md`, JSON as `extract.json`, and MDX as `design.mdx` unless the user asks for another path.
- If the hosted API fails, report the status or error. Do not fabricate output.
