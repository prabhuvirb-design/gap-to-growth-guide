import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { getTeacherHome } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { SessionMenu } from "@/components/session-menu";
import { GraduationCap, BookOpen, UserRound } from "lucide-react";
import { TeacherClassroom } from "@/components/teacher-classroom";
import { DeleteAccount } from "@/components/delete-account";

export const Route = createFileRoute("/_authenticated/teacher")({
  head: () => ({ meta: [
    { title: "Teacher home — Mentora" },
    { name: "description", content: "Your teaching workspace and account on Mentora." },
    { property: "og:title", content: "Teacher home — Mentora" },
    { property: "og:description", content: "Your personal teaching workspace on Mentora." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: TeacherHome,
});

function TeacherHome() {
  const { user } = useAuth();
  const fetchHome = useServerFn(getTeacherHome);
  const { data, isPending, error } = useQuery({ queryKey: ["teacher-home", user?.id], queryFn: () => fetchHome(), enabled: Boolean(user), retry: false });
  if (isPending) return <main className="mx-auto max-w-5xl px-6 py-12"><p className="text-muted-foreground">Loading your workspace…</p></main>;
  if (error || !data) return <main className="mx-auto max-w-5xl px-6 py-12">
    <h1 className="text-2xl font-semibold">Teacher account required</h1>
    <p className="mt-3 text-muted-foreground">{error instanceof Error ? error.message : "Couldn’t load your workspace."}</p>
    <Button asChild className="mt-6"><Link to="/">Back to the tutor</Link></Button>
  </main>;
  return <div className="min-h-screen">
    <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6">
      <Link to="/teacher" className="font-display text-xl font-semibold">Mentora <span className="ml-2 text-sm text-muted-foreground">Teachers</span></Link>
      <SessionMenu />
    </header>
    <main className="mx-auto max-w-5xl px-6 py-12">
      <GraduationCap className="mb-5 h-10 w-10 text-primary" />
      <p className="text-sm font-medium text-primary">Teacher workspace</p>
      <h1 className="mt-3 font-display text-4xl font-bold">Welcome, {data.name}.</h1>
      {data.subject && <p className="mt-3 text-muted-foreground">Subject focus: {data.subject}</p>}
      <div className="mt-10 flex flex-wrap gap-4">
        <Button asChild size="lg"><Link to="/"><BookOpen />Open the tutor</Link></Button>
        <Button asChild variant="outline" size="lg"><Link to="/account"><UserRound />My profile</Link></Button>
      </div>
      <TeacherClassroom />
      <div className="mt-12"><DeleteAccount /></div>
    </main>
  </div>;
}