import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const questionSchema = z.object({
  id: z.string(),
  concept: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  question: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number(),
  explanation: z.string(),
});
export type Question = z.infer<typeof questionSchema>;

const quizSchema = z.object({ concepts: z.array(z.string()), questions: z.array(questionSchema) });

export const generateAssessment = createServerFn({ method: "POST" })
  .inputValidator(z.object({ topic: z.string().min(2).max(120), level: z.string() }))
  .handler(async ({ data }) => {
    const { generateStructured } = await import("./ai.server");
    return generateStructured(
      quizSchema,
      "You are an expert diagnostic tutor. Create assessments that reveal precise misconceptions. Each wrong option should map to a plausible misconception. Exactly 4 options per question.",
      `Topic: ${data.topic}\nLearner level: ${data.level}\nIdentify 4 core sub-concepts of the topic, then write 8 multiple-choice questions spread across them (2 per concept), mixing easy/medium/hard. Use short ids q1..q8.`,
    );
  });

const answerSchema = z.object({
  concept: z.string(),
  question: z.string(),
  chosen: z.string(),
  correct: z.string(),
  isCorrect: z.boolean(),
  difficulty: z.string(),
  seconds: z.number(),
});

const analysisSchema = z.object({
  summary: z.string(),
  learningStyle: z.string(),
  mastery: z.array(z.object({ concept: z.string(), score: z.number(), status: z.enum(["mastered", "developing", "gap"]) })),
  gaps: z.array(
    z.object({
      concept: z.string(),
      misconception: z.string(),
      explanation: z.string(),
      analogy: z.string(),
      workedExample: z.string(),
    }),
  ),
  path: z.array(z.object({ step: z.number(), concept: z.string(), goal: z.string(), activity: z.string(), minutes: z.number() })),
  feedback: z.array(z.string()),
});
export type Analysis = z.infer<typeof analysisSchema>;

export const analyzeAnswers = createServerFn({ method: "POST" })
  .inputValidator(z.object({ topic: z.string(), level: z.string(), answers: z.array(answerSchema), history: z.string() }))
  .handler(async ({ data }) => {
    const { generateStructured } = await import("./ai.server");
    return generateStructured(
      analysisSchema,
      "You are an adaptive AI tutor. Diagnose knowledge gaps from answer patterns (wrong choices, difficulty, time taken). Write warm, specific, second-person feedback. Mastery score is 0-100 per concept. Learning path: 4-6 steps ordered from biggest gap to stretch goals. Feedback: 3-4 concrete, actionable tips.",
      `Topic: ${data.topic}\nLevel: ${data.level}\nPrior sessions: ${data.history || "none"}\nAnswers:\n${JSON.stringify(data.answers, null, 1)}`,
    );
  });

export const generatePractice = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ topic: z.string(), concept: z.string(), difficulty: z.enum(["easy", "medium", "hard"]), misconception: z.string() }),
  )
  .handler(async ({ data }) => {
    const { generateStructured } = await import("./ai.server");
    return generateStructured(
      z.object({ questions: z.array(questionSchema) }),
      "You are an adaptive tutor creating targeted practice. Exactly 4 options per question. Explanations should address why each wrong answer is tempting.",
      `Topic: ${data.topic}\nConcept: ${data.concept}\nTarget difficulty: ${data.difficulty}\nKnown misconception: ${data.misconception || "none"}\nWrite 3 fresh multiple-choice exercises on this concept only. ids p1..p3.`,
    );
  });
