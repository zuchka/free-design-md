import { useEffect, useId, useRef, useState } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const INSTALL_COMMAND =
  "npx skills add zuchka/free-design-md --skill extract-design-md --global";

const AGENTS = [
  {
    id: "claude",
    name: "Claude Code",
    command: "/extract-design-md https://stripe.com",
  },
  {
    id: "codex",
    name: "Codex",
    command: "$extract-design-md https://stripe.com",
  },
];

export default function InstallSkillButton() {
  const titleId = useId();
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
    <section aria-labelledby={titleId} className="mt-7 min-w-0 border-t pt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id={titleId} className="text-base font-medium">
            Use in your coding agent
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Install once, then run in chat.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copyInstallCommand}
          title="Copy the skill install command"
          className="w-40 shrink-0"
        >
          {copied ? (
            <IconCheck aria-hidden="true" />
          ) : (
            <IconCopy aria-hidden="true" />
          )}
          {copied ? "Command copied" : "Install skill"}
        </Button>
      </div>
      <span role="status" className="sr-only">
        {copied ? "Install command copied. Paste it into your terminal." : ""}
      </span>
      <Tabs defaultValue="claude" className="mt-3">
        <TabsList variant="line" aria-label="Choose your coding agent">
          {AGENTS.map((agent) => (
            <TabsTrigger key={agent.id} value={agent.id}>
              {agent.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {AGENTS.map((agent) => (
          <TabsContent key={agent.id} value={agent.id}>
            <code className="block select-all rounded-md bg-secondary/50 px-3 py-3 font-mono text-sm leading-6 [overflow-wrap:anywhere]">
              {agent.command}
            </code>
          </TabsContent>
        ))}
      </Tabs>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        For AI enrichment, add “and enrich using your own model.”
      </p>
      {copyFailed && (
        <div role="alert" className="mt-3 text-sm">
          <p className="text-muted-foreground">
            Copy this command and paste it into your terminal:
          </p>
          <code className="mt-2 block select-all break-all rounded-md border bg-secondary/25 p-3 text-xs leading-6">
            {INSTALL_COMMAND}
          </code>
        </div>
      )}
    </section>
  );
}
