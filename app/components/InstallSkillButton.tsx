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
    <div className="mt-6 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
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
        Use it in Codex, Claude Code, or Cursor.
      </p>
      <span role="status" className="sr-only">
        {copied ? "Install command copied. Paste it into your terminal." : ""}
      </span>
      {copyFailed && (
        <div role="alert" className="basis-full text-sm">
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
