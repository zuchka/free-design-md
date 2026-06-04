import { Link, useLocation } from "react-router";
import { AgentToggleButton } from "@agent-native/core/client";
import { IconHome } from "@tabler/icons-react";
import CreditsChip from "@/components/CreditsChip";

export default function NavBar() {
  const location = useLocation();
  const onWorkspace = location.pathname === "/";
  const onPublicSharedDesign = /^\/d\/[^/]+/.test(location.pathname);

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center">
          <Link
            to="/"
            aria-label="free design.md"
            className="flex items-center"
          >
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
          <Link
            to="/"
            aria-current={onWorkspace ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-md px-1 py-1.5 text-sm font-medium transition-colors ${
              onWorkspace
                ? "text-foreground underline decoration-primary decoration-2 underline-offset-8"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <IconHome size={14} />
            <span className="hidden sm:inline">My workspace</span>
            <span className="sm:hidden">Home</span>
          </Link>
          {!onPublicSharedDesign && <CreditsChip />}
          <AgentToggleButton />
          <Link
            to="/quality"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Quality
          </Link>
        </nav>
      </div>
    </header>
  );
}
