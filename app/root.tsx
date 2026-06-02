import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AgentSidebar,
  ClientOnly,
  DefaultSpinner,
  appPath,
  configureTracking,
  getThemeInitScript,
} from "@agent-native/core/client";
import { ThemeProvider } from "next-themes";
import NavBar from "@/components/NavBar";
import { CreditsProvider } from "@/lib/use-credits";
import AgentActivityRail from "@/components/AgentActivityRail";
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

const THEME_INIT_SCRIPT = getThemeInitScript("light", true);

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
        <meta name="theme-color" content="#236cff" />
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
  const [queryClient] = useState(() => new QueryClient());
  return (
    <ClientOnly fallback={<DefaultSpinner />}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <CreditsProvider>
              <NavBar />
              <AgentSidebar
                position="right"
                emptyStateText="Paste a URL above and click Enrich with AI — then use the page's Ask for a change box to iterate. I can answer questions about the loaded design.md."
                suggestions={[
                  "What are the dominant colors?",
                  "Summarize the typography system",
                  "Which components did we capture?",
                  "What should I change in the iteration box?",
                ]}
              >
                <Outlet />
              </AgentSidebar>
              <AgentActivityRail />
            </CreditsProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ClientOnly>
  );
}

export { ErrorBoundary } from "@agent-native/core/client";
