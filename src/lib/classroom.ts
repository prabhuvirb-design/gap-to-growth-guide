import { z } from "zod";

export const studentSchema = z.object({ name: z.string().trim().min(1, "Enter a student name.").max(100), className: z.string().trim().max(100) }).strict();
export const assignmentSchema = z.object({ title: z.string().trim().min(1, "Enter an assignment title.").max(150), subject: z.string().trim().max(100), dueDate: z.string().refine((v) => {
  if (v === "") return true;
  const date = new Date(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
}, "Enter a valid due date."), maxMarks: z.number().finite().positive("Maximum marks must be greater than zero.").max(100000) }).strict();
export const markSchema = z.object({ studentId: z.string().uuid(), assignmentId: z.string().uuid(), marks: z.number().finite().min(0, "Marks cannot be negative."), feedback: z.string().trim().max(1000) }).strict();
export const removeStudentSchema = z.object({ studentId: z.string().uuid("Choose the student to remove.") }).strict();
export function validateMarks(marks: number, maximum: number) {
  if (!Number.isFinite(marks) || marks < 0 || marks > maximum) throw new Error(`Enter marks between 0 and ${maximum}.`);
}