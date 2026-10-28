import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAccountType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error("Couldn’t load your account type.");
    return data?.role ?? null;
  });

export const claimAccountType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ role: z.enum(["student", "teacher"]) }))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("claim_account_type", { chosen: data.role });
    if (result.error) throw new Error("Couldn’t save your account type.");
    return result.data;
  });

export const getTeacherHome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
    if (error || data?.role !== "teacher") throw new Error("This page is for teacher accounts.");
    const profile = await context.supabase.from("profiles").select("display_name, preferred_subject").eq("id", context.userId).maybeSingle();
    if (profile.error) throw new Error("Couldn’t load your teacher profile.");
    return { name: profile.data?.display_name ?? "Teacher", subject: profile.data?.preferred_subject ?? null };
  });