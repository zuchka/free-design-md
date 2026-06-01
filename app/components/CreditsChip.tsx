import { IconBolt } from "@tabler/icons-react";
import { useCredits } from "@/lib/use-credits";

export default function CreditsChip() {
  const { credits, keyStatus } = useCredits();
  if (!credits || !keyStatus || keyStatus.byoKeyConfigured) return null;

  const { remaining, allowed } = credits;
  const empty = remaining === 0;

  return (
    <span
      title={`${remaining} of ${allowed} AI iteration credits remaining`}
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold " +
        (empty
          ? "bg-muted text-muted-foreground"
          : "bg-amber-100 text-gray-900 dark:bg-amber-500/20 dark:text-amber-300")
      }
    >
      <IconBolt size={11} className="-mt-px" />
      {remaining} / {allowed}
    </span>
  );
}
