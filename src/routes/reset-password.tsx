import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Mentora" },
      { name: "description", content: "Set a new password for your Mentora account." },
      { property: "og:title", content: "Choose a new password — Mentora" },
      { property: "og:description", content: "Set a new password for your Mentora account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { type?: string } => {
    const out: { type?: string } = {};
    if (typeof search["type"] === "string") out.type = search["type"];
    return out;
  },
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { type } = Route.useSearch();
  const go = useNavigate();
  const [state, setState] = useState<"checking" | "expired" | "ready">("checking");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      // A recovery link signs the learner in on the way back; anything else is a stale link.
      setState(data.session && type === "recovery" ? "ready" : "expired");
    });
    return () => {
      active = false;
    };
  }, [type]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }
    if (password !== again) {
      setError("Those two passwords don’t match.");
      return;
    }
    setBusy(true);
    const { error: e } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e) {
      setError("We couldn’t save that password. Request a new reset link and try again.");
      return;
    }
    toast.success("New password saved.");
    await go({ to: "/", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center px-6 py-14">
      <Card className="rise w-full max-w-md p-8 shadow-soft">
        <Link to="/" className="inline-flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground">
            m
          </span>
          <span className="font-display text-xl font-semibold">Mentora</span>
        </Link>

        {state === "checking" && <p className="mt-8 text-muted-foreground">Checking your reset link…</p>}

        {state === "expired" && (
          <>
            <h1 className="mt-8 text-2xl font-semibold">That reset link has expired</h1>
            <p className="mt-3 text-muted-foreground">
              For your safety, reset links work only once and only for a short while.
            </p>
            <Button asChild className="mt-6 w-full" size="lg">
              <Link to="/auth">Send me a new link</Link>
            </Button>
          </>
        )}

        {state === "ready" && (
          <form className="mt-8 space-y-4" onSubmit={submit}>
            <h1 className="text-2xl font-semibold">Choose a new password</h1>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repeat-password">Type it again</Label>
              <Input
                id="repeat-password"
                type="password"
                value={again}
                onChange={(e) => setAgain(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            {error && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "Saving…" : "Save new password"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
