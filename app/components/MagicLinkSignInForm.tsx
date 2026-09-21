import { useId, useState } from "react";
import { IconMail } from "@tabler/icons-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MagicLinkSignInFormProps {
  label?: string;
  sentMessage?: string;
}

export default function MagicLinkSignInForm({
  label = "Email address",
  sentMessage = "Check your inbox and open the sign-in link to continue.",
}: MagicLinkSignInFormProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendSignInLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;

    setPending(true);
    setError(null);
    try {
      const result = await authClient.signIn.magicLink({
        email: email.trim(),
        callbackURL: window.location.href,
      });
      if (result.error) {
        setError(
          "Could not send the sign-in link. Check the address and try again.",
        );
        return;
      }

      setSent(true);
    } catch {
      setError(
        "Could not send the sign-in link. Check the address and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-md border border-primary/25 bg-primary/10 p-4 text-sm"
      >
        <div className="flex items-center gap-2 font-medium text-foreground">
          <IconMail />
          Sign-in link sent
        </div>
        <p className="mt-2 text-muted-foreground">{sentMessage}</p>
      </div>
    );
  }

  return (
    <form className="grid gap-3" onSubmit={sendSignInLink}>
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
          placeholder="you@example.com"
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        <Button
          type="submit"
          variant="outline"
          className="shrink-0"
          disabled={pending || !email.trim()}
        >
          <IconMail />
          {pending ? "Sending…" : "Send sign-in link"}
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
