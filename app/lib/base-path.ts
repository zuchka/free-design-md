function normalizedBasePath(): string {
  const raw = import.meta.env.BASE_URL || "/";
  if (raw === "/") return "";
  return `/${raw.replace(/^\/+|\/+$/g, "")}`;
}

export function appBasePath(): string {
  return normalizedBasePath();
}

export function appPath(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${normalizedBasePath()}${path}`;
}
