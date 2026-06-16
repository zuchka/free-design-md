import { Link, useLocation } from "react-router";
import { AgentToggleButton } from "@agent-native/core/client";
import {
  IconBook2,
  IconChartBar,
  IconHome,
  IconLayoutGrid,
} from "@tabler/icons-react";
import CreditsChip from "@/components/CreditsChip";

interface NavBarProps {
  showAgentToggle?: boolean;
}

function navLinkClass(isActive: boolean) {
  return `inline-flex items-center gap-2 rounded-md px-1.5 py-2 text-base font-semibold transition-colors ${
    isActive
      ? "text-foreground underline decoration-primary decoration-2 underline-offset-10"
      : "text-muted-foreground hover:text-foreground"
  }`;
}

export default function NavBar({ showAgentToggle = true }: NavBarProps) {
  const location = useLocation();
  const onWorkspace = location.pathname === "/";
  const onExamples = location.pathname.startsWith("/examples");
  const onDocs = location.pathname.startsWith("/docs");
  const onQuality = location.pathname === "/quality";
  const onPublicSharedDesign = /^\/d\/[^/]+/.test(location.pathname);
  const showCredits =
    !onPublicSharedDesign && !onExamples && !onDocs && !onQuality;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="flex h-16 w-full items-center justify-between px-5 sm:px-8 lg:px-12">
        <div className="flex min-w-0 items-center">
          <Link
            to="/"
            aria-label="free design.md"
            className="flex shrink-0 items-center"
          >
            <span className="text-xl font-semibold leading-none text-foreground sm:text-2xl">
              free design
            </span>
            <span className="text-xl font-semibold leading-none text-primary sm:text-2xl">
              .md
            </span>
          </Link>
          <span className="mx-2 hidden text-muted-foreground md:inline">·</span>
          <a
            href="https://agent-native.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:inline"
          >
            powered by Agent Native ↗
          </a>
        </div>
        <nav aria-label="Main" className="flex items-center gap-2 sm:gap-5">
          <Link
            to="/"
            aria-label="My workspace"
            aria-current={onWorkspace ? "page" : undefined}
            title="My workspace"
            className={navLinkClass(onWorkspace)}
          >
            <IconHome size={16} />
            <span className="hidden sm:inline">My workspace</span>
          </Link>
          <Link
            to="/docs"
            aria-label="Docs"
            aria-current={onDocs ? "page" : undefined}
            title="Docs"
            className={navLinkClass(onDocs)}
          >
            <IconBook2 size={16} />
            <span className="hidden sm:inline">Docs</span>
          </Link>
          <Link
            to="/examples"
            aria-label="Examples"
            aria-current={onExamples ? "page" : undefined}
            title="Examples"
            className={navLinkClass(onExamples)}
          >
            <IconLayoutGrid size={16} />
            <span className="hidden sm:inline">Examples</span>
          </Link>
          <Link
            to="/quality"
            aria-label="Quality"
            aria-current={onQuality ? "page" : undefined}
            title="Quality"
            className={navLinkClass(onQuality)}
          >
            <IconChartBar size={16} />
            <span className="hidden sm:inline">Quality</span>
          </Link>
          {showCredits && <CreditsChip />}
          {showAgentToggle && <AgentToggleButton />}
        </nav>
      </div>
    </header>
  );
}
