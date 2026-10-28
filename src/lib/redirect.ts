/** Where a sign-in flow may send the learner afterwards: paths inside this app only. */
const NEXT_KEY = "mentora-next";

export function safeNext(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith("/")) return undefined;
  if (value.startsWith("//") || value.startsWith("/\\")) return undefined;
  if (value.includes("://")) return undefined;
  return value;
}

export function rememberNext(value: string | null | undefined): void {
  const safe = safeNext(value);
  try {
    if (safe) window.sessionStorage.setItem(NEXT_KEY, safe);
    else window.sessionStorage.removeItem(NEXT_KEY);
  } catch {
    /* storage unavailable: the learner simply lands on the home screen */
  }
}

/** Reads and clears the stored destination. Call from an effect or handler, never during render. */
export function takeNext(): string | undefined {
  try {
    const stored = window.sessionStorage.getItem(NEXT_KEY);
    window.sessionStorage.removeItem(NEXT_KEY);
    return safeNext(stored);
  } catch {
    return undefined;
  }
}
