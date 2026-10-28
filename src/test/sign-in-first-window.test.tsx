// Student or Teacher must be the first window after tapping "Sign in" or "Create account",
// and nothing may be written to the account before a choice exists — claim_account_type is
// first-write-wins, so a wrong default would be permanent.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterContextProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { authState, claimAccountType, google } = vi.hoisted(() => ({
  authState: { session: null as null | { user: { id: string; email: string } } },
  claimAccountType: vi.fn(async () => "teacher"),
  google: vi.fn(async () => ({ redirected: true })),
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
  lovable: { auth: { signInWithOAuth: google } },
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
import { GoogleLogin } from "@/components/google-login";

const AuthScreen = Route.options.component as React.ComponentType;
let searchSpy: { mockRestore: () => void } | undefined;

// The address bar is the source of truth for the chosen account type, so each test hands the
// page the search params it would have been linked with.
function mount(search: Record<string, unknown>, role?: "student" | "teacher") {
  searchSpy = vi
    .spyOn(Route as unknown as { useSearch: () => unknown }, "useSearch")
    .mockReturnValue(search) as unknown as { mockRestore: () => void };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({ routeTree, context: { queryClient }, history: createMemoryHistory({ initialEntries: ["/auth"] }) });
  const view = render(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {role ? <GoogleLogin role={role} /> : <AuthScreen />}
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

describe("Separate Google login", () => {
  it("makes no account claim before the learner chooses a category", async () => {
    authState.session = { user: { id: "u1", email: "ada@school.edu" } };
    mount({});
    await waitFor(() => expect(screen.getByRole("link", { name: "Teacher" })).toBeInTheDocument());
    expect(claimAccountType).not.toHaveBeenCalled();
  });
  it("routes student and teacher choices to separate login pages", async () => {
    mount({});
    await screen.findByRole("link", { name: "Student" });
    expect(screen.getByRole("link", { name: "Student" })).toHaveAttribute("href", "/student-login");
    expect(screen.getByRole("link", { name: "Teacher" })).toHaveAttribute("href", "/teacher-login");
  });
  it.each(["student", "teacher"] as const)("uses Google with a public same-origin %s callback", async (role) => {
    mount({}, role);
    fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(google).toHaveBeenCalledWith("google", { redirect_uri: `${window.location.origin}/${role}-login` }));
  });
  it("claims the chosen teacher category only after authentication", async () => {
    authState.session = { user: { id: "u1", email: "ada@school.edu" } };
    mount({}, "teacher");
    await waitFor(() => expect(claimAccountType).toHaveBeenCalledWith({ data: { role: "teacher" } }));
  });
  it("does not send an existing student to the teacher workspace", async () => {
    claimAccountType.mockResolvedValueOnce("student");
    authState.session = { user: { id: "u1", email: "ada@school.edu" } };
    const { router } = mount({}, "teacher");
    await screen.findByRole("alert");
    expect(router.state.location.pathname).not.toBe("/teacher");
  });
});
