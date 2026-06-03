import {
  IconAlertCircle,
  IconArrowUpRight,
  IconCreditCard,
  IconKey,
  IconSparkles,
} from "@tabler/icons-react";
import BYOKeyForm from "@/components/BYOKeyForm";
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
              ? "Free Builder credits are used up"
              : noApiKey
                ? "AI enrichment needs an Anthropic key"
                : "AI enrichment needs Builder Connect or a key"}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {outOfCredits
              ? "Free Builder accounts include 3 AI credits here. Upgrade Builder to a paid plan for unlimited AI enrichment and iteration, or add your own Anthropic key to continue without app credits."
              : noApiKey
                ? "This deployment does not have a server Anthropic key configured. Add your own key to run enrichment from this browser."
                : "Connect Builder.io to unlock credits. Paid and Enterprise Builder accounts get unlimited AI enrichment; free accounts get 3 credits."}
          </p>

          <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
            <div className="flex gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <IconKey size={15} className="mt-0.5 shrink-0 text-foreground" />
              <span>
                BYO Anthropic works today and never spends Builder credits.
              </span>
            </div>
            <div className="flex gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <IconCreditCard
                size={15}
                className="mt-0.5 shrink-0 text-foreground"
              />
              <span>
                Builder paid and Enterprise accounts use app-hosted AI without a
                credit cap.
              </span>
            </div>
          </div>
        </div>

        <div className="w-full rounded-md border bg-muted/20 p-3 lg:w-[360px]">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
            <IconSparkles size={14} />
            Continue now
          </div>
          <BYOKeyForm onSaved={onResolved} />
          <a
            href="https://builder.io/pricing"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            Upgrade Builder
            <IconArrowUpRight size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}
