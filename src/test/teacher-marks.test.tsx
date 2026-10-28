// The mark book is the one place a teacher stores a student's result, so the rules that decide
// what reaches the database have to hold here: the score must be within the assignment maximum,
// it must land against the chosen student/assignment pair, and an existing record must be shown
// before it is overwritten.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterContextProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { authState, classroom, saveMark } = vi.hoisted(() => ({
  authState: { session: null as null | { user: { id: string; email: string } } },
  classroom: {
    students: [
      { id: "11111111-1111-4111-8111-111111111111", name: "Maya Sharma", class_name: "10A" },
      { id: "22222222-2222-4222-8222-222222222222", name: "Arjun Nair", class_name: "10A" },
    ],
    assignments: [
      { id: "33333333-3333-4333-8333-333333333333", title: "Algebra check-in", subject: "Mathematics", due_date: "2026-11-01", max_marks: 50 },
    ],
    marks: [
      { id: "44444444-4444-4444-8444-444444444444", student_id: "11111111-1111-4111-8111-111111111111", assignment_id: "33333333-3333-4333-8333-333333333333", marks: 42, feedback: "Neat working." },
    ],
  },
  saveMark: vi.fn(async () => ({ saved: true })),
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

vi.mock("@/lib/classroom.functions", () => ({
  getClassroom: vi.fn(async () => classroom),
  addStudent: vi.fn(async () => ({ saved: true })),
  addAssignment: vi.fn(async () => ({ saved: true })),
  saveMark,
}));
vi.mock("@/lib/account.functions", () => ({
  getAccountType: vi.fn(async () => "teacher"),
  getTeacherHome: vi.fn(async () => ({ name: "Ada", subject: "Fractions" })),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: authState.session } }),
      getUser: async () => ({ data: { user: authState.session?.user ?? null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

import { routeTree } from "@/routeTree.gen";
import { AuthProvider } from "@/lib/auth-context";
import { Route } from "@/routes/_authenticated/teacher-marks";

const MarkBookScreen = Route.options.component as React.ComponentType;
const MAYA = "11111111-1111-4111-8111-111111111111";
const ARJUN = "22222222-2222-4222-8222-222222222222";
const ALGEBRA = "33333333-3333-4333-8333-333333333333";
let searchSpy: { mockRestore: () => void } | undefined;

function mount(search: Record<string, unknown>) {
  searchSpy = vi
    .spyOn(Route as unknown as { useSearch: () => unknown }, "useSearch")
    .mockReturnValue(search) as unknown as { mockRestore: () => void };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({ routeTree, context: { queryClient }, history: createMemoryHistory({ initialEntries: ["/teacher-marks"] }) });
  const view = render(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MarkBookScreen />
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
  classroom.students = [
    { id: MAYA, name: "Maya Sharma", class_name: "10A" },
    { id: ARJUN, name: "Arjun Nair", class_name: "10A" },
  ];
  classroom.marks = [{ id: "44444444-4444-4444-8444-444444444444", student_id: MAYA, assignment_id: ALGEBRA, marks: 42, feedback: "Neat working." }];
  vi.clearAllMocks();
});

describe("Mark book", () => {
  it("serves the mark book at /teacher-marks", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/teacher-marks").at(-1)?.routeId).not.toBe("rootRouteId");
  });

  it("shows the marks already stored before overwriting them", async () => {
    authState.session = { user: { id: "t1", email: "ada@school.edu" } };
    mount({ student: MAYA, assignment: ALGEBRA });
    const score = await screen.findByLabelText("Marks (out of 50)");
    await waitFor(() => expect(score).toHaveValue("42"));
    expect(screen.getByText(/Already stored: 42 \/ 50/)).toBeInTheDocument();
  });

  it("stores the marks the teacher enters against the chosen student and assignment", async () => {
    authState.session = { user: { id: "t1", email: "ada@school.edu" } };
    mount({ student: ARJUN, assignment: ALGEBRA });
    const score = await screen.findByLabelText("Marks (out of 50)");
    fireEvent.change(score, { target: { value: "37.5" } });
    fireEvent.change(screen.getByLabelText("Feedback (optional)"), { target: { value: "Review the last two steps." } });
    fireEvent.click(screen.getByRole("button", { name: "Save marks" }));
    await waitFor(() => expect(saveMark).toHaveBeenCalledWith({
      data: { studentId: ARJUN, assignmentId: ALGEBRA, marks: 37.5, feedback: "Review the last two steps." },
    }));
  });

  it("refuses marks above the assignment maximum and stores nothing", async () => {
    authState.session = { user: { id: "t1", email: "ada@school.edu" } };
    mount({ student: MAYA, assignment: ALGEBRA });
    const score = await screen.findByLabelText("Marks (out of 50)");
    fireEvent.change(score, { target: { value: "51" } });
    fireEvent.click(screen.getByRole("button", { name: "Save marks" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("between 0 and 50"));
    expect(saveMark).not.toHaveBeenCalled();
  });

  it("asks for a student and an assignment before any marks can be stored", async () => {
    authState.session = { user: { id: "t1", email: "ada@school.edu" } };
    classroom.students = [];
    classroom.marks = [];
    mount({});
    await screen.findByText("Add a student and an assignment before recording marks.");
    expect(screen.queryByRole("button", { name: "Save marks" })).not.toBeInTheDocument();
    expect(saveMark).not.toHaveBeenCalled();
  });
});
