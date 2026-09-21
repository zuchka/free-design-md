import { useCredits } from "@/lib/use-credits";
import PurchaseCreditsButton from "@/components/PurchaseCreditsButton";

export default function CreditsChip() {
  const { credits } = useCredits();
  const runLabel = credits
    ? `${credits.remaining} AI run${credits.remaining === 1 ? "" : "s"}`
    : "Buy AI runs";

  return (
    <PurchaseCreditsButton
      variant="outline"
      className="h-8 px-2.5 text-xs max-[479px]:size-8 max-[479px]:px-0"
      label={runLabel}
      compactOnMobile
    />
  );
}
