import { useState } from "react";
import { IconBolt, IconCheck, IconCreditCard } from "@tabler/icons-react";
import { authClient } from "@/lib/auth-client";
import MagicLinkSignInForm from "@/components/MagicLinkSignInForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  AI_RUN_PACK,
  AI_RUN_PACKS,
  getAiRunPack,
  type AiRunPackId,
} from "../../shared/billing";

interface PurchaseCreditsButtonProps {
  variant?: "default" | "outline" | "ghost";
  className?: string;
  label?: string;
  compactOnMobile?: boolean;
}

export default function PurchaseCreditsButton({
  variant = "default",
  className,
  label = `Buy ${AI_RUN_PACK.name} — ${AI_RUN_PACK.priceLabel}`,
  compactOnMobile = false,
}: PurchaseCreditsButtonProps) {
  const session = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<AiRunPackId>(
    AI_RUN_PACK.id,
  );
  const sessionData = session.data as unknown as {
    user: { email: string; isAnonymous?: boolean | null };
  } | null;
  const signedIn = Boolean(sessionData && !sessionData.user.isAnonymous);
  const selectedPack = getAiRunPack(selectedPackId) ?? AI_RUN_PACK;

  async function beginCheckout() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: selectedPack.id }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Could not start checkout.");
      }
      window.location.assign(result.url);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Could not start checkout.",
      );
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        <IconBolt size={15} />
        <span
          className={compactOnMobile ? "hidden min-[480px]:inline" : undefined}
        >
          {label}
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buy AI runs</DialogTitle>
            <DialogDescription>
              Each run enriches a design.md or revises it with AI. Deterministic
              URL extraction stays free, and purchased runs do not expire.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 sm:grid-cols-2" aria-label="AI run packs">
            {AI_RUN_PACKS.map((pack) => {
              const selected = pack.id === selectedPack.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    "relative grid gap-2 rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50",
                  )}
                  onClick={() => setSelectedPackId(pack.id)}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-foreground">
                      {pack.name}
                    </span>
                    {selected && (
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <IconCheck />
                      </span>
                    )}
                  </span>
                  <span className="text-2xl font-semibold tracking-tight text-foreground">
                    {pack.priceLabel}
                  </span>
                  <span className="text-xs leading-5 text-muted-foreground">
                    {pack.description}
                  </span>
                </button>
              );
            })}
          </div>

          {signedIn ? (
            <div className="rounded-md border bg-muted/30 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <IconCreditCard size={17} />
                One-time purchase through Stripe
              </div>
              <p className="mt-2 text-muted-foreground">
                Your AI runs will be attached to {sessionData?.user.email}.
              </p>
            </div>
          ) : (
            <MagicLinkSignInForm
              label="Sign in to keep your AI runs"
              sentMessage="Open the link in this browser, then return here to finish your purchase."
            />
          )}

          {error && (
            <p
              id="credit-email-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            {signedIn && (
              <Button type="button" disabled={pending} onClick={beginCheckout}>
                <IconCreditCard size={16} />
                {pending
                  ? "Opening Stripe…"
                  : `Buy ${selectedPack.name} for ${selectedPack.priceLabel}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
