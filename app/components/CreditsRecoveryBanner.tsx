import { IconAlertCircle, IconCreditCard, IconSparkles } from "@tabler/icons-react";
import PurchaseCreditsButton from "@/components/PurchaseCreditsButton";
import type { AiAccessRecoveryReason } from "@/lib/ai-access-errors";

interface CreditsRecoveryBannerProps {
  reason: AiAccessRecoveryReason;
  onResolved?: () => void;
}

export default function CreditsRecoveryBanner({
  reason,
  onResolved,
}: CreditsRecoveryBannerProps) {
  const outOfCredits = reason === "out_of_credits";
  const noApiKey = reason === "no_api_key_available";

  return (
    <div className="mb-3 rounded-md border border-border bg-background p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconAlertCircle size={16} />
            </span>
            {outOfCredits
              ? "You're out of AI credits"
              : noApiKey
                ? "AI enrichment is not configured"
                : "Sign in to use AI enrichment"}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {outOfCredits
              ? "Buy another pack to keep enriching and revising design.md files."
              : noApiKey
                ? "This deployment does not have a server Anthropic key configured. A local or self-hosted deployment can set ANTHROPIC_API_KEY in the environment."
                : "Sign in with your email, then buy a pack of 10 AI extractions. The hosted service does not accept user Anthropic keys."}
          </p>

          <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
            <div className="flex gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <IconSparkles
                size={15}
                className="mt-0.5 shrink-0 text-foreground"
              />
              <span>
                Hosted AI runs on Free design.md credits, never user-supplied
                Anthropic keys.
              </span>
            </div>
            <div className="flex gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <IconCreditCard
                size={15}
                className="mt-0.5 shrink-0 text-foreground"
              />
              <span>
                Credits are sold as simple one-time packs through Stripe. No
                subscription is required.
              </span>
            </div>
          </div>
        </div>

        <div className="grid w-full gap-3 lg:w-[360px]">
          {!noApiKey && <PurchaseCreditsButton className="w-full" />}
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
              <IconSparkles size={14} />
              Local use
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              To use your own Anthropic key, run Free design.md locally or
              self-host it with ANTHROPIC_API_KEY in the environment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
