import { useCredits } from "@/lib/use-credits";
import PurchaseCreditsButton from "@/components/PurchaseCreditsButton";

export default function CreditsChip() {
  const { credits } = useCredits();
  return (
    <PurchaseCreditsButton
      variant="outline"
      className="h-8 px-2.5 text-xs"
      label={credits ? `${credits.remaining} credits` : "Buy credits"}
    />
  );
}
