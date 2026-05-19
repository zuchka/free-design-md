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
 * Mocked Builder.io sign-in. The button waits ~400ms (just long enough
 * to feel like a real OAuth round-trip), then calls signIn() against
 * the mock-auth seam and closes the modal. The AccountChip in the
 * header re-renders via useAuth() and confirms the success visually.
 *
 * No real OAuth here. See [[../../lib/auth/real-auth.ts]] — Phase 3
 * replaces this with a real flow.
 */
export default function SignInModal({ open, onOpenChange }: SignInModalProps) {
  const [pending, setPending] = useState(false);

  async function handleSignIn() {
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    signIn("matt@builder.io");
    setPending(false);
    onOpenChange(false);
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
