import {
  IconAlertCircle,
  IconCreditCard,
  IconKey,
  IconSparkles,
} from "@tabler/icons-react";
import BYOKeyForm from "@/components/BYOKeyForm";
import ShareCreditsUnlock from "@/components/ShareCreditsUnlock";
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
              ? "You've used your 3 free AI credits"
              : noApiKey
                ? "AI enrichment needs an Anthropic key"
                : "AI enrichment needs Builder Connect or a key"}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {outOfCredits
              ? "Post Free design.md once to unlock a one-time credit refill, or add your own Anthropic key to keep enriching and iterating without app credits."
              : noApiKey
                ? "This deployment does not have a server Anthropic key configured. Add your own key to run enrichment from this browser."
                : "Connect Builder.io for the trial quota, or add your own Anthropic key to run enrichment without spending app credits."}
          </p>

          <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
            <div className="flex gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <IconKey size={15} className="mt-0.5 shrink-0 text-foreground" />
              <span>
                BYO Anthropic works today and does not spend the 3-credit quota.
              </span>
            </div>
            <div className="flex gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <IconCreditCard
                size={15}
                className="mt-0.5 shrink-0 text-foreground"
              />
              <span>
                Plan-based credits are paused until Builder account metadata is
                reliable enough to use for grants.
              </span>
            </div>
          </div>
        </div>

        <div className="grid w-full gap-3 lg:w-[360px]">
          {outOfCredits && <ShareCreditsUnlock onResolved={onResolved} />}
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
              <IconSparkles size={14} />
              Continue with Anthropic
            </div>
            <BYOKeyForm onSaved={onResolved} />
          </div>
        </div>
      </div>
    </div>
  );
}
