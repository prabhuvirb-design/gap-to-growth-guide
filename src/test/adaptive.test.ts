import { describe, expect, it } from "vitest";
import { nextDifficulty } from "@/lib/adaptive";

describe("nextDifficulty", () => {
  it("levels up after a strong round", () => expect(nextDifficulty("easy", [true, true, false])).toBe("medium"));
  it("levels down after a weak round", () => expect(nextDifficulty("hard", [false, false, true])).toBe("medium"));
  it("stays at hard when already at top", () => expect(nextDifficulty("hard", [true, true, true])).toBe("hard"));
  it("stays at easy when struggling at bottom", () => expect(nextDifficulty("easy", [false, false, false])).toBe("easy"));
});
