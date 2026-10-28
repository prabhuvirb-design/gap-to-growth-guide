import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterContextProvider } from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { authState, claimAccountType } = vi.hoisted(() => ({
  authState: { session: null as null | { user: { id: string; email: string } } },
  claimAccountType: vi.fn(async () => "teacher"),
}));

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
vi.mock("@/lib/account.functions", () => ({ claimAccountType, getAccountType: vi.fn(), getTeacherHome: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/lovable/index", () => ({ lovable: { auth: { signInWithOAuth: vi.fn() } } }));
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
import { Route } from "@/routes/auth";

const AuthScreen = Route.options.component as React.ComponentType;

function mount(search: Record<string, unknown>) {
  const spy = vi.spyOn(Route as unknown as { useSearch: () => unknown }, "useSearch").mockReturnValue(search);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({ routeTree, context: { queryClient } });
  const view = render(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <AuthScreen />
      </QueryClientProvider>
    </RouterContextProvider>,
  );
  return { ...view, router, spy };
}

describe("scratch2", () => {
  it("renders the picker when no role is in the address", () => {
    const { spy } = mount({ mode: "signup" });
    console.log("PICKER BODY:", document.body.innerHTML.slice(0, 400));
    spy.mockRestore();
    expect(screen.queryByText(/who is creating an account/i)).toBeTruthy();
  });

  it("records the choice in the address when a card is tapped", () => {
    const { router, spy } = mount({});
    fireEvent.click(screen.getByRole("button", { name: /teacher/i }));
    console.log("AFTER CLICK:", JSON.stringify(router.state.location.search));
    spy.mockRestore();
    expect(router.state.location.search.role).toBe("teacher");
  });
});
