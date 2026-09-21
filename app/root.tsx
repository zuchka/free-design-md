import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NavBar from "@/components/NavBar";
import { CreditsProvider } from "@/lib/use-credits";
import FeedbackReporter from "@/components/FeedbackReporter";
import { appPath } from "@/lib/base-path";
import { authClient } from "@/lib/auth-client";
import type { LinksFunction } from "react-router";
import stylesheet from "./global.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
];

function isPublicContentPath(pathname: string): boolean {
  return (
    pathname.startsWith("/docs") ||
    pathname.startsWith("/examples") ||
    pathname === "/quality"
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
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
  const location = useLocation();
  if (isPublicContentPath(location.pathname)) {
    return (
      <>
        <NavBar />
        <Outlet />
        <PublicFeedbackRoot />
      </>
    );
  }

  return <ClientAppRoot />;
}

function PublicFeedbackRoot() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <FeedbackReporter />
    </QueryClientProvider>
  );
}

function ClientAppRoot() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <CreditsProvider>
            <AnonymousSessionBootstrap />
            <NavBar />
            <Outlet />
            <FeedbackReporter />
          </CreditsProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function AnonymousSessionBootstrap() {
  const session = authClient.useSession();
  useEffect(() => {
    if (!session.isPending && !session.data) {
      void authClient.signIn.anonymous({ query: {} });
    }
  }, [session.data, session.isPending]);
  return null;
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-2xl font-semibold">Unable to load this page</h1>
      <p className="mt-3 text-muted-foreground">{message}</p>
    </main>
  );
}
