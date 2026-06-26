// TODO: replace with the canonical production host before the first npm publish.
export const DEFAULT_HOST = "https://free-design-md.com";

export function resolveHost(flag: string | undefined): string {
  if (flag) return stripTrailingSlash(flag);
  const env = process.env.FDMD_HOST;
  if (env) return stripTrailingSlash(env);
  return DEFAULT_HOST;
}

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}
