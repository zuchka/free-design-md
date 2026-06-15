import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ExampleCardGrid } from "@/components/ExampleLibrary";
import { EXAMPLE_DESIGNS } from "@/lib/example-library";

export function meta() {
  return [
    { title: "Free design.md Examples: Curated Design System Artifacts" },
    {
      name: "description",
      content:
        "Browse curated deterministic and AI-enriched design.md examples for public websites, then generate a fresh design.md from any URL with Free design.md.",
    },
  ];
}

export default function ExamplesIndexRoute() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b bg-muted/25">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-14">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Free example library
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Curated design.md artifacts for agent workflows.
            </h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Start with curated examples seeded from public websites. Each
              artifact includes deterministic and AI-enriched design.md views,
              a token preview, and a small source-site mark for identification.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/">Extract a new URL</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/docs/api-and-cli">Use the API</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Browse {EXAMPLE_DESIGNS.length} examples
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Mix of Fortune 500, commerce, marketplace, and developer-platform
              patterns with deterministic and AI-enriched outputs.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Brand marks identify source sites only. No affiliation or
            endorsement implied.
          </p>
        </div>
        <ExampleCardGrid examples={EXAMPLE_DESIGNS} />
      </section>
    </main>
  );
}
