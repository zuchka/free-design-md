# free-design-md

Download a public or curated `design.md` from [Free design.md](https://github.com/zuchka/free-design-md) by ID, share URL, or catalog slug.

## Usage

```bash
npx free-design-md add <id-or-url-or-slug> [--out <path>] [--host https://...] [--force]
```

`<id-or-url-or-slug>` accepts a bare nanoid (e.g. `abc123xyz`), a full share URL (e.g. `https://freedesign.md/d/abc123xyz`), or a curated catalog slug (e.g. `stripe`, `linear.app`).

### Flags

- `--out <path>` — output file. Default is `<resolved-id>.design.md` in cwd, such as `stripe.design.md` or `linear.app.design.md`.
- `--host <url>` — override the host. Default reads `FREE_DESIGN_MD_HOST` env, then falls back to the bundled production host.
- `--force` — overwrite an existing file.

### Examples

```bash
npx free-design-md add abc123xyz
npx free-design-md add stripe
npx free-design-md add linear.app
npx free-design-md add linear.app --out specs/linear.md
npx free-design-md add https://freedesign.md/d/abc123xyz --out specs/stripe.md
FREE_DESIGN_MD_HOST=http://localhost:8080 npx free-design-md add abc123xyz
```
