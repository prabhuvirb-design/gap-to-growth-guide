import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rememberNext, safeNext, takeNext } from "@/lib/redirect";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { claimAccountType } from "@/lib/account.functions";
import { accountHome, matchesAccountType, type AccountType } from "@/lib/account-type";
import { ArrowLeft, GraduationCap, School } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Mentora" },
      {
        name: "description",
        content: "Sign in to Mentora to keep your diagnostics, knowledge gaps, and learning path on every device.",
      },
      { property: "og:title", content: "Sign in to Mentora" },
      { property: "og:description", content: "Keep your diagnostics, gaps, and learning path with you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { mode?: string; next?: string; role?: AccountType } => {
    const out: { mode?: string; next?: string; role?: AccountType } = {};
    if (search["role"] === "student" || search["role"] === "teacher") out.role = search["role"];
    if (typeof search["mode"] === "string") out.mode = search["mode"];
    if (typeof search["next"] === "string") out.next = search["next"];
    return out;
  },
  component: AuthPage,
});

const ROLE_COPY: Record<AccountType, { label: string; blurb: string }> = {
  student: {
    label: "Student",
    blurb: "Get a diagnostic, see your knowledge gaps, and follow a path built for you.",
  },
  teacher: {
    label: "Teacher",
    blurb: "Open the class view: who is stuck, on what, and the idea the group keeps missing.",
  },
};

function useGoAfterAuth() {
  const go = useNavigate();
  return useCallback(
    (target: string) => {
      if (target === "/account") return go({ to: "/account", replace: true });
      if (target === "/teacher") return go({ to: "/teacher", replace: true });
      if (target === "/reset-password") return go({ to: "/reset-password", replace: true });
      return go({ to: "/", replace: true });
    },
    [go],
  );
}

function readable(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don’t match. Try again or reset your password.";
  if (m.includes("already registered")) return "That email already has an account — sign in instead.";
  if (m.includes("confirm your email") || m.includes("not confirmed")) return "Confirm your email address first, then sign in.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a minute, then try again.";
  if (m.includes("weak") || m.includes("easy to guess") || m.includes("compromised") || m.includes("pwned"))
    return "That password is too easy to guess — it appears in known password lists. Pick a longer one that mixes words, numbers, and symbols.";
  if (m.includes("password")) return "Use at least 6 characters for your password.";
  return message;
}

function AuthPage() {
  const { mode: modeParam, next, role: roleParam } = Route.useSearch();
  const goTo = useGoAfterAuth();
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const claimRole = useServerFn(claimAccountType);
  // The account type is the first window: no role in the address bar means the picker is showing.
  const role = roleParam ?? null;
  const [mode, setMode] = useState<"signin" | "signup">(modeParam === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // The stored account type, not the selected tab, decides access after authentication.
  useEffect(() => {
    if (!ready || !user || !role) return;
    let active = true;
    void claimRole({ data: { role } }).then((stored) => {
      if (!active) return;
      if (!matchesAccountType(stored, role)) {
        setError(`This is a ${stored} account. Choose ${stored === "teacher" ? "Teacher" : "Student"} to continue.`);
        return;
      }
      const target = safeNext(next) ?? takeNext();
      void goTo(target === "/account" ? target : accountHome(stored));
    }).catch(() => { if (active) setError("Couldn’t check your account type. Please try again."); });
    return () => {
      active = false;
    };
  }, [ready, user?.id, role, next, goTo, claimRole]);

  // Optional search params stay out of the object entirely: the router's types reject explicit undefined.
  function authSearch(mode: "signin" | "signup", type?: AccountType, to?: string) {
    const search: { mode: string; role?: AccountType; next?: string } = { mode };
    if (type) search.role = type;
    if (to) search.next = to;
    return search;
  }

  function openRole(type: AccountType) {
    setError("");
    setNotice("");
    void navigate({ to: "/auth", search: authSearch(mode, type, next) });
  }

  function backToRolePicker() {
    setError("");
    setNotice("");
    void navigate({ to: "/auth", search: authSearch(mode, undefined, next) });
  }

  function switchMode(m: "signin" | "signup") {
    setMode(m);
    setError("");
    setNotice("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!role) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) {
          setError(readable(e.message));
          return;
        }
        return;
      }
      const { data, error: e } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?role=${role}&mode=${mode}`,
          data: { display_name: name.trim(), account_type: role },
        },
      });
      if (e) {
        setError(readable(e.message));
        return;
      }
      if (!data.session) {
        setMode("signin");
        setNotice("We sent you a confirmation link — open it, then sign in.");
      }
    } catch {
      setError("Couldn’t connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (!role) return;
    setError("");
    setNotice("");
    rememberNext(next);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth?role=${role}&mode=${mode}`,
    });
    if (result.error) {
      setError(readable(result.error.message));
      return;
    }
    if (result.redirected) return;
  }

  async function reset() {
    setError("");
    setNotice("");
    if (!email) {
      setError("Type your email address first, then choose “Reset password”.");
      return;
    }
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password?type=recovery`,
    });
    setNotice("If that address has an account, a reset link is on its way.");
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-14 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <section className="rise">
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground">
              m
            </span>
            <span className="font-display text-xl font-semibold">Mentora</span>
          </Link>
          <h1 className="mt-8 text-4xl font-extrabold leading-[1.08] md:text-5xl">
            Your progress,
            <br />
            <em className="text-primary">wherever you learn.</em>
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Sign in and every diagnostic, knowledge gap, and learning path is saved to your account — open the app on a
            phone, a laptop, or a school machine and pick up where you left off.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            <li>· Mastery map and practice levels kept for each subject</li>
            <li>· Anything saved on this device moves across when you sign in</li>
            <li>· No class-wide data, no ads, leave whenever you like</li>
          </ul>
        </section>

        <Card className="rise p-8 shadow-soft">
          <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1 text-sm">
            {(["signin", "signup"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                variant="ghost"
                aria-pressed={mode === m}
                onClick={() => switchMode(m)}
                className={`flex-1 rounded-md px-3 py-2 font-medium transition ${
                  mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </Button>
            ))}
          </div>

          {!role ? (
            <>
              <h2 className="text-xl font-semibold">{mode === "signup" ? "Who is creating an account?" : "Who is signing in?"}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose Student or Teacher first — each one opens a different home.
              </p>
              <div className="mt-6 grid gap-3" role="group" aria-label="Account type">
                {(["student", "teacher"] as const).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant="outline"
                    className="h-auto gap-4 border-border/70 p-5 text-left transition hover:border-primary hover:bg-primary/5"
                    onClick={() => openRole(type)}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      {type === "student" ? <GraduationCap className="h-5 w-5" /> : <School className="h-5 w-5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-lg font-semibold">{ROLE_COPY[type].label}</span>
                      <span className="mt-1 block text-sm font-normal leading-snug text-muted-foreground">
                        {ROLE_COPY[type].blurb}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
              {error && <p className="mt-5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              {notice && <p className="mt-5 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">{notice}</p>}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={backToRolePicker}
                className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                {ROLE_COPY[role].label} — change
              </button>
              <h2 className="mb-5 text-xl font-semibold">
                {mode === "signin"
                  ? `${ROLE_COPY[role].label} sign in`
                  : `Create a ${ROLE_COPY[role].label.toLowerCase()} account`}
              </h2>

              <form className="space-y-4" onSubmit={submit}>
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Your name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex"
                      autoComplete="name"
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    minLength={6}
                    required
                  />
                  {mode === "signup" && (
                    <p className="text-xs text-muted-foreground">
                      At least 6 characters, and not a common or leaked password — avoid things like
                      “password123” or your name. A short phrase with a number works well.
                    </p>
                  )}
                </div>

                {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
                {notice && <p className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">{notice}</p>}

                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {busy
                    ? "One moment…"
                    : mode === "signin"
                      ? `Sign in as ${ROLE_COPY[role].label.toLowerCase()}`
                      : `Create ${ROLE_COPY[role].label.toLowerCase()} account`}
                </Button>
              </form>

              {mode === "signin" && (
                <Button
                  type="button"
                  variant="link"
                  onClick={() => void reset()}
                  className="mt-3 text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
                >
                  Reset password
                </Button>
              )}

              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>

              <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => void google()}>
                <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.3 0-6-2.73-6-6.1s2.7-6.1 6-6.1c1.9 0 3.17.8 3.9 1.5l2.66-2.56C16.8 3.2 14.6 2.2 12 2.2 6.9 2.2 2.8 6.3 2.8 11.4S6.9 20.6 12 20.6c5.5 0 9.13-3.86 9.13-9.3 0-.63-.07-1.1-.16-1.1H12z"
                  />
                </svg>
                Continue with Google
              </Button>
            </>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/" className="underline underline-offset-4 hover:text-primary">
              Not now — take me back
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
