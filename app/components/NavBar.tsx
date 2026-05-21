import { Link } from "react-router";
import AccountChip from "@/components/auth/AccountChip";

export default function NavBar() {
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
          <Link
            to="/quality"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Quality
          </Link>
          <AccountChip />
        </nav>
      </div>
    </header>
  );
}
