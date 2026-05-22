import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { IconLogout, IconBolt } from "@tabler/icons-react";

/**
 * Header chip shown when the user is signed in (mocked Builder.io auth).
 * Displays avatar + email + remaining enrichments. Click to open a menu
 * with Sign out.
 */
export default function AccountChip() {
  const { user, remaining, signOut } = useAuth();

  if (!user) return null;

  const initials = user.email
    .split("@")[0]
    .split(/[._-]/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 pr-3 pl-1"
          aria-label={`Account menu for ${user.email}`}
        >
          <Avatar className="size-6">
            <AvatarFallback className="text-[10px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-xs font-medium sm:inline">
            {user.email}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            <IconBolt size={11} className="-mt-px" />
            {remaining}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="text-xs text-muted-foreground">Signed in as</span>
          <span className="truncate text-sm font-medium">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex justify-between text-xs font-normal text-muted-foreground">
          <span>AI enrichments left</span>
          <span className="font-semibold text-foreground">{remaining} / 3</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="gap-2">
          <IconLogout size={14} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
