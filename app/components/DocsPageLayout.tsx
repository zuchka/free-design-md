import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import {
  IconBook2,
  IconBraces,
  IconFileText,
  IconMarkdown,
} from "@tabler/icons-react";
import { DOCS_ARTICLES } from "@/lib/docs-content";
import { cn } from "@/lib/utils";

interface DocsPageLayoutProps {
  children: ReactNode;
  structuredData: unknown;
}

function docsLinkClass(isActive: boolean) {
  return cn(
    "flex items-start gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
    isActive
      ? "bg-primary/10 font-medium text-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

function articleIcon(intent: string) {
  if (intent === "Comparison") {
    return <IconBraces size={16} className="mt-0.5 shrink-0 text-primary" />;
  }

  if (intent === "Definition") {
    return <IconMarkdown size={16} className="mt-0.5 shrink-0 text-primary" />;
  }

  return <IconFileText size={16} className="mt-0.5 shrink-0 text-primary" />;
}

function DocsSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <aside className="min-w-0 border-b border-border bg-background lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:self-start lg:overflow-auto lg:border-b-0">
      <nav aria-label="Docs" className="px-4 py-4 lg:px-5 lg:py-8">
        <Link
          to="/docs"
          aria-current={currentPath === "/docs" ? "page" : undefined}
          className={docsLinkClass(currentPath === "/docs")}
        >
          <IconBook2 size={16} className="mt-0.5 shrink-0 text-primary" />
          <span>Overview</span>
        </Link>

        <div className="mt-5">
          <p className="px-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Guides
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {DOCS_ARTICLES.map((article) => {
              const isActive = currentPath === article.path;

              return (
                <Link
                  key={article.path}
                  to={article.path}
                  aria-current={isActive ? "page" : undefined}
                  className={docsLinkClass(isActive)}
                >
                  {articleIcon(article.intent)}
                  <span className="leading-5">{article.shortTitle}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </aside>
  );
}

export function DocsPageLayout({
  children,
  structuredData,
}: DocsPageLayoutProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <div className="grid w-full lg:grid-cols-[240px_minmax(0,1fr)]">
        <DocsSidebar />
        <div className="min-w-0 lg:border-l lg:border-border">{children}</div>
      </div>
    </main>
  );
}
