export const DEFAULT_HOST = "https://freedesign.md";

export function resolveHost(flag: string | undefined): string {
  if (flag) return stripTrailingSlash(flag);
  const env = process.env.FREE_DESIGN_MD_HOST ?? process.env.FDMD_HOST;
  if (env) return stripTrailingSlash(env);
  return DEFAULT_HOST;
}

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}
