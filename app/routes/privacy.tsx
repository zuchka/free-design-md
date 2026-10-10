import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  ensureAnalyticsVisitor,
  resetAnalyticsVisitor,
} from "@/lib/growth-analytics";

export function meta() {
  return [{ title: "Privacy and analytics — Free design.md" }];
}
export default function Privacy() {
  const [message, setMessage] = useState("");
  async function choose(value: "on" | "off") {
    document.cookie = `fdmd_analytics_choice=${value}; Path=/; SameSite=Lax; Max-Age=15552000${location.protocol === "https:" ? "; Secure" : ""}`;
    resetAnalyticsVisitor();
    await ensureAnalyticsVisitor();
    setMessage(
      value === "off"
        ? "Product analytics is off in this browser. Free extraction and sign-in still work."
        : "Your preference is saved. Collection also respects browser privacy signals and the site's analytics settings.",
    );
  }
  return (
    <main className="mx-auto grid max-w-3xl gap-7 px-6 py-14">
      <div className="grid gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Privacy / Product analytics
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Choose how your usage is measured.
        </h1>
        <p className="text-muted-foreground">
          Free extraction does not require a tracking cookie or a verified
          account.
        </p>
      </div>
      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">What we measure</h2>
        <p>
          When enabled, a random first-party browser identifier connects visits,
          extraction outcomes and timings, exports, and account verification. If
          you verify an account in this browser, its earlier anonymous activity
          may be linked to that account. This helps us measure active creators,
          repeat use, and conversion.
        </p>
        <p>
          Product analytics does not store your email, submitted website URL,
          prompts, page content, auth tokens, or IP address. We may record an
          external referring hostname and campaign source, medium, and name.
          Payment records remain in the billing system.
        </p>
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">Your browser preference</h2>
        <p>
          Opting out stops identity-linked product analytics. It does not remove
          functional sign-in cookies, billing records, or aggregate
          service-health counters. We also honor Global Privacy Control and Do
          Not Track signals.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void choose("off")}>
            Turn analytics off
          </Button>
          <Button onClick={() => void choose("on")}>
            Allow product analytics
          </Button>
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">Retention and access</h2>
        <p>
          The analytics browser cookie lasts up to 180 days and refreshes during
          use. Event history is retained for up to 13 months, with cleanup
          performed by the maintenance job. First-observed dates and
          account-link metadata remain while an identity has retained activity
          or an unexpired visitor cookie; inactive, unreferenced identities are
          then removed. The growth dashboard is restricted to explicitly
          allowed, verified accounts. Separate protected extraction diagnostics
          retain sanitized submitted URLs for 30 days; analytics preferences do
          not disable those service diagnostics.
        </p>
        <p>
          Anonymous browser counts estimate people: private browsing, cleared
          cookies, and unlinked devices can produce separate identities.
        </p>
      </section>
      <Link
        to="/"
        className="text-sm text-primary underline underline-offset-4"
      >
        Return to the workspace
      </Link>
    </main>
  );
}
