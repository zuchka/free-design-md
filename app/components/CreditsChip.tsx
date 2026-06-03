import { IconBolt, IconInfinity } from "@tabler/icons-react";
import { useCredits } from "@/lib/use-credits";

export default function CreditsChip() {
  const { credits, keyStatus } = useCredits();
  if (!credits || !keyStatus) return null;
  if (keyStatus.byoKeyConfigured && !credits.unlimited) return null;

  if (credits.unlimited) {
    const plan = credits.planLabel ?? "paid Builder";
    return (
      <span
        title={`${plan} account: unlimited AI enrichment and iteration`}
        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
      >
        <IconInfinity size={11} className="-mt-px" />
        Unlimited
      </span>
    );
  }

  const { remaining, allowed } = credits;
  const empty = remaining === 0;
  if (remaining == null || allowed == null) return null;

  return (
    <span
      title={`${remaining} of ${allowed} AI iteration credits remaining`}
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold " +
        (empty
          ? "bg-muted text-muted-foreground"
          : "bg-amber-100 text-gray-950 dark:bg-amber-100 dark:text-gray-950")
      }
    >
      <IconBolt size={11} className="-mt-px" />
      {remaining} / {allowed}
    </span>
  );
}
