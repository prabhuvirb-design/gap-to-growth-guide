import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Difficulty } from "@/lib/adaptive";

const MAX_ITEMS = 40;

const masterySchema = z.object({
  concept: z.string(),
  score: z.number(),
  status: z.enum(["mastered", "developing", "gap"]),
});
const gapSchema = z.object({
  concept: z.string(),
  misconception: z.string(),
  explanation: z.string(),
  analogy: z.string(),
  workedExample: z.string(),
});
const pathSchema = z.object({
  step: z.number(),
  concept: z.string(),
  goal: z.string(),
  activity: z.string(),
  minutes: z.number(),
});

export const profileSchema = z.object({
  displayName: z.string().nullable(),
  preferredSubject: z.string().nullable(),
  level: z.string(),
});
export type Profile = z.infer<typeof profileSchema>;

export const savedSessionSchema = z.object({
  id: z.string(),
  topic: z.string(),
  level: z.string(),
  overall: z.number(),
  date: z.string(),
  summary: z.string(),
  learningStyle: z.string(),
  mastery: z.array(masterySchema),
  gaps: z.array(gapSchema),
  path: z.array(pathSchema),
  feedback: z.array(z.string()),
});
export type SavedSession = z.infer<typeof savedSessionSchema>;

export const newSessionSchema = z.object({
  topic: z.string().min(1).max(120),
  level: z.string().max(40),
  overall: z.number().int().min(0).max(100),
  summary: z.string().max(4000),
  learningStyle: z.string().max(4000),
  mastery: z.array(masterySchema).max(MAX_ITEMS),
  gaps: z.array(gapSchema).max(MAX_ITEMS),
  path: z.array(pathSchema).max(MAX_ITEMS),
  feedback: z.array(z.string()).max(MAX_ITEMS),
});
export type NewSession = z.infer<typeof newSessionSchema>;

const practiceSchema = z.object({
  topic: z.string(),
  concept: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  correct: z.number(),
  attempted: z.number(),
  updatedAt: z.string(),
});
export type PracticeRow = z.infer<typeof practiceSchema>;

type SessionRow = {
  id: string;
  topic: string;
  level: string;
  overall: number;
  created_at: string;
  summary: string | null;
  learning_style: string | null;
  mastery: unknown;
  gaps: unknown;
  path: unknown;
  feedback: unknown;
};

function toSavedSession(row: SessionRow): SavedSession {
  return savedSessionSchema.parse({
    id: row.id,
    topic: row.topic,
    level: row.level,
    overall: row.overall,
    date: row.created_at,
    summary: row.summary ?? "",
    learningStyle: row.learning_style ?? "",
    mastery: row.mastery ?? [],
    gaps: row.gaps ?? [],
    path: row.path ?? [],
    feedback: row.feedback ?? [],
  });
}

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("display_name, preferred_subject, level")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return profileSchema.parse({
      displayName: data?.display_name ?? null,
      preferredSubject: data?.preferred_subject ?? null,
      level: data?.level ?? "Beginner",
    });
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      displayName: z.string().trim().min(1).max(60),
      preferredSubject: z.string().trim().max(60).nullable(),
      level: z.enum(["Beginner", "Intermediate", "Advanced"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        display_name: data.displayName,
        preferred_subject: data.preferredSubject || null,
        level: data.level,
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("learning_sessions")
      .select("id, topic, level, overall, created_at, summary, learning_style, mastery, gaps, path, feedback")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data as SessionRow[]).map(toSavedSession);
  });

export const saveSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(newSessionSchema)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("learning_sessions").insert({
      user_id: context.userId,
      topic: data.topic,
      level: data.level,
      overall: data.overall,
      summary: data.summary,
      learning_style: data.learningStyle,
      mastery: data.mastery,
      gaps: data.gaps,
      path: data.path,
      feedback: data.feedback,
    });
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

/** Carries diagnostics saved on this browser before sign-in onto the learner's account. */
export const mergeSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      sessions: z
        .array(
          z.object({
            topic: z.string().min(1).max(120),
            overall: z.number().int().min(0).max(100),
            mastery: z.array(masterySchema).max(MAX_ITEMS),
          }),
        )
        .max(50),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!data.sessions.length) return 0;
    const { error } = await context.supabase
      .from("learning_sessions")
      .insert(data.sessions.map((s) => ({ user_id: context.userId, topic: s.topic, overall: s.overall, mastery: s.mastery })));
    if (error) throw new Error(error.message);
    return data.sessions.length;
  });

export const getPracticeLevel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ topic: z.string().max(120), concept: z.string().max(120) }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("practice_progress")
      .select("difficulty")
      .eq("user_id", context.userId)
      .eq("topic", data.topic)
      .eq("concept", data.concept)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row?.difficulty as Difficulty | undefined) ?? null;
  });

export const recordPractice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      topic: z.string().max(120),
      concept: z.string().max(120),
      difficulty: z.enum(["easy", "medium", "hard"]),
      correct: z.number().int().min(0).max(100),
      attempted: z.number().int().min(0).max(100),
    }),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("practice_progress")
      .upsert(
        {
          user_id: context.userId,
          topic: data.topic,
          concept: data.concept,
          difficulty: data.difficulty,
          correct: data.correct,
          attempted: data.attempted,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,topic,concept" },
      );
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

export const listPractice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("practice_progress")
      .select("topic, concept, difficulty, correct, attempted, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) =>
      practiceSchema.parse({
        topic: row.topic,
        concept: row.concept,
        difficulty: row.difficulty,
        correct: row.correct,
        attempted: row.attempted,
        updatedAt: row.updated_at,
      }),
    );
  });
