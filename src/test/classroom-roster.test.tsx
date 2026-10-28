// The classroom now shows a student's assignments and marks beside their own name, so the pairing
// itself is the rule under test: a stored result must sit inside that student's card, an unmarked
// assignment must say so, and one student's marks must never appear in another student's card.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterContextProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { authState, classroom } = vi.hoisted(() => ({
  authState: { session: null as null | { user: { id: string; email: string } } },
  classroom: {
    students: [
      { id: "11111111-1111-4111-8111-111111111111", name: "Maya Sharma", class_name: "10A" },
      { id: "22222222-2222-4222-8222-222222222222", name: "Arjun Nair", class_name: "10B" },
    ],
    assignments: [
      { id: "33333333-3333-4333-8333-333333333333", title: "Algebra check-in", subject: "Mathematics", due_date: "2026-11-01", max_marks: 50 },
      { id: "55555555-5555-4555-8555-555555555555", title: "Fractions quiz", subject: "Mathematics", due_date: "", max_marks: 20 },
    ],
    marks: [
      { id: "44444444-4444-4444-8444-444444444444", student_id: "11111111-1111-4111-8111-111111111111", assignment_id: "33333333-3333-4333-8333-333333333333", marks: 42, feedback: "Neat working." },
    ],
  },
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

vi.mock("@/lib/classroom.functions", () => ({
  getClassroom: vi.fn(async () => classroom),
  addStudent: vi.fn(async () => ({ saved: true })),
  addAssignment: vi.fn(async () => ({ saved: true })),
  removeStudent: vi.fn(async () => ({ removed: true, marksRemoved: 0 })),
  saveMark: vi.fn(async () => ({ saved: true })),
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
import { TeacherClassroom } from "@/components/teacher-classroom";

const MAYA = "11111111-1111-4111-8111-111111111111";
const ARJUN = "22222222-2222-4222-8222-222222222222";
const ALGEBRA = "33333333-3333-4333-8333-333333333333";

function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({ routeTree, context: { queryClient }, history: createMemoryHistory({ initialEntries: ["/teacher"] }) });
  return render(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TeacherClassroom />
        </AuthProvider>
      </QueryClientProvider>
    </RouterContextProvider>,
  );
}

function card(name: string) {
  const heading = screen.getByRole("heading", { name, level: 3 });
  const article = heading.closest("article");
  if (!article) throw new Error(`${name} is not shown as a classroom card`);
  return within(article as HTMLElement);
}

afterEach(() => {
  authState.session = null;
  classroom.students = [
    { id: MAYA, name: "Maya Sharma", class_name: "10A" },
    { id: ARJUN, name: "Arjun Nair", class_name: "10B" },
  ];
  classroom.marks = [{ id: "44444444-4444-4444-8444-444444444444", student_id: MAYA, assignment_id: ALGEBRA, marks: 42, feedback: "Neat working." }];
  vi.clearAllMocks();
});

describe("Classroom roster", () => {
  it("shows a student's stored marks beside their own name", async () => {
    authState.session = { user: { id: "t1", email: "ada@school.edu" } };
    mount();
    await screen.findByRole("heading", { name: "Maya Sharma", level: 3 });
    const maya = card("Maya Sharma");
    expect(maya.getByText("Algebra check-in")).toBeInTheDocument();
    expect(maya.getByText("42 / 50")).toBeInTheDocument();
    expect(maya.getByText(/Neat working\./)).toBeInTheDocument();
  });

  it("says not marked for an assignment with no stored result", async () => {
    authState.session = { user: { id: "t1", email: "ada@school.edu" } };
    mount();
    await screen.findByRole("heading", { name: "Arjun Nair", level: 3 });
    const arjun = card("Arjun Nair");
    expect(arjun.getByText("Fractions quiz")).toBeInTheDocument();
    expect(arjun.getAllByText("Not marked")).toHaveLength(2);
    expect(arjun.queryByText("42 / 50")).not.toBeInTheDocument();
  });

  it("keeps one student's marks out of another student's card", async () => {
    authState.session = { user: { id: "t1", email: "ada@school.edu" } };
    mount();
    await screen.findByRole("heading", { name: "Maya Sharma", level: 3 });
    expect(card("Maya Sharma").getByText("42 / 50")).toBeInTheDocument();
    expect(card("Arjun Nair").queryByText("42 / 50")).not.toBeInTheDocument();
    expect(card("Maya Sharma").getAllByText("Not marked")).toHaveLength(1);
  });

  it("opens the mark book prefilled for the student and assignment named in a card", async () => {
    authState.session = { user: { id: "t1", email: "ada@school.edu" } };
    mount();
    await screen.findByRole("heading", { name: "Maya Sharma", level: 3 });
    const link = card("Maya Sharma").getByRole("link", { name: `Edit marks for Maya Sharma — Algebra check-in` });
    expect(link).toHaveAttribute("href", expect.stringContaining("/teacher-marks"));
    expect(link.getAttribute("href")).toContain(`student=${MAYA}`);
    expect(link.getAttribute("href")).toContain(`assignment=${ALGEBRA}`);
  });

  it("narrows the roster to the student being searched for", async () => {
    authState.session = { user: { id: "t1", email: "ada@school.edu" } };
    mount();
    await screen.findByRole("heading", { name: "Maya Sharma", level: 3 });
    fireEvent.change(screen.getByLabelText("Search students"), { target: { value: "Arjun" } });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Maya Sharma", level: 3 })).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Arjun Nair", level: 3 })).toBeInTheDocument();
  });
});
