import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Deletes only the authenticated student; linked learning records cascade atomically. */
export const deleteStudentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ confirmation: z.literal("DELETE") }).strict())
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("user_roles")
      .select("role").eq("user_id", context.userId).maybeSingle();
    if (error || data?.role !== "student") {
      throw new Error("Only a signed-in student can delete their own account here.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.auth.admin.deleteUser(context.userId, false);
    if (result.error) throw new Error("Couldn’t delete your account. Nothing has been confirmed deleted; please try again.");
    return { deleted: true };
  });