import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ClientOnly,
  DefaultSpinner,
  appPath,
  configureTracking,
  getThemeInitScript,
} from "@agent-native/core/client";
import { ThemeProvider } from "next-themes";
import type { LinksFunction } from "react-router";
import stylesheet from "./global.css?url";

configureTracking({
  getDefaultProps: (_name, properties) => ({
    ...properties,
    app: "free-design-md",
  }),
});

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
];

const THEME_INIT_SCRIPT = getThemeInitScript("dark", true);

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <link rel="icon" type="image/svg+xml" href={appPath("/favicon.svg")} />
        <link rel="manifest" href={appPath("/manifest.json")} />
        <meta name="theme-color" content="#EC4899" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Free design.md" />
        <link rel="apple-touch-icon" href={appPath("/icon-180.svg")} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return (
    <ClientOnly fallback={<DefaultSpinner />}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider>
          <Outlet />
        </TooltipProvider>
      </ThemeProvider>
    </ClientOnly>
  );
}

export { ErrorBoundary } from "@agent-native/core/client";
