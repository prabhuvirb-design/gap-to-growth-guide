// The account type (Student or Teacher) must be the first window after tapping
// "Sign in" or "Create account", and nothing may be written to the account before
// a choice exists — claim_account_type is first-write-wins, so a wrong default is permanent.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { authState, claimAccountType, getAccountType, getTeacherHome } = vi.hoisted(() => ({
  authState: { session: null as null | { user: { id: string; email: string } } },
  claimAccountType: vi.fn(async () => "teacher"),
  getAccountType: vi.fn(async () => "teacher"),
  getTeacherHome: vi.fn(async () => ({ name: "Ada", subject: "Fractions" })),
}));

// Server functions are plain fns here; the builder behind them is stubbed so modules import at all.
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

vi.mock("@/lib/account.functions", () => ({ claimAccountType, getAccountType, getTeacherHome }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/lovable/index", () => ({
  lovable: { auth: { signInWithOAuth: vi.fn(async () => ({ redirected: false })) } },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: authState.session } }),
      getUser: async () => ({ data: { user: authState.session?.user ?? null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: vi.fn(async () => ({ error: null })),
      signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
      resetPasswordForEmail: vi.fn(async () => ({})),
    },
  },
}));

import { routeTree } from "@/routeTree.gen";

function renderAuth(search = "") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [`/auth${search}`] }),
    context: { queryClient },
  });
  const view = render(
    <RouterProvider router={router} />
  );
  return { ...view, router };
}

afterEach(() => {
  cleanup();
  authState.session = null;
  vi.clearAllMocks();
});

describe("Sign-in first window", () => {
  it("asks Student or Teacher before showing any form", () => {
    renderAuth("?mode=signup");

    expect(screen.getByRole("heading", { name: /who is creating an account\?/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /student/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /teacher/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("opens the chosen account's form and keeps the choice in the address", async () => {
    const { router } = renderAuth();

    fireEvent.click(screen.getByRole("button", { name: /teacher/i }));

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /teacher account creation|teacher sign in/i })).toBeInTheDocument();
    expect(router.state.location.search.role).toBe("teacher");
  });

  it("returns to the choice window from “change”", async () => {
    renderAuth();

    fireEvent.click(screen.getByRole("button", { name: /student/i }));
    await screen.findByLabelText("Email");

    fireEvent.click(screen.getByRole("button", { name: /student — change/i }));

    expect(await screen.findByRole("heading", { name: /who is signing in\?/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("claims nothing for a signed-in learner who has not chosen yet", async () => {
    authState.session = { user: { id: "u1", email: "ada@school.edu" } };

    renderAuth();
    await waitFor(() => expect(screen.getByRole("button", { name: /teacher/i })).toBeInTheDocument());

    expect(claimAccountType).not.toHaveBeenCalled();
  });

  it("claims the chosen type for a signed-in learner", async () => {
    authState.session = { user: { id: "u1", email: "ada@school.edu" } };

    renderAuth("?role=teacher");

    await waitFor(() => expect(claimAccountType).toHaveBeenCalled());
    expect(claimAccountType).toHaveBeenCalledWith({ data: { role: "teacher" } });
  });
});
