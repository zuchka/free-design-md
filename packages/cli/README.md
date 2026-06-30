# fdmd

Download a public or curated `design.md` from [Free design.md](https://github.com/zuchka/free-design-md) by ID, share URL, or catalog slug.

## Usage

```bash
npx fdmd add <id-or-url-or-slug> [--out design.md] [--host https://...] [--force]
```

`<id-or-url-or-slug>` accepts a bare nanoid (e.g. `abc123xyz`), a full share URL (e.g. `https://free-design-md.com/d/abc123xyz`), or a curated catalog slug (e.g. `stripe`, `linear.app`).

### Flags

- `--out <path>` — output file. Default `design.md` in cwd.
- `--host <url>` — override the host. Default reads `FDMD_HOST` env, then falls back to the bundled production host.
- `--force` — overwrite an existing file.

### Examples

```bash
npx fdmd add abc123xyz
npx fdmd add stripe
npx fdmd add linear.app --out specs/linear.md
npx fdmd add https://free-design-md.com/d/abc123xyz --out specs/stripe.md
FDMD_HOST=http://localhost:8080 npx fdmd add abc123xyz
```
