import { useEffect } from "react";
import { useBuilderConnectFlow } from "@agent-native/core/client";
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
 * "Connect Builder.io" gate for AI enrichment.
 *
 * Uses the framework's useBuilderConnectFlow() hook — it owns the popup,
 * CSRF state, status polling, and credential persistence to app_secrets.
 * Server routes (/_agent-native/builder/{status,connect,callback}) are
 * auto-mounted by createCoreRoutesPlugin() in server/plugins/core-routes.ts.
 */
export default function SignInModal({ open, onOpenChange }: SignInModalProps) {
  const { configured, connecting, error, orgName, start } = useBuilderConnectFlow({
    trackingSource: "free_design_md_signin_modal",
    trackingFlow: "enrich_design_md",
    onConnected: () => {
      onOpenChange(false);
    },
  });

  useEffect(() => {
    if (open && configured) onOpenChange(false);
  }, [open, configured, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Builder.io to enrich</DialogTitle>
          <DialogDescription>
            Free design.md is free for everyone — deterministic extractions
            stay open. Connect your Builder.io account and we'll throw in
            3 AI enrichments on us, powered by Claude Opus 4.7.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <Button
            size="lg"
            onClick={() => start()}
            disabled={connecting}
            className="w-full justify-center gap-3"
          >
            {connecting ? (
              <Spinner className="size-4" />
            ) : (
              <BuilderLogo className="w-5 h-5" />
            )}
            <span>
              {connecting ? "Waiting for Builder.io…" : "Connect Builder.io"}
            </span>
          </Button>
          {error && (
            <p className="text-center text-xs text-destructive">{error}</p>
          )}
          {configured && orgName && (
            <p className="text-center text-xs text-muted-foreground">
              Connected as {orgName}
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            By connecting you agree to drop into Builder.io's platform to
            iterate on your design.md with a real agent.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
