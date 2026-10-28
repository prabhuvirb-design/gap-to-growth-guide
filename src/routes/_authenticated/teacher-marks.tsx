import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BookMarked, Pencil, Save, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getClassroom, saveMark } from "@/lib/classroom.functions";
import { markSchema, validateMarks } from "@/lib/classroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SessionMenu } from "@/components/session-menu";

type Search = { student?: string; assignment?: string };

/** Where a teacher records one student's result for one assignment and keeps it in the database. */
export const Route = createFileRoute("/_authenticated/teacher-marks")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const next: Search = {};
    if (typeof search["student"] === "string") next.student = search["student"];
    if (typeof search["assignment"] === "string") next.assignment = search["assignment"];
    return next;
  },
  head: () => ({
    meta: [
      { title: "Mark book — Mentora" },
      { name: "description", content: "Record a student's marks for an assignment and save them to your classroom records." },
      { property: "og:title", content: "Mark book — Mentora" },
      { property: "og:description", content: "Store a student's marks for an assignment in your classroom records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MarkBook,
});

function MarkBook() {
  const { student: initialStudent, assignment: initialAssignment } = Route.useSearch();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchClassroom = useServerFn(getClassroom);
  const writeMark = useServerFn(saveMark);
  const queryKey = ["classroom", user?.id];
  const query = useQuery({ queryKey, queryFn: () => fetchClassroom(), enabled: Boolean(user), retry: false });

  const [studentId, setStudentId] = useState(initialStudent ?? "");
  const [assignmentId, setAssignmentId] = useState(initialAssignment ?? "");
  const [scoreDraft, setScoreDraft] = useState<string | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  // The ids arrive from a link, so they may name a record that no longer exists; fall back to the first entry.
  useEffect(() => {
    const data = query.data;
    if (!data) return;
    setStudentId((current) => (data.students.some((s) => s.id === current) ? current : data.students[0]?.id ?? ""));
    setAssignmentId((current) => (data.assignments.some((a) => a.id === current) ? current : data.assignments[0]?.id ?? ""));
  }, [query.data]);

  const students = query.data?.students ?? [];
  const assignments = query.data?.assignments ?? [];
  const marks = query.data?.marks ?? [];
  const assignment = assignments.find((a) => a.id === assignmentId);
  const stored = marks.find((m) => m.student_id === studentId && m.assignment_id === assignmentId);
  const score = scoreDraft ?? (stored ? String(stored.marks) : "");
  const feedback = feedbackDraft ?? (stored?.feedback ?? "");
  const pending = assignment ? students.filter((s) => !marks.some((m) => m.student_id === s.id && m.assignment_id === assignment.id)) : [];
  const shown = filter === "all" ? marks : marks.filter((m) => m.assignment_id === filter);

  function pickStudent(id: string) {
    setStudentId(id);
    setScoreDraft(null);
    setFeedbackDraft(null);
    setError("");
  }
  function pickAssignment(id: string) {
    setAssignmentId(id);
    setScoreDraft(null);
    setFeedbackDraft(null);
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!studentId || !assignment) throw new Error("Choose a student and an assignment first.");
      if (score.trim() === "") throw new Error("Enter the marks to store.");
      validateMarks(Number(score), assignment.max_marks);
      await writeMark({ data: markSchema.parse({ studentId, assignmentId, marks: Number(score), feedback }) });
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Marks saved to your classroom records.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save the marks. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6">
        <Link to="/teacher" className="font-display text-xl font-semibold">Mentora <span className="ml-2 text-sm text-muted-foreground">Teachers</span></Link>
        <SessionMenu />
      </header>
      <main className="mx-auto max-w-5xl px-6 pb-16">
        <Button asChild variant="link" className="px-0"><Link to="/teacher"><ArrowLeft />Back to teacher home</Link></Button>
        <BookMarked className="mb-5 mt-6 h-10 w-10 text-primary" />
        <p className="text-sm font-medium text-primary">Mark book</p>
        <h1 className="mt-3 font-display text-4xl font-bold">Store a student’s marks</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Choose a student and an assignment, enter the result, and save it to your classroom records. Saving again replaces the marks held for that pair.</p>

        {query.isPending ? (
          <p className="py-10 text-muted-foreground">Loading your classroom…</p>
        ) : query.error ? (
          <div className="py-8">
            <p role="alert" className="text-destructive">{query.error.message}</p>
            <Button className="mt-4" variant="outline" onClick={() => void query.refetch()}>Retry</Button>
          </div>
        ) : !students.length || !assignments.length ? (
          <div className="mt-10 flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border text-muted-foreground">
            <Users />
            <p className="text-sm">Add a student and an assignment before recording marks.</p>
            <Button asChild variant="outline" className="mt-2"><Link to="/teacher">Open your classroom</Link></Button>
          </div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <form onSubmit={submit} noValidate className="h-fit space-y-4 rounded-lg border border-border bg-card p-6">
              <div className="space-y-2">
                <Label htmlFor="book-student">Student</Label>
                <select id="book-student" value={studentId} onChange={(e) => pickStudent(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" required>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name}{s.class_name ? ` · ${s.class_name}` : ""}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="book-assignment">Assignment</Label>
                <select id="book-assignment" value={assignmentId} onChange={(e) => pickAssignment(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" required>
                  {assignments.map((a) => <option key={a.id} value={a.id}>{a.title}{a.subject ? ` · ${a.subject}` : ""}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="book-score">Marks{assignment ? ` (out of ${assignment.max_marks})` : ""}</Label>
                <Input id="book-score" type="number" min="0" max={assignment?.max_marks} step="0.01" value={score} onChange={(e) => { setScoreDraft(e.target.value); setError(""); }} required />
                {stored && <p className="text-xs text-muted-foreground">Already stored: {stored.marks} / {assignment?.max_marks}. Saving replaces it.</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="book-feedback">Feedback (optional)</Label>
                <Textarea id="book-feedback" maxLength={1000} value={feedback} onChange={(e) => setFeedbackDraft(e.target.value)} />
              </div>
              {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}><Save />{busy ? "Saving…" : "Save marks"}</Button>
            </form>

            <section className="min-w-0">
              <h2 className="text-lg font-semibold">Saved results</h2>
              <p className="mt-1 text-sm text-muted-foreground">{marks.length} record{marks.length === 1 ? "" : "s"} · {assignment ? `${students.length - pending.length} of ${students.length} marked for “${assignment.title}”` : "Select an assignment to see its progress"}</p>

              <div className="mt-4 space-y-2">
                <Label htmlFor="book-filter">Show results for</Label>
                <select id="book-filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm">
                  <option value="all">All assignments</option>
                  {assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </div>

              {!shown.length ? (
                <p className="mt-6 border-b border-border py-10 text-sm text-muted-foreground">No marks stored for this assignment yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[580px] text-left text-sm">
                    <thead className="border-b border-border text-muted-foreground">
                      <tr>{["Student", "Assignment", "Marks", "Feedback", ""].map((h) => <th key={h} className="py-3 pr-4">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {shown.map((m) => (
                        <tr key={m.id} className="border-b border-border">
                          <td className="py-4 pr-4 font-medium">{students.find((s) => s.id === m.student_id)?.name ?? "—"}</td>
                          <td className="py-4 pr-4">{assignments.find((a) => a.id === m.assignment_id)?.title ?? "—"}</td>
                          <td className="whitespace-nowrap py-4 pr-4 font-medium text-primary">{m.marks} / {assignments.find((a) => a.id === m.assignment_id)?.max_marks}</td>
                          <td className="max-w-xs break-words py-4 pr-4 text-muted-foreground">{m.feedback || "—"}</td>
                          <td>
                            <Button asChild variant="ghost" size="icon" aria-label={`Edit marks for ${students.find((s) => s.id === m.student_id)?.name ?? "this student"}`} title="Edit marks">
                              <Link to="/teacher-marks" search={{ student: m.student_id, assignment: m.assignment_id }}><Pencil className="size-4" /></Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {assignment && pending.length > 0 && (
                <div className="mt-8 rounded-lg border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold">Not marked yet for “{assignment.title}”</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pending.map((s) => (
                      <Button key={s.id} variant="outline" size="sm" onClick={() => pickStudent(s.id)}>{s.name}{s.class_name ? ` · ${s.class_name}` : ""}</Button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
