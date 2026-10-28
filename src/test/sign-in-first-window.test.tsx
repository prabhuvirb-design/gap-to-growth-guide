// Student or Teacher must be the first window after tapping "Sign in" or "Create account",
// and nothing may be written to the account before a choice exists — claim_account_type is
// first-write-wins, so a wrong default would be permanent.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterContextProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { authState, claimAccountType } = vi.hoisted(() => ({
  authState: { session: null as null | { user: { id: string; email: string } } },
  claimAccountType: vi.fn(async () => "teacher"),
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

vi.mock("@/lib/account.functions", () => ({
  claimAccountType,
  getAccountType: vi.fn(async () => "teacher"),
  getTeacherHome: vi.fn(async () => ({ name: "Ada", subject: "Fractions" })),
}));
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
import { AuthProvider } from "@/lib/auth-context";
import { Route } from "@/routes/auth";

const AuthScreen = Route.options.component as React.ComponentType;
let searchSpy: { mockRestore: () => void } | undefined;

// The address bar is the source of truth for the chosen account type, so each test hands the
// page the search params it would have been linked with.
function mount(search: Record<string, unknown>) {
  searchSpy = vi
    .spyOn(Route as unknown as { useSearch: () => unknown }, "useSearch")
    .mockReturnValue(search) as unknown as { mockRestore: () => void };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({ routeTree, context: { queryClient } });
  const view = render(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthScreen />
        </AuthProvider>
      </QueryClientProvider>
    </RouterContextProvider>,
  );
  return { ...view, router };
}

afterEach(() => {
  searchSpy?.mockRestore();
  searchSpy = undefined;
  authState.session = null;
  vi.clearAllMocks();
});

describe("Sign-in first window", () => {
  it("asks who is signing in before showing any form", () => {
    mount({});

    expect(screen.getByRole("heading", { name: /who is signing in\?/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /student/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /teacher/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("asks student or teacher first when creating an account too", () => {
    mount({ mode: "signup" });

    expect(screen.getByRole("heading", { name: /who is creating an account\?/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /student/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("keeps the tapped choice in the address", () => {
    const { router } = mount({});

    fireEvent.click(screen.getByRole("button", { name: /teacher/i }));

    expect(router.state.location.search.role).toBe("teacher");
  });

  it("shows that account's own form once a choice exists", () => {
    mount({ role: "teacher" });

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /teacher sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in as teacher/i })).toBeInTheDocument();
  });

  it("drops the choice from the address when “change” is used", () => {
    const { router } = mount({ role: "student" });

    fireEvent.click(screen.getByRole("button", { name: /student — change/i }));

    expect(router.state.location.search.role).toBeUndefined();
  });

  it("claims nothing for a signed-in learner who has not chosen yet", async () => {
    authState.session = { user: { id: "u1", email: "ada@school.edu" } };

    mount({});
    await waitFor(() => expect(screen.getByRole("button", { name: /teacher/i })).toBeInTheDocument());

    expect(claimAccountType).not.toHaveBeenCalled();
  });

  it("claims the chosen type for a signed-in learner", async () => {
    authState.session = { user: { id: "u1", email: "ada@school.edu" } };

    mount({ role: "teacher" });

    await waitFor(() => expect(claimAccountType).toHaveBeenCalled());
    expect(claimAccountType).toHaveBeenCalledWith({ data: { role: "teacher" } });
  });
});
