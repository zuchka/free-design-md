# fdmd

Download a public `design.md` from [Free design.md](https://github.com/zuchka/free-design-md) by ID.

## Usage

```bash
npx fdmd add <id-or-url> [--out design.md] [--host https://...] [--force]
```

`<id-or-url>` accepts either the bare nanoid (e.g. `abc123xyz`) or the full share URL (e.g. `https://free-design-md.com/d/abc123xyz`).

### Flags

- `--out <path>` — output file. Default `design.md` in cwd.
- `--host <url>` — override the host. Default reads `FDMD_HOST` env, then falls back to the bundled production host.
- `--force` — overwrite an existing file.

### Examples

```bash
npx fdmd add abc123xyz
npx fdmd add https://free-design-md.com/d/abc123xyz --out specs/stripe.md
FDMD_HOST=http://localhost:8080 npx fdmd add abc123xyz
```
