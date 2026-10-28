import { describe, expect, it } from "vitest";
import { accountHome, matchesAccountType } from "@/lib/account-type";

describe("student and teacher accounts", () => {
  it("sends students to the tutor", () => { expect(accountHome("student")).toBe("/"); });
  it("sends teachers to a separate home", () => { expect(accountHome("teacher")).toBe("/teacher"); });
  it("does not let a teacher sign in as a student", () => { expect(matchesAccountType("teacher", "student")).toBe(false); });
  it("does not let a student sign in as a teacher", () => { expect(matchesAccountType("student", "teacher")).toBe(false); });
});