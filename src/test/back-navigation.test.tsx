import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterContextProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { QUESTIONS, ANALYSIS } = vi.hoisted(() => ({
  QUESTIONS: [
    { id: "q1", concept: "Equivalent fractions", question: "Which equals 1/2?", options: ["2/4", "2/3", "3/5", "1/4"], correctIndex: 0, explanation: "2/4 reduces to 1/2.", difficulty: "easy" },
    { id: "q2", concept: "Adding fractions", question: "1/4 + 1/4 = ?", options: ["2/8", "1/2", "2/4s", "1/8"], correctIndex: 1, explanation: "Same denominator, so add the numerators.", difficulty: "easy" },
  ],
  ANALYSIS: {
    summary: "You are solid on halves.",
    learningStyle: "Worked examples help you most.",
    mastery: [{ concept: "Equivalent fractions", score: 50, status: "gap" }],
    feedback: ["Say why 2/4 and 1/2 are the same size."],
    path: [{ step: 1, concept: "Equivalent fractions", minutes: 10, goal: "See why 2/4 = 1/2", activity: "Sort fraction cards" }],
    gaps: [{ concept: "Equivalent fractions", misconception: "Bigger numbers mean a bigger fraction", explanation: "Size depends on the ratio, not the numbers.", analogy: "Pizza slices", workedExample: "2/4 = 1/2" }],
  },
}));

vi.mock("@/lib/tutor.functions", () => ({
  generateAssessment: vi.fn(async () => ({ questions: QUESTIONS })),
  analyzeAnswers: vi.fn(async () => ANALYSIS),
  generatePractice: vi.fn(async () => ({ questions: QUESTIONS })),
}));

// The app reads server functions through useServerFn; here they are plain fns, and
// the server-only builder behind them is stubbed so the modules can be imported at all.
vi.mock("@tanstack/react-start", () => {
  const builder = () => {
    const chain: Record<string, unknown> = {
      middleware: () => chain,
      inputValidator: () => chain,
      handler: (fn: unknown) => fn,
    };
    return chain;
  };
  return { useServerFn: (fn: unknown) => fn, createServerFn: () => builder() };
});

// Signed-out learner: progress lives in this browser, so nothing reaches the backend.
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

import type { ComponentType } from "react";
import { Route } from "@/routes/index";
import { routeTree } from "@/routeTree.gen";

const Screen = Route.options.component as ComponentType;
const menu = () => screen.getByRole("heading", { name: /the tutor that learns/i });
const atMenu = () => !!screen.queryByRole("heading", { name: /the tutor that learns/i });
const option = (text: string) => fireEvent.click(screen.getByText(text).closest("button")!);

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({ routeTree, context: { queryClient } });
  return render(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <Screen />
      </QueryClientProvider>
    </RouterContextProvider>,
  );
}

afterEach(cleanup);

describe("Back to menu", () => {
  it("goes back to the main menu from the check-up when nothing is answered yet", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Fractions" }));
    await screen.findByText("Which equals 1/2?");
    expect(atMenu()).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /back to menu/i }));

    expect(menu()).toBeInTheDocument();
  });

  it("asks first when answers would be thrown away, and keeps the check-up on 'Keep going'", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Fractions" }));
    await screen.findByText("Which equals 1/2?");
    option("2/4");
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByText("1/4 + 1/4 = ?");

    fireEvent.click(screen.getByRole("button", { name: /back to menu/i }));

    expect(await screen.findByText("Leave the check-up?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep going" }));
    expect(screen.getByText("1/4 + 1/4 = ?")).toBeInTheDocument();
    expect(atMenu()).toBe(false);
  });

  it("clears the check-up when leaving it for the menu", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Fractions" }));
    await screen.findByText("Which equals 1/2?");
    option("2/4");
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByText("1/4 + 1/4 = ?");

    fireEvent.click(screen.getByRole("button", { name: /back to menu/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Back to menu" }));

    expect(menu()).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fractions" }));
    expect(await screen.findByText("Which equals 1/2?")).toBeInTheDocument();
    expect(screen.queryByText("1/4 + 1/4 = ?")).not.toBeInTheDocument();
  });
});
