import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { roleRead, deleteUser, state } = vi.hoisted(() => ({
  roleRead: vi.fn(), deleteUser: vi.fn(), state: { role: "student" as string | null, error: null as unknown },
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: z.ZodType;
    const chain = {
      middleware: () => chain,
      inputValidator: (schema: z.ZodType) => { validator = schema; return chain; },
      handler: (handler: (args: unknown) => unknown) => (args: { data: unknown; context: unknown }) => {
        validator.parse(args.data);
        return handler(args);
      },
    };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { auth: { admin: { deleteUser } } } }));
import { deleteStudentAccount } from "@/lib/delete-account.functions";

const call = deleteStudentAccount as unknown as (args: unknown) => Promise<unknown>;
function args(data: unknown = { confirmation: "DELETE" }) {
  return { data, context: { userId: "current-student", supabase: { from: () => ({ select: () => ({ eq: roleRead }) }) } } };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.role = "student";
  state.error = null;
  roleRead.mockImplementation(() => ({ maybeSingle: async () => ({ data: state.role ? { role: state.role } : null, error: state.error }) }));
  deleteUser.mockResolvedValue({ error: null });
});
describe("permanent student self-deletion", () => {
  it("hard-deletes only the authenticated student's identity", async () => {
    await expect(call(args())).resolves.toEqual({ deleted: true });
    expect(roleRead).toHaveBeenCalledWith("user_id", "current-student");
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith("current-student", false);
  });
  it("does not accept another student's ID", () => {
    expect(() => call(args({ confirmation: "DELETE", userId: "another-student" }))).toThrow();
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it("requires explicit DELETE confirmation", () => {
    expect(() => call(args({ confirmation: "delete" }))).toThrow();
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it("rejects teacher accounts", async () => {
    state.role = "teacher";
    await expect(call(args())).rejects.toThrow("Only a signed-in student");
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it("rejects accounts without a stored student category", async () => {
    state.role = null;
    await expect(call(args())).rejects.toThrow();
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it("does not claim success when identity deletion fails", async () => {
    deleteUser.mockResolvedValue({ error: new Error("failure") });
    await expect(call(args())).rejects.toThrow("Couldn’t delete your account");
  });
});