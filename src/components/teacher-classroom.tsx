import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Users, ClipboardList, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getClassroom, addStudent, addAssignment, saveMark } from "@/lib/classroom.functions";
import { studentSchema, assignmentSchema, markSchema, validateMarks } from "@/lib/classroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Mode = "student" | "assignment" | "marks";
export function TeacherClassroom() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchClassroom = useServerFn(getClassroom);
  const createStudent = useServerFn(addStudent);
  const createAssignment = useServerFn(addAssignment);
  const writeMark = useServerFn(saveMark);
  const queryKey = ["classroom", user?.id];
  const query = useQuery({ queryKey, queryFn: () => fetchClassroom(), enabled: !!user, retry: false });
  const [tab, setTab] = useState("students");
  const [mode, setMode] = useState<Mode | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [studentId, setStudentId] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const students = query.data?.students ?? [];
  const assignments = query.data?.assignments ?? [];
  const marks = query.data?.marks ?? [];
  const selected = assignments.find((a) => a.id === assignmentId);
  const visibleStudents = students.filter((s) => `${s.name} ${s.class_name}`.toLowerCase().includes(search.toLowerCase()));

  function open(next: Mode) {
    setMode(next); setError(""); setStudentId(students[0]?.id ?? ""); setAssignmentId(assignments[0]?.id ?? ""); setScore(""); setFeedback("");
  }
  function chooseMark(student: string, assignment: string) {
    setStudentId(student); setAssignmentId(assignment);
    const existing = marks.find((m) => m.student_id === student && m.assignment_id === assignment);
    setScore(existing ? String(existing.marks) : ""); setFeedback(existing?.feedback ?? "");
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      if (mode === "student") await createStudent({ data: studentSchema.parse({ name: form.get("name"), className: form.get("className") }) });
      if (mode === "assignment") await createAssignment({ data: assignmentSchema.parse({ title: form.get("title"), subject: form.get("subject"), dueDate: form.get("dueDate"), maxMarks: Number(form.get("maxMarks")) }) });
      if (mode === "marks") {
        if (!selected || score.trim() === "") throw new Error("Select an assignment and enter marks.");
        validateMarks(Number(score), selected.max_marks);
        await writeMark({ data: markSchema.parse({ studentId, assignmentId, marks: Number(score), feedback }) });
      }
      await queryClient.invalidateQueries({ queryKey });
      setTab(mode === "student" ? "students" : mode === "assignment" ? "assignments" : "marks");
      setMode(null); toast.success("Saved to your classroom.");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save. Please retry."); }
    finally { setBusy(false); }
  }

  return <section className="mt-10 border-t border-border pt-8">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-2xl font-semibold">Your classroom</h2><p className="mt-1 text-sm text-muted-foreground">{students.length} students · {assignments.length} assignments · {marks.length} marks recorded</p></div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => open("student")} disabled={!query.data}><Plus className="size-4" />Add student</Button>
        <Button variant="outline" onClick={() => open("assignment")} disabled={!query.data}><Plus className="size-4" />Add assignment</Button>
        <Button variant="outline" onClick={() => open("marks")} disabled={!students.length || !assignments.length}><Pencil className="size-4" />Enter marks</Button>
      </div>
    </div>
    {query.isPending ? <p className="py-10 text-muted-foreground">Loading classroom…</p> : query.error ? <div className="py-8"><p role="alert">{query.error.message}</p><Button className="mt-4" variant="outline" onClick={() => void query.refetch()}>Retry</Button></div> :
    <Tabs value={tab} onValueChange={setTab} className="mt-6">
      <TabsList><TabsTrigger value="students">Students</TabsTrigger><TabsTrigger value="assignments">Assignments</TabsTrigger><TabsTrigger value="marks">Marks</TabsTrigger></TabsList>
      <TabsContent value="students" className="pt-4">
        <div className="relative mb-5 max-w-sm"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Search students" placeholder="Search students or class" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        {!visibleStudents.length ? <Empty icon={<Users />} text={students.length ? "No matching students." : "No students added yet."} /> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr><th className="py-3 pr-4">Student</th><th className="py-3 pr-4">Class / group</th><th className="py-3">Marks recorded</th></tr></thead><tbody>{visibleStudents.map((s) => <tr key={s.id} className="border-b border-border"><td className="py-4 pr-4 font-medium">{s.name}</td><td className="py-4 pr-4 text-muted-foreground">{s.class_name || "—"}</td><td className="py-4">{marks.filter((m) => m.student_id === s.id).length}</td></tr>)}</tbody></table></div>}
      </TabsContent>
      <TabsContent value="assignments" className="pt-4">
        {!assignments.length ? <Empty icon={<ClipboardList />} text="No assignments added yet." /> : <div className="grid gap-4 sm:grid-cols-2">{assignments.map((a) => <article key={a.id} className="rounded-lg border border-border bg-card p-5"><p className="text-xs font-medium text-primary">{a.subject || "Assignment"}</p><h3 className="mt-2 break-words text-lg font-semibold">{a.title}</h3><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><span>Maximum: {a.max_marks}</span><span>Due: {a.due_date || "Not set"}</span></div><p className="mt-2 text-sm text-muted-foreground">{marks.filter((m) => m.assignment_id === a.id).length} / {students.length} marked</p></article>)}</div>}
      </TabsContent>
      <TabsContent value="marks" className="pt-4">
        {!marks.length ? <Empty icon={<Pencil />} text="No marks recorded yet." /> : <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr>{["Student", "Assignment", "Marks", "Feedback", ""].map((h) => <th key={h} className="py-3 pr-4">{h}</th>)}</tr></thead><tbody>{marks.map((m) => <tr key={m.id} className="border-b border-border"><td className="py-4 pr-4">{students.find((s) => s.id === m.student_id)?.name}</td><td className="py-4 pr-4">{assignments.find((a) => a.id === m.assignment_id)?.title}</td><td className="whitespace-nowrap py-4 pr-4 font-medium text-primary">{m.marks} / {assignments.find((a) => a.id === m.assignment_id)?.max_marks}</td><td className="max-w-xs break-words py-4 pr-4 text-muted-foreground">{m.feedback || "—"}</td><td><Button variant="ghost" size="icon" aria-label={`Edit marks for ${students.find((s) => s.id === m.student_id)?.name}`} title="Edit marks" onClick={() => { setMode("marks"); setError(""); chooseMark(m.student_id, m.assignment_id); }}><Pencil className="size-4" /></Button></td></tr>)}</tbody></table></div>}
      </TabsContent>
    </Tabs>}
    <Dialog open={mode !== null} onOpenChange={(next) => { if (!next && !busy) setMode(null); }}>
      <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{mode === "student" ? "Add student" : mode === "assignment" ? "Add assignment" : "Enter marks"}</DialogTitle><DialogDescription>{mode === "student" ? "Student record for your classroom only; no sign-in account is created." : mode === "assignment" ? "Assignment details" : "Student assignment result"}</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {mode === "student" && <><Field label="Student name" name="name" required maxLength={100} /><Field label="Class / group" name="className" maxLength={100} /></>}
          {mode === "assignment" && <><Field label="Assignment title" name="title" required maxLength={150} /><Field label="Subject" name="subject" maxLength={100} /><Field label="Due date" name="dueDate" type="date" /><Field label="Maximum marks" name="maxMarks" type="number" min="0.01" max="100000" step="0.01" defaultValue="100" required /></>}
          {mode === "marks" && <>
            <div className="space-y-2"><Label htmlFor="mark-student">Student</Label><select id="mark-student" value={studentId} onChange={(e) => chooseMark(e.target.value, assignmentId)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" required>{students.map((s) => <option key={s.id} value={s.id}>{s.name}{s.class_name ? ` · ${s.class_name}` : ""}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="mark-assignment">Assignment</Label><select id="mark-assignment" value={assignmentId} onChange={(e) => chooseMark(studentId, e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" required>{assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="mark-score">Marks{selected ? ` (out of ${selected.max_marks})` : ""}</Label><Input id="mark-score" type="number" min="0" max={selected?.max_marks} step="0.01" value={score} onChange={(e) => setScore(e.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="mark-feedback">Feedback (optional)</Label><Textarea id="mark-feedback" maxLength={1000} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></div>
          </>}
          {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setMode(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : mode === "student" ? "Save student" : mode === "assignment" ? "Save assignment" : "Save marks"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}
function Field({ label, name, ...props }: React.ComponentProps<typeof Input> & { label: string; name: string }) { return <div className="space-y-2"><Label htmlFor={`classroom-${name}`}>{label}</Label><Input id={`classroom-${name}`} name={name} {...props} /></div>; }
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="flex min-h-44 flex-col items-center justify-center gap-3 border-b border-border text-muted-foreground">{icon}<p className="text-sm">{text}</p></div>; }