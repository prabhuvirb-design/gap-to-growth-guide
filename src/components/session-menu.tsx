import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useSignOut } from "@/hooks/use-sign-out";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** The header control: shows what the learner can do right now, not a static "Sign in". */
export function SessionMenu() {
  const { user, ready } = useAuth();
  const signOut = useSignOut();

  if (!ready) return <span className="h-8 w-28 animate-pulse rounded-md bg-muted" aria-hidden />;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/auth">Sign in</Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/auth" search={{ mode: "signup" }}>Create account</Link>
        </Button>
      </div>
    );
  }

  const name = user.email?.split("@")[0] ?? "Learner";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span className="max-w-32 truncate">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account">Account & progress</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
