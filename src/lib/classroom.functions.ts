import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { studentSchema, assignmentSchema, markSchema, removeStudentSchema, validateMarks } from "@/lib/classroom";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function requireTeacher(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (error || data?.role !== "teacher") throw new Error("This workspace is for teacher accounts.");
}

export const getClassroom = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireTeacher(context.supabase, context.userId);
  const [students, assignments, marks] = await Promise.all([
    context.supabase.from("teacher_students").select("id, name, class_name").eq("teacher_id", context.userId).order("name"),
    context.supabase.from("teacher_assignments").select("id, title, subject, due_date, max_marks").eq("teacher_id", context.userId).order("created_at", { ascending: false }),
    context.supabase.from("teacher_marks").select("id, student_id, assignment_id, marks, feedback").eq("teacher_id", context.userId),
  ]);
  if (students.error || assignments.error || marks.error) throw new Error("Couldn’t load your classroom. Please retry.");
  return { students: students.data, assignments: assignments.data, marks: marks.data };
});

export const addStudent = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(studentSchema).handler(async ({ data, context }) => {
  await requireTeacher(context.supabase, context.userId);
  const result = await context.supabase.from("teacher_students").insert({ teacher_id: context.userId, name: data.name, class_name: data.className });
  if (result.error) throw new Error("Couldn’t add the student. Please retry.");
  return { saved: true };
});

export const removeStudent = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(removeStudentSchema).handler(async ({ data, context }) => {
  await requireTeacher(context.supabase, context.userId);
  // The row must be this teacher's own; an id alone never authorises a removal.
  const owned = await context.supabase.from("teacher_students").select("id").eq("id", data.studentId).eq("teacher_id", context.userId).maybeSingle();
  if (owned.error || !owned.data) throw new Error("Choose a student from your own classroom.");
  const stored = await context.supabase.from("teacher_marks").select("id", { count: "exact", head: true }).eq("student_id", data.studentId).eq("teacher_id", context.userId);
  const result = await context.supabase.from("teacher_students").delete().eq("id", data.studentId).eq("teacher_id", context.userId);
  if (result.error) throw new Error("Couldn’t remove the student. Please retry.");
  return { removed: true, marksRemoved: stored.count ?? 0 };
});

export const addAssignment = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(assignmentSchema).handler(async ({ data, context }) => {
  await requireTeacher(context.supabase, context.userId);
  const result = await context.supabase.from("teacher_assignments").insert({ teacher_id: context.userId, title: data.title, subject: data.subject, due_date: data.dueDate || null, max_marks: data.maxMarks });
  if (result.error) throw new Error("Couldn’t add the assignment. Please retry.");
  return { saved: true };
});

export const saveMark = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(markSchema).handler(async ({ data, context }) => {
  await requireTeacher(context.supabase, context.userId);
  const [student, assignment] = await Promise.all([
    context.supabase.from("teacher_students").select("id").eq("id", data.studentId).eq("teacher_id", context.userId).maybeSingle(),
    context.supabase.from("teacher_assignments").select("max_marks").eq("id", data.assignmentId).eq("teacher_id", context.userId).maybeSingle(),
  ]);
  if (student.error || assignment.error || !student.data || !assignment.data) throw new Error("Choose a student and assignment from your classroom.");
  validateMarks(data.marks, assignment.data.max_marks);
  const result = await context.supabase.from("teacher_marks").upsert({ teacher_id: context.userId, student_id: data.studentId, assignment_id: data.assignmentId, marks: data.marks, feedback: data.feedback, updated_at: new Date().toISOString() }, { onConflict: "student_id,assignment_id" });
  if (result.error) throw new Error("Couldn’t save the marks. Please retry.");
  return { saved: true };
});