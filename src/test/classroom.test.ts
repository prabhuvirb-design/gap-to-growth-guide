import { describe, expect, it } from "vitest";
import { studentSchema, assignmentSchema, markSchema, removeStudentSchema, validateMarks } from "@/lib/classroom";

describe("classroom records", () => {
  it("requires a student name", () => {
    expect(studentSchema.safeParse({ name: "  ", className: "10A" }).success).toBe(false);
    expect(studentSchema.parse({ name: " Maya ", className: "10A" }).name).toBe("Maya");
  });
  it("requires a positive assignment maximum", () => {
    expect(assignmentSchema.safeParse({ title: "Algebra", subject: "Math", dueDate: "", maxMarks: 0 }).success).toBe(false);
    expect(assignmentSchema.parse({ title: "Algebra", subject: "Math", dueDate: "2026-11-01", maxMarks: 50 }).maxMarks).toBe(50);
  });
  it("allows zero and full marks", () => {
    expect(() => validateMarks(0, 50)).not.toThrow();
    expect(() => validateMarks(50, 50)).not.toThrow();
  });
  it("rejects marks above the assignment maximum", () => {
    expect(() => validateMarks(51, 50)).toThrow("between 0 and 50");
  });
  it("rejects negative marks", () => {
    expect(() => validateMarks(-1, 50)).toThrow();
  });
  it("does not accept a client-selected teacher identity", () => {
    expect(studentSchema.safeParse({ name: "Maya", className: "10A", teacher_id: "someone-else" }).success).toBe(false);
    expect(markSchema.safeParse({ studentId: "b6e3c62f-6523-4b15-b844-8fab400eef34", assignmentId: "1299c5ef-c660-4e78-a3dc-954d314455af", marks: 10, feedback: "", teacher_id: "someone-else" }).success).toBe(false);
  });
  it("removal names only a real student record", () => {
    expect(removeStudentSchema.safeParse({ studentId: "b6e3c62f-6523-4b15-b844-8fab400eef34" }).success).toBe(true);
    expect(removeStudentSchema.safeParse({ studentId: "not-a-student" }).success).toBe(false);
  });
  it("a removal cannot carry a teacher identity or another record", () => {
    expect(removeStudentSchema.safeParse({ studentId: "b6e3c62f-6523-4b15-b844-8fab400eef34", teacher_id: "someone-else" }).success).toBe(false);
    expect(removeStudentSchema.safeParse({ studentId: "b6e3c62f-6523-4b15-b844-8fab400eef34", name: "Maya" }).success).toBe(false);
  });
});