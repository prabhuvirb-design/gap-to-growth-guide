import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Users, ClipboardList, Pencil, Search, BookMarked, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getClassroom, addStudent, addAssignment, removeStudent } from "@/lib/classroom.functions";
import { studentSchema, assignmentSchema, removeStudentSchema } from "@/lib/classroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";

type Mode = "student" | "assignment";

/** The classroom roster: every student's assignments and marks sit beside their own name. */
export function TeacherClassroom() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchClassroom = useServerFn(getClassroom);
  const createStudent = useServerFn(addStudent);
  const createAssignment = useServerFn(addAssignment);
  const dropStudent = useServerFn(removeStudent);
  const queryKey = ["classroom", user?.id];
  const query = useQuery({ queryKey, queryFn: () => fetchClassroom(), enabled: !!user, retry: false });
  const [mode, setMode] = useState<Mode | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const students = query.data?.students ?? [];
  const assignments = query.data?.assignments ?? [];
  const marks = query.data?.marks ?? [];
  const visibleStudents = students.filter((s) => `${s.name} ${s.class_name}`.toLowerCase().includes(search.toLowerCase()));
  const removingStudent = students.find((s) => s.id === removeTarget) ?? null;
  const removingMarks = removeTarget ? marks.filter((m) => m.student_id === removeTarget).length : 0;

  function open(next: Mode) {
    setMode(next); setError("");
  }
  function markFor(studentId: string, assignmentId: string) {
    return marks.find((m) => m.student_id === studentId && m.assignment_id === assignmentId);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !mode) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      if (mode === "student") await createStudent({ data: studentSchema.parse({ name: form.get("name"), className: form.get("className") }) });
      else await createAssignment({ data: assignmentSchema.parse({ title: form.get("title"), subject: form.get("subject"), dueDate: form.get("dueDate"), maxMarks: Number(form.get("maxMarks")) }) });
      await queryClient.invalidateQueries({ queryKey });
      setMode(null); toast.success("Saved to your classroom.");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save. Please retry."); }
    finally { setBusy(false); }
  }
  async function confirmRemove() {
    if (removing || !removeTarget) return;
    setRemoving(true); setRemoveError("");
    try {
      const result = await dropStudent({ data: removeStudentSchema.parse({ studentId: removeTarget }) });
      await queryClient.invalidateQueries({ queryKey });
      setRemoveTarget(null);
      toast.success(result.marksRemoved ? `Removed ${removingStudent?.name ?? "the student"} and ${result.marksRemoved} stored ${result.marksRemoved === 1 ? "mark" : "marks"}.` : `Removed ${removingStudent?.name ?? "the student"}.`);
    } catch (e) { setRemoveError(e instanceof Error ? e.message : "Couldn’t remove the student. Please retry."); }
    finally { setRemoving(false); }
  }

  return <section className="mt-10 border-t border-border pt-8">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-2xl font-semibold">Your classroom</h2><p className="mt-1 text-sm text-muted-foreground">{students.length} students · {assignments.length} assignments · {marks.length} marks recorded</p></div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => open("student")} disabled={!query.data}><Plus className="size-4" />Add student</Button>
        <Button variant="outline" onClick={() => open("assignment")} disabled={!query.data}><Plus className="size-4" />Add assignment</Button>
        <Button asChild variant="outline"><Link to="/teacher-marks"><BookMarked className="size-4" />Mark book</Link></Button>
      </div>
    </div>
    {query.isPending ? <p className="py-10 text-muted-foreground">Loading classroom…</p> : query.error ? <div className="py-8"><p role="alert">{query.error.message}</p><Button className="mt-4" variant="outline" onClick={() => void query.refetch()}>Retry</Button></div> :
    <div className="mt-6">
      <div className="relative mb-5 max-w-sm"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Search students" placeholder="Search students or class" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
      {!visibleStudents.length ? <Empty icon={<Users />} text={students.length ? "No matching students." : "No students added yet."} /> :
      <div className="space-y-4">
        {visibleStudents.map((s) => {
          const marked = assignments.filter((a) => markFor(s.id, a.id)).length;
          return <article key={s.id} className="rounded-lg border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-lg font-semibold">{s.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.class_name || "No class set"} · {marked} of {assignments.length} {assignments.length === 1 ? "assignment" : "assignments"} marked</p>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Remove ${s.name}`} title="Remove student" className="text-destructive hover:text-destructive" disabled={removing} onClick={() => { setRemoveError(""); setRemoveTarget(s.id); }}><Trash2 className="size-4" /></Button>
            </div>
            {!assignments.length ? <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground"><ClipboardList className="size-4" />Add an assignment before recording marks.</p> :
            <ul className="mt-4 divide-y divide-border border-t border-border">
              {assignments.map((a) => {
                const stored = markFor(s.id, a.id);
                return <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{a.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.subject || "Assignment"} · out of {a.max_marks}{a.due_date ? ` · due ${a.due_date}` : ""}{stored?.feedback ? ` · ${stored.feedback}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={stored ? "whitespace-nowrap font-medium text-primary" : "whitespace-nowrap text-sm text-muted-foreground"}>{stored ? `${stored.marks} / ${a.max_marks}` : "Not marked"}</span>
                    <Button asChild variant="ghost" size="icon" aria-label={`${stored ? "Edit" : "Enter"} marks for ${s.name} — ${a.title}`} title={stored ? "Edit marks" : "Enter marks"}>
                      <Link to="/teacher-marks" search={{ student: s.id, assignment: a.id }}><Pencil className="size-4" /></Link>
                    </Button>
                  </div>
                </li>;
              })}
            </ul>}
          </article>;
        })}
      </div>}
    </div>}
    <Dialog open={mode !== null} onOpenChange={(next) => { if (!next && !busy) setMode(null); }}>
      <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{mode === "student" ? "Add student" : "Add assignment"}</DialogTitle><DialogDescription>{mode === "student" ? "Student record for your classroom only; no sign-in account is created." : "Assignment details"}</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {mode === "student" && <><Field label="Student name" name="name" required maxLength={100} /><Field label="Class / group" name="className" maxLength={100} /></>}
          {mode === "assignment" && <><Field label="Assignment title" name="title" required maxLength={150} /><Field label="Subject" name="subject" maxLength={100} /><Field label="Due date" name="dueDate" type="date" /><Field label="Maximum marks" name="maxMarks" type="number" min="0.01" max="100000" step="0.01" defaultValue="100" required /></>}
          {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setMode(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : mode === "student" ? "Save student" : "Save assignment"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={removeTarget !== null} onOpenChange={(next) => { if (!next && !removing) setRemoveTarget(null); }}>
      <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {removingStudent?.name ?? "this student"}?</AlertDialogTitle>
          <AlertDialogDescription>The student record leaves your classroom{removingMarks ? ` and ${removingMarks} stored ${removingMarks === 1 ? "mark" : "marks"} for them ${removingMarks === 1 ? "is" : "are"} deleted too` : ""}. This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        {removeError && <p role="alert" className="break-words text-sm text-destructive">{removeError}</p>}
        <AlertDialogFooter className="gap-2">
          <Button variant="outline" disabled={removing} onClick={() => setRemoveTarget(null)}>Keep student</Button>
          <Button variant="destructive" disabled={removing || !removingStudent} onClick={() => void confirmRemove()}>{removing ? "Removing…" : "Remove student"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
function Field({ label, name, ...props }: React.ComponentProps<typeof Input> & { label: string; name: string }) { return <div className="space-y-2"><Label htmlFor={`classroom-${name}`}>{label}</Label><Input id={`classroom-${name}`} name={name} {...props} /></div>; }
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="flex min-h-44 flex-col items-center justify-center gap-3 border-b border-border text-muted-foreground">{icon}<p className="text-sm">{text}</p></div>; }
