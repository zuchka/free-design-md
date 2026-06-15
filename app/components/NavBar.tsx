import { Link, useLocation } from "react-router";
import { AgentToggleButton } from "@agent-native/core/client";
import { IconBook2, IconChartBar, IconHome } from "@tabler/icons-react";
import CreditsChip from "@/components/CreditsChip";

interface NavBarProps {
  showAgentToggle?: boolean;
}

function navLinkClass(isActive: boolean) {
  return `inline-flex items-center gap-1.5 rounded-md px-1 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? "text-foreground underline decoration-primary decoration-2 underline-offset-8"
      : "text-muted-foreground hover:text-foreground"
  }`;
}

export default function NavBar({ showAgentToggle = true }: NavBarProps) {
  const location = useLocation();
  const onWorkspace = location.pathname === "/";
  const onDocs = location.pathname.startsWith("/docs");
  const onQuality = location.pathname === "/quality";
  const onPublicSharedDesign = /^\/d\/[^/]+/.test(location.pathname);
  const showCredits = !onPublicSharedDesign && !onDocs && !onQuality;

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center">
          <Link
            to="/"
            aria-label="free design.md"
            className="flex shrink-0 items-center"
          >
            <span className="font-semibold text-foreground">free design</span>
            <span className="font-semibold text-primary">.md</span>
          </Link>
          <span className="mx-2 hidden text-muted-foreground md:inline">·</span>
          <a
            href="https://agent-native.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-xs text-muted-foreground transition-colors hover:text-foreground md:inline"
          >
            powered by Agent Native ↗
          </a>
        </div>
        <nav aria-label="Main" className="flex items-center gap-2 sm:gap-4">
          <Link
            to="/"
            aria-label="My workspace"
            aria-current={onWorkspace ? "page" : undefined}
            title="My workspace"
            className={navLinkClass(onWorkspace)}
          >
            <IconHome size={14} />
            <span className="hidden sm:inline">My workspace</span>
          </Link>
          <Link
            to="/docs/what-is-design-md"
            aria-label="Docs"
            aria-current={onDocs ? "page" : undefined}
            title="Docs"
            className={navLinkClass(onDocs)}
          >
            <IconBook2 size={14} />
            <span className="hidden sm:inline">Docs</span>
          </Link>
          {showCredits && <CreditsChip />}
          {showAgentToggle && <AgentToggleButton />}
          <Link
            to="/quality"
            aria-label="Quality"
            aria-current={onQuality ? "page" : undefined}
            title="Quality"
            className={navLinkClass(onQuality)}
          >
            <IconChartBar size={14} />
            <span className="hidden sm:inline">Quality</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
