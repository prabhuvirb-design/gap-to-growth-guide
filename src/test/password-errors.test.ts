import { describe, expect, it } from "vitest";
import { readable } from "@/routes/auth";

describe("readable auth errors", () => {
  it("explains the weak/leaked password rejection instead of blaming length", () => {
    const msg = readable(
      "Password is known to be weak and easy to guess, please choose a different one.",
    );
    expect(msg).toContain("too easy to guess");
    expect(msg).not.toContain("at least 6 characters");
  });

  it("still maps short-password errors to the length hint", () => {
    expect(readable("Password should be at least 6 characters")).toContain(
      "at least 6 characters",
    );
  });

  it("maps invalid credentials to the sign-in hint", () => {
    expect(readable("Invalid login credentials")).toContain("don’t match");
  });
});
