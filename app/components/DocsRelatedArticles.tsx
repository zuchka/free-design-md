import { Link } from "react-router";
import { IconArrowRight } from "@tabler/icons-react";
import { getRelatedDocs } from "@/lib/docs-content";

interface DocsRelatedArticlesProps {
  currentPath: string;
}

export function DocsRelatedArticles({ currentPath }: DocsRelatedArticlesProps) {
  const related = getRelatedDocs(currentPath);

  if (related.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-border bg-background">
      <div className="px-6 py-14">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Related docs
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
            Keep reading
          </h2>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {related.map((article) => (
            <Link
              key={article.path}
              to={article.path}
              className="group rounded-lg border bg-background p-5 transition-colors hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-primary">
                    {article.intent}
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-foreground">
                    {article.title}
                  </h3>
                </div>
                <IconArrowRight
                  size={18}
                  className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {article.summary}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
