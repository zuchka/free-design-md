import { useState } from "react";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import BuilderLogo from "./BuilderLogo";
import { Spinner } from "@/components/ui/spinner";

interface SignInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Builder.io sign-in modal.
 *
 * Mocked seam: calls signIn() against mock-auth → instant sign-in as
 * the dev user. Modal closes and AccountChip re-renders.
 *
 * Real seam: signIn() redirects to /api/auth/builder/start → Builder
 * cli-auth flow → callback mints session → returns here. The page
 * navigates away, so the modal never needs to close itself.
 */
export default function SignInModal({ open, onOpenChange }: SignInModalProps) {
  const [pending, setPending] = useState(false);

  async function handleSignIn() {
    setPending(true);
    // Real seam: page navigates away to /api/auth/builder/start — never returns.
    // Mock seam: signIn() returns a non-empty email synchronously, so we
    // close the modal and reset the spinner here.
    const result = signIn("matt@builder.io");
    if (result.email) {
      setPending(false);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to enrich</DialogTitle>
          <DialogDescription>
            Free design.md is free for everyone — deterministic extractions
            stay open. Sign in with your Builder.io account and we'll throw
            in 3 AI enrichments on us, powered by Claude Opus 4.7.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <Button
            size="lg"
            onClick={handleSignIn}
            disabled={pending}
            className="w-full justify-center gap-3"
          >
            {pending ? (
              <Spinner className="size-4" />
            ) : (
              <BuilderLogo className="w-5 h-5" />
            )}
            <span>
              {pending ? "Signing you in…" : "Sign in with Builder.io"}
            </span>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            By signing in you agree to drop into Builder.io's platform to
            iterate on your design.md with a real agent.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
