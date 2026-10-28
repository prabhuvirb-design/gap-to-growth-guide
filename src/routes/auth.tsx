import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GraduationCap, School } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => typeof search["next"] === "string" ? { next: search["next"] } : {},
  head: () => ({ meta: [
    { title: "Choose your account — Mentora" },
    { name: "description", content: "Choose Student or Teacher to sign in to Mentora with Google." },
    { property: "og:title", content: "Choose your account — Mentora" },
    { property: "og:description", content: "Student and teacher Google sign-in." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: AuthPage,
});

export function readable(message: string): string {
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
  const { next } = Route.useSearch();
  const search = next ? { next } : {};
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
    <Link to="/" className="mb-12 font-display text-2xl font-semibold text-primary">Mentora</Link>
    <h1 className="font-display text-4xl font-bold">Who is signing in?</h1>
    <div className="mt-8 grid gap-4" role="group" aria-label="Account type">
      <Button asChild variant="outline" className="h-20 justify-start gap-5 px-6 text-xl"><Link to="/student-login" search={search}><GraduationCap className="size-7 text-primary" />Student</Link></Button>
      <Button asChild variant="outline" className="h-20 justify-start gap-5 px-6 text-xl"><Link to="/teacher-login" search={search}><School className="size-7 text-primary" />Teacher</Link></Button>
    </div>
    <Button asChild variant="link" className="mt-8 self-center"><Link to="/">Back to the tutor</Link></Button>
  </main>;
}
