import { useState } from "react";
import { IconBolt, IconCreditCard, IconMail } from "@tabler/icons-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AI_RUN_PACK } from "../../shared/billing";

interface PurchaseCreditsButtonProps {
  variant?: "default" | "outline" | "ghost";
  className?: string;
  label?: string;
}

export default function PurchaseCreditsButton({
  variant = "default",
  className,
  label = `Buy ${AI_RUN_PACK.name} — ${AI_RUN_PACK.priceLabel}`,
}: PurchaseCreditsButtonProps) {
  const session = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionData = session.data as unknown as {
    user: { email: string; isAnonymous?: boolean | null };
  } | null;
  const signedIn = Boolean(sessionData && !sessionData.user.isAnonymous);

  async function sendSignInLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setPending(true);
    setError(null);
    const result = await authClient.signIn.magicLink({
      email: email.trim(),
      callbackURL: window.location.href,
    });
    setPending(false);
    if (result.error) {
      setError(
        "Could not send the sign-in link. Please check the email and try again.",
      );
      return;
    }
    setSent(true);
  }

  async function beginCheckout() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: AI_RUN_PACK.id }),
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
        onClick={() => setOpen(true)}
      >
        <IconBolt size={15} />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {AI_RUN_PACK.name} for {AI_RUN_PACK.priceLabel}
            </DialogTitle>
            <DialogDescription>
              Use a run to enrich a design.md or revise it with AI.
              Deterministic URL extraction stays free, and purchased runs do not
              expire.
            </DialogDescription>
          </DialogHeader>

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
          ) : sent ? (
            <div className="rounded-md border border-primary/25 bg-primary/10 p-4 text-sm">
              Check your inbox. Open the sign-in link, then return here to buy
              AI runs.
            </div>
          ) : (
            <form className="grid gap-3" onSubmit={sendSignInLink}>
              <label htmlFor="credit-email" className="text-sm font-medium">
                Sign in to keep your AI runs
              </label>
              <div className="flex gap-2">
                <Input
                  id="credit-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(null);
                  }}
                  placeholder="you@example.com"
                  required
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "credit-email-error" : undefined}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={pending || !email.trim()}
                >
                  <IconMail size={15} />
                  Send link
                </Button>
              </div>
            </form>
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
                {pending ? "Opening Stripe…" : "Continue to Stripe"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
