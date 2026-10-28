import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getTeacherHome } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { SessionMenu } from "@/components/session-menu";
import { GraduationCap, BookOpen, UserRound } from "lucide-react";

const teacherQuery = queryOptions({ queryKey: ["teacher-home"], queryFn: () => getTeacherHome() });
export const Route = createFileRoute("/_authenticated/teacher")({
  loader: ({ context }) => context.queryClient.ensureQueryData(teacherQuery),
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
  const { data } = useSuspenseQuery(teacherQuery);
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
      <section className="mt-14 border-t border-border pt-8">
        <h2 className="text-xl font-semibold">Your classroom</h2>
        <p className="mt-3 text-muted-foreground">No connected students yet.</p>
        <p className="mt-2 text-sm text-muted-foreground">Class rosters, assignments, and student reports are not available yet.</p>
      </section>
    </main>
  </div>;
}