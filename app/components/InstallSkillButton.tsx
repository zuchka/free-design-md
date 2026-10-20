import { useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

const INSTALL_COMMAND =
  "npx skills add zuchka/free-design-md --skill extract-design-md --global";

export default function InstallSkillButton() {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  async function copyInstallCommand() {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setCopied(false);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      resetTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <div className="mt-6 flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copyInstallCommand}
          title="Copy the skill install command"
          className="min-w-40"
        >
          {copied ? (
            <IconCheck aria-hidden="true" />
          ) : (
            <IconCopy aria-hidden="true" />
          )}
          {copied ? "Command copied" : "Install skill"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Install once, then run in your agent’s chat:
        </p>
        <span role="status" className="sr-only">
          {copied ? "Install command copied. Paste it into your terminal." : ""}
        </span>
      </div>
      <dl className="flex min-w-0 flex-col gap-2 text-xs sm:flex-row sm:flex-wrap sm:gap-x-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <dt className="font-medium text-muted-foreground">Claude Code</dt>
          <dd className="min-w-0">
            <code className="block select-all break-all rounded-md border bg-secondary/25 px-2 py-1.5">
              /extract-design-md https://stripe.com
            </code>
          </dd>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <dt className="font-medium text-muted-foreground">Codex</dt>
          <dd className="min-w-0">
            <code className="block select-all break-all rounded-md border bg-secondary/25 px-2 py-1.5">
              $extract-design-md https://stripe.com
            </code>
          </dd>
        </div>
      </dl>
      <p className="text-xs leading-5 text-muted-foreground">
        For AI enrichment, add “and enrich using your own model.”
      </p>
      {copyFailed && (
        <div role="alert" className="text-sm">
          <p className="text-muted-foreground">
            Copy this command and paste it into your terminal:
          </p>
          <code className="mt-2 block select-all break-all rounded-md border bg-secondary/25 p-3 text-xs leading-6">
            {INSTALL_COMMAND}
          </code>
        </div>
      )}
    </div>
  );
}
