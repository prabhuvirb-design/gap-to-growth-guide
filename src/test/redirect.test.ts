import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/redirect";

describe("where sign-in may send the learner afterwards", () => {
  it("keeps a destination inside this app", () => {
    expect(safeNext("/account")).toBe("/account");
    expect(safeNext("/?topic=Fractions")).toBe("/?topic=Fractions");
  });

  it("reduces this app's own full address to a path", () => {
    const here = `${window.location.origin}/account?open=1`;
    expect(safeNext(here)).toBe("/account?open=1");
  });

  it("rejects anything that would leave this app", () => {
    expect(safeNext("https://somewhere-else.example/x")).toBeUndefined();
    expect(safeNext("http://somewhere-else.example/account")).toBeUndefined();
    expect(safeNext("//somewhere-else.example")).toBeUndefined();
    expect(safeNext("/\\somewhere-else.example")).toBeUndefined();
    expect(safeNext("account")).toBeUndefined();
    expect(safeNext("")).toBeUndefined();
    expect(safeNext(undefined)).toBeUndefined();
  });
});
