import { useState } from "react";
import { IconLogin2, IconLogout, IconUser } from "@tabler/icons-react";
import MagicLinkSignInForm from "@/components/MagicLinkSignInForm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

interface SessionUser {
  email: string;
  name?: string | null;
  isAnonymous?: boolean | null;
}

export default function AccountMenu() {
  const session = authClient.useSession();
  const [signInOpen, setSignInOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const sessionData = session.data as unknown as { user: SessionUser } | null;
  const user = sessionData?.user;
  const signedIn = Boolean(user && !user.isAnonymous);

  async function signOut() {
    setSigningOut(true);
    setSignOutError(false);
    try {
      const result = await authClient.signOut({});
      if (result.error) setSignOutError(true);
    } catch {
      setSignOutError(true);
    } finally {
      setSigningOut(false);
    }
  }

  if (!signedIn) {
    return (
      <>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="px-2 sm:px-3"
          aria-label="Sign in"
          disabled={session.isPending}
          onClick={() => setSignInOpen(true)}
        >
          <IconLogin2 />
          <span className="hidden lg:inline">Sign in</span>
          <span className="sr-only lg:hidden">Sign in</span>
        </Button>

        <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Sign in to Free design.md</DialogTitle>
              <DialogDescription>
                We’ll email you a secure link. No password is required.
              </DialogDescription>
            </DialogHeader>
            <MagicLinkSignInForm />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const initial = (user?.name || user?.email || "A")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 rounded-full"
          aria-label={`Account menu for ${user?.email}`}
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initial || <IconUser />}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="grid gap-0.5 font-normal">
          <span className="text-xs text-muted-foreground">Signed in as</span>
          <span className="truncate font-medium">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={signingOut}
            onSelect={(event) => {
              event.preventDefault();
              void signOut();
            }}
          >
            <IconLogout />
            {signingOut ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {signOutError && (
          <p role="alert" className="px-2 py-1.5 text-xs text-destructive">
            Could not sign out. Please try again.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
