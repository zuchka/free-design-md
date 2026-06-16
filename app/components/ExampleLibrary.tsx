import { Link } from "react-router";
import type { ExampleDesignArtifact } from "@/lib/example-library";

interface ExampleCardGridProps {
  examples: ExampleDesignArtifact[];
  compact?: boolean;
  mutedCards?: boolean;
}

export function ExampleColorSwatches({
  example,
}: {
  example: ExampleDesignArtifact;
}) {
  const swatches = [
    example.data.colors.primary,
    example.data.colors.secondary,
    example.data.colors.accent,
    example.data.colors.surface,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-1.5" aria-label="Example colors">
      {swatches.map((color, index) => (
        <span
          key={`${color}-${index}`}
          className="size-5 rounded-full border border-border shadow-sm"
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
    </div>
  );
}

export function ExampleLogoMark({
  example,
  size = "md",
}: {
  example: ExampleDesignArtifact;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "size-14" : size === "sm" ? "size-9" : "size-11";
  const imgSizeClass =
    size === "lg"
      ? "max-h-8 max-w-8"
      : size === "sm"
        ? "max-h-5 max-w-5"
        : "max-h-6 max-w-6";

  return (
    <span
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-md border bg-background shadow-sm`}
      aria-hidden="true"
    >
      <img
        src={example.logoPath}
        alt=""
        className={`${imgSizeClass} object-contain`}
        loading="lazy"
      />
    </span>
  );
}

export function ExampleCardGrid({
  examples,
  compact = false,
  mutedCards = false,
}: ExampleCardGridProps) {
  return (
    <div
      className={
        compact
          ? "grid gap-3 sm:grid-cols-2"
          : "grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      }
    >
      {examples.map((example) => (
        <Link
          key={example.slug}
          to={`/examples/${example.slug}`}
          className={`group flex min-h-[210px] flex-col justify-between rounded-md border p-4 text-left no-underline transition-colors hover:border-primary/50 ${
            mutedCards
              ? "bg-secondary/25 hover:bg-secondary/35"
              : "bg-background hover:bg-secondary/35"
          }`}
        >
          <span className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 items-start gap-3">
              <ExampleLogoMark example={example} />
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wider text-primary">
                  {example.category}
                </span>
                <span className="mt-2 block text-lg font-semibold tracking-tight text-foreground">
                  {example.title}
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {example.domain}
                </span>
              </span>
            </span>
            <ExampleColorSwatches example={example} />
          </span>
          <span>
            <span className="mt-5 line-clamp-3 block text-sm leading-6 text-muted-foreground">
              {example.description}
            </span>
            <span className="mt-4 inline-flex items-center text-sm font-medium text-foreground">
              View artifact
              <span className="ml-1 transition-transform group-hover:translate-x-0.5">
                -&gt;
              </span>
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
