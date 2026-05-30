import { Link } from "react-router";
import { useState } from "react";
import CreditsChip from "@/components/CreditsChip";
import BYOKeyForm from "@/components/BYOKeyForm";
import { Button } from "@/components/ui/button";
import { IconKey } from "@tabler/icons-react";

export default function NavBar() {
  const [keyOpen, setKeyOpen] = useState(false);

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center">
          <Link to="/" aria-label="free design.md" className="flex items-center">
            <span className="font-semibold text-foreground">free design</span>
            <span className="font-semibold text-primary">.md</span>
          </Link>
          <span className="mx-2 text-muted-foreground">·</span>
          <a
            href="https://agent-native.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            powered by Agent Native ↗
          </a>
        </div>
        <nav aria-label="Main" className="flex items-center gap-4">
          <CreditsChip />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setKeyOpen((v) => !v)}
            aria-label="API key settings"
            className="flex items-center gap-1"
          >
            <IconKey size={14} />
            <span className="text-xs">API key</span>
          </Button>
          <Link
            to="/quality"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Quality
          </Link>
        </nav>
      </div>
      {keyOpen && (
        <div className="border-t border-border bg-muted/30 px-6 py-3">
          <div className="mx-auto max-w-7xl">
            <p className="mb-2 text-xs text-muted-foreground">
              Your Anthropic API key is stored on this server and used to power AI enrichment and iteration.
            </p>
            <BYOKeyForm />
          </div>
        </div>
      )}
    </header>
  );
}
