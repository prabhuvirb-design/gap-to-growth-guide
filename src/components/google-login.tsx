import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, GraduationCap, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { claimAccountType } from "@/lib/account.functions";
import { accountHome, matchesAccountType, type AccountType } from "@/lib/account-type";
import { rememberNext, safeNext, takeNext } from "@/lib/redirect";
import { lovable } from "@/integrations/lovable/index";

export function GoogleLogin({ role, next }: { role: AccountType; next?: string | undefined }) {
  const { user, ready } = useAuth();
  const claimRole = useServerFn(claimAccountType);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const label = role === "student" ? "Student" : "Teacher";
  useEffect(() => {
    if (!ready || !user) return;
    let active = true;
    void claimRole({ data: { role } }).then((stored) => {
      if (!active) return;
      if (!matchesAccountType(stored, role)) {
        setError(`This is a ${stored} account. Choose ${stored === "teacher" ? "Teacher" : "Student"} to continue.`);
        return;
      }
      const target = safeNext(next) ?? takeNext();
      void navigate({ to: target === "/account" ? "/account" : accountHome(stored), replace: true });
    }).catch(() => { if (active) setError("Couldn’t check your account type. Please try again."); });
    return () => { active = false; };
  }, [ready, user?.id, role, next, navigate, claimRole, attempt]);

  async function google() {
    if (busy) return;
    setError("");
    if (user) { setAttempt((value) => value + 1); return; }
    setBusy(true);
    rememberNext(next);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/${role}-login`,
      });
      if (result.error) setError(result.error.message);
    } catch { setError("Couldn’t connect to Google. Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
    <Link to="/" className="mb-12 font-display text-2xl font-semibold text-primary">Mentora</Link>
    <Button asChild variant="ghost" className="mb-8 self-start"><Link to="/auth"><ArrowLeft className="size-4" />Change account type</Link></Button>
    {role === "student" ? <GraduationCap className="mb-5 size-12 text-primary" /> : <School className="mb-5 size-12 text-primary" />}
    <h1 className="font-display text-4xl font-bold">{label} sign in</h1>
    <Button size="lg" className="mt-8 w-full" disabled={busy || !ready} onClick={() => void google()}>
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path fill="currentColor" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.3 0-6-2.73-6-6.1s2.7-6.1 6-6.1c1.9 0 3.17.8 3.9 1.5l2.66-2.56C16.8 3.2 14.6 2.2 12 2.2 6.9 2.2 2.8 6.3 2.8 11.4S6.9 20.6 12 20.6c5.5 0 9.13-3.86 9.13-9.3 0-.63-.07-1.1-.16-1.1H12z" /></svg>
      {busy ? "Connecting…" : "Continue with Google"}
    </Button>
    {error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
    <Button asChild variant="link" className="mt-6 self-center"><Link to="/">Back to the tutor</Link></Button>
  </main>;
}