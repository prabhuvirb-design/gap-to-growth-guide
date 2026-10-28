export type Difficulty = "easy" | "medium" | "hard";
const order: Difficulty[] = ["easy", "medium", "hard"];

/** Level up when ≥ 2/3 of a round is right (all right if fewer than 3), level down when ≤ 1/3. */
export function nextDifficulty(current: Difficulty, results: boolean[]): Difficulty {
  if (!results.length) return current;
  const rate = results.filter(Boolean).length / results.length;
  const i = order.indexOf(current);
  if (rate >= 2 / 3) return order[Math.min(2, i + 1)];
  if (rate <= 1 / 3) return order[Math.max(0, i - 1)];
  return current;
}
