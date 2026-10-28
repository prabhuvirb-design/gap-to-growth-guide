import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { analyzeAnswers, generateAssessment, generatePractice, type Analysis, type Question } from "@/lib/tutor.functions";
import { nextDifficulty, type Difficulty } from "@/lib/adaptive";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mentora — The AI tutor that learns how you learn" },
      { name: "description", content: "Diagnose knowledge gaps, get personalized explanations, and follow an adaptive learning path." },
      { property: "og:title", content: "Mentora — Adaptive AI Tutor" },
      { property: "og:description", content: "Diagnose knowledge gaps and follow a learning path that adapts to you." },
    ],
  }),
  component: App,
});

type Answer = { concept: string; question: string; chosen: string; correct: string; isCorrect: boolean; difficulty: string; seconds: number };
type Session = { topic: string; date: string; overall: number; mastery: Analysis["mastery"] };
const LS = "mentora-sessions";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

function App() {
  const [stage, setStage] = useState<"setup" | "loading" | "quiz" | "analyzing" | "results">("setup");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("Beginner");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const gen = useServerFn(generateAssessment);
  const analyze = useServerFn(analyzeAnswers);

  useEffect(() => {
    try { setSessions(JSON.parse(localStorage.getItem(LS) || "[]")); } catch { /* empty */ }
  }, []);

  async function start(t = topic) {
    if (t.trim().length < 2) return;
    setTopic(t); setError(""); setStage("loading");
    try {
      const q = await gen({ data: { topic: t, level } });
      setQuestions(q.questions); setAnswers([]); setStage("quiz");
    } catch (e) { setError(errMsg(e)); setStage("setup"); }
  }

  async function finish(all: Answer[]) {
    setStage("analyzing");
    const history = sessions.filter((s) => s.topic.toLowerCase() === topic.toLowerCase())
      .map((s) => `${s.date}: ${s.mastery.map((m) => `${m.concept} ${m.score}`).join(", ")}`).join("\n");
    try {
      const a = await analyze({ data: { topic, level, answers: all, history } });
      setAnalysis(a);
      const overall = Math.round(a.mastery.reduce((s, m) => s + m.score, 0) / Math.max(1, a.mastery.length));
      const next = [{ topic, date: new Date().toLocaleDateString(), overall, mastery: a.mastery }, ...sessions].slice(0, 20);
      setSessions(next); localStorage.setItem(LS, JSON.stringify(next));
      setStage("results");
    } catch (e) { setError(errMsg(e)); setStage("quiz"); }
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <button onClick={() => setStage("setup")} className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground">m</span>
          <span className="font-display text-xl font-semibold">Mentora</span>
        </button>
        <span className="text-sm text-muted-foreground">{sessions.length} sessions tracked</span>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-20">
        {error && <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
        {stage === "setup" && <Setup {...{ topic, setTopic, level, setLevel, start, sessions }} />}
        {(stage === "loading" || stage === "analyzing") && (
          <Thinking text={stage === "loading" ? `Designing a diagnostic for “${topic}”…` : "Mapping your knowledge and building your path…"} />
        )}
        {stage === "quiz" && <Quiz questions={questions} onDone={(a) => { setAnswers(a); finish(a); }} retry={answers.length ? () => finish(answers) : undefined} />}
        {stage === "results" && analysis && <Results topic={topic} analysis={analysis} restart={() => start(topic)} sessions={sessions} />}
      </main>
    </div>
  );
}

function Setup({ topic, setTopic, level, setLevel, start, sessions }: {
  topic: string; setTopic: (s: string) => void; level: string; setLevel: (s: string) => void; start: (t?: string) => void; sessions: Session[];
}) {
  const ideas = ["Photosynthesis", "Python loops", "Fractions", "Newton's laws", "Supply & demand", "World War I causes"];
  return (
    <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
      <section className="rise pt-8">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary">Adaptive AI tutor</p>
        <h1 className="text-5xl font-extrabold leading-[1.05] md:text-6xl">The tutor that learns<br /><em className="text-primary">how you learn.</em></h1>
        <p className="mt-5 max-w-lg text-lg text-muted-foreground">Take a quick diagnostic. We find your blind spots, explain them your way, and build a path that adapts as you practice.</p>
        <form className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); start(); }}>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What do you want to learn?" className="h-12 bg-card text-base" />
          <Button type="submit" size="lg" className="h-12 px-6">Start diagnostic →</Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Beginner", "Intermediate", "Advanced"].map((l) => (
            <Button key={l} type="button" size="sm" variant={level === l ? "default" : "outline"} onClick={() => setLevel(l)}>{l}</Button>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <span className="text-muted-foreground">Try:</span>
          {ideas.map((i) => <button key={i} onClick={() => start(i)} className="underline decoration-primary/40 underline-offset-4 hover:text-primary">{i}</button>)}
        </div>
      </section>
      <section className="rise">
        <Card className="p-6 shadow-soft">
          <h2 className="text-2xl font-semibold">Your progress</h2>
          {sessions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No sessions yet. Your mastery over time will appear here.</p>
          ) : <History sessions={sessions} />}
        </Card>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
          {[["1", "Assess"], ["2", "Diagnose"], ["3", "Adapt"]].map(([n, l]) => (
            <div key={n} className="rounded-xl border bg-card p-4"><div className="font-display text-3xl text-primary">{n}</div>{l}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

function History({ sessions }: { sessions: Session[] }) {
  return (
    <ul className="mt-4 space-y-3">
      {sessions.slice(0, 6).map((s, i) => (
        <li key={i}>
          <div className="flex justify-between text-sm"><span className="font-medium">{s.topic}</span><span className="text-muted-foreground">{s.date} · {s.overall}%</span></div>
          <Progress value={s.overall} className="mt-1 h-2" />
        </li>
      ))}
    </ul>
  );
}

function Thinking({ text }: { text: string }) {
  return (
    <div className="grid place-items-center py-32 text-center">
      <div className="flex gap-2">{[0, 1, 2].map((i) => <span key={i} className="h-3 w-3 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
      <p className="mt-6 font-display text-2xl">{text}</p>
    </div>
  );
}

function QuestionCard({ q, onAnswer, label }: { q: Question; onAnswer: (idx: number, secs: number) => void; label: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const t0 = useRef(Date.now());
  useEffect(() => { setPicked(null); t0.current = Date.now(); }, [q.id, q.question]);
  return (
    <Card className="rise p-8 shadow-soft">
      <div className="mb-4 flex gap-2"><Badge variant="secondary">{q.concept}</Badge><Badge variant="outline">{q.difficulty}</Badge><span className="ml-auto text-sm text-muted-foreground">{label}</span></div>
      <h2 className="text-2xl font-semibold leading-snug">{q.question}</h2>
      <div className="mt-6 grid gap-3">
        {q.options.map((o, i) => {
          const state = picked === null ? "" : i === q.correctIndex ? "border-success bg-success/10" : i === picked ? "border-destructive bg-destructive/10" : "opacity-60";
          return (
            <button key={i} disabled={picked !== null} onClick={() => setPicked(i)} className={`rounded-xl border-2 bg-card p-4 text-left transition hover:border-primary ${state}`}>
              <span className="mr-3 font-display text-primary">{String.fromCharCode(65 + i)}</span>{o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="rise mt-6 rounded-xl bg-muted p-4 text-sm">
          <p className="font-semibold">{picked === q.correctIndex ? "Correct!" : "Not quite."}</p>
          <p className="mt-1 text-muted-foreground">{q.explanation}</p>
          <Button className="mt-4" onClick={() => onAnswer(picked, (Date.now() - t0.current) / 1000)}>Continue →</Button>
        </div>
      )}
    </Card>
  );
}

function Quiz({ questions, onDone, retry }: { questions: Question[]; onDone: (a: Answer[]) => void; retry?: () => void }) {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<Answer[]>([]);
  if (retry) return <div className="py-20 text-center"><Button onClick={retry}>Retry analysis</Button></div>;
  const q = questions[i];
  return (
    <div className="mx-auto max-w-2xl">
      <Progress value={(i / questions.length) * 100} className="mb-6 h-2" />
      <QuestionCard q={q} label={`${i + 1} / ${questions.length}`} onAnswer={(idx, secs) => {
        const next = [...ans, { concept: q.concept, question: q.question, chosen: q.options[idx], correct: q.options[q.correctIndex], isCorrect: idx === q.correctIndex, difficulty: q.difficulty, seconds: Math.round(secs) }];
        setAns(next);
        if (i + 1 < questions.length) setI(i + 1); else onDone(next);
      }} />
    </div>
  );
}

const statusColor = { mastered: "bg-success", developing: "bg-warning", gap: "bg-destructive" } as const;

function Results({ topic, analysis, restart, sessions }: { topic: string; analysis: Analysis; restart: () => void; sessions: Session[] }) {
  const [practice, setPractice] = useState<Analysis["gaps"][number] | null>(null);
  return (
    <div className="space-y-8">
      <section className="rise">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Your diagnosis · {topic}</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-bold">{analysis.summary}</h1>
        <p className="mt-3 text-muted-foreground"><strong className="text-foreground">How you learn:</strong> {analysis.learningStyle}</p>
      </section>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-6 shadow-soft">
          <h2 className="text-2xl font-semibold">Mastery map</h2>
          <ul className="mt-4 space-y-4">
            {analysis.mastery.map((m) => (
              <li key={m.concept}>
                <div className="flex items-center justify-between text-sm"><span className="font-medium">{m.concept}</span><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${statusColor[m.status]}`} />{m.score}%</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full ${statusColor[m.status]}`} style={{ width: `${m.score}%` }} /></div>
              </li>
            ))}
          </ul>
          <h3 className="mt-8 text-lg font-semibold">Actionable feedback</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{analysis.feedback.map((f, i) => <li key={i}>{f}</li>)}</ul>
          {sessions.length > 1 && <><h3 className="mt-8 text-lg font-semibold">Progress over time</h3><History sessions={sessions} /></>}
        </Card>
        <Card className="p-6 shadow-soft">
          <h2 className="text-2xl font-semibold">Your learning path</h2>
          <ol className="mt-4 space-y-4 border-l-2 border-primary/30 pl-6">
            {analysis.path.map((p) => (
              <li key={p.step} className="relative">
                <span className="absolute -left-[35px] grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{p.step}</span>
                <p className="font-semibold">{p.concept} <span className="text-sm font-normal text-muted-foreground">· {p.minutes} min</span></p>
                <p className="text-sm">{p.goal}</p>
                <p className="text-sm text-muted-foreground">{p.activity}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
      <section>
        <h2 className="text-3xl font-semibold">Close your gaps</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {analysis.gaps.map((g) => (
            <Card key={g.concept} className="p-6 shadow-soft">
              <Badge variant="secondary">{g.concept}</Badge>
              <p className="mt-3 text-sm"><strong>Likely misconception:</strong> {g.misconception}</p>
              <p className="mt-3">{g.explanation}</p>
              <p className="mt-3 rounded-lg bg-accent p-3 text-sm text-accent-foreground"><strong>Think of it like:</strong> {g.analogy}</p>
              <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground"><strong className="text-foreground">Worked example:</strong> {g.workedExample}</p>
              <Button className="mt-4" onClick={() => setPractice(g)}>Practice adaptively →</Button>
            </Card>
          ))}
        </div>
      </section>
      {practice && <Practice key={practice.concept} topic={topic} gap={practice} />}
      <div className="text-center"><Button variant="outline" size="lg" onClick={restart}>Retake diagnostic on {topic}</Button></div>
    </div>
  );
}

function Practice({ topic, gap }: { topic: string; gap: Analysis["gaps"][number] }) {
  const gen = useServerFn(generatePractice);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [qs, setQs] = useState<Question[]>([]);
  const [i, setI] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [round, setRound] = useState<boolean[]>([]);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  async function load(d: Difficulty) {
    setErr(""); setQs([]); setI(0); setRound([]);
    try { const r = await gen({ data: { topic, concept: gap.concept, difficulty: d, misconception: gap.misconception } }); setQs(r.questions); }
    catch (e) { setErr(errMsg(e)); }
  }
  useEffect(() => { load("easy"); ref.current?.scrollIntoView({ behavior: "smooth" }); }, []);

  const done = qs.length > 0 && i >= qs.length;
  return (
    <div ref={ref} className="mx-auto max-w-2xl scroll-mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Practice: {gap.concept}</h2>
        <Badge>Level: {difficulty} · {correct} correct</Badge>
      </div>
      {err && <p className="text-sm text-destructive">{err} <Button variant="link" onClick={() => load(difficulty)}>Retry</Button></p>}
      {!err && qs.length === 0 && <Thinking text={`Crafting ${difficulty} exercises…`} />}
      {qs[i] && <QuestionCard q={qs[i]} label={`${i + 1} / ${qs.length}`} onAnswer={(idx) => {
        const ok = idx === qs[i].correctIndex;
        if (ok) setCorrect((c) => c + 1);
        setRound((r) => [...r, ok]); setI(i + 1);
      }} />}
      {done && (() => {
        const next = nextDifficulty(difficulty, round);
        return (
          <Card className="rise p-6 text-center shadow-soft">
            <p className="font-display text-2xl">{round.filter(Boolean).length} / {round.length} this round</p>
            <p className="mt-2 text-muted-foreground">
              {next === difficulty ? "Let's reinforce at this level." : next === "hard" || (next === "medium" && difficulty === "easy") ? `Great work — leveling up to ${next}.` : `Let's step back to ${next} and rebuild.`}
            </p>
            <Button className="mt-4" onClick={() => { setDifficulty(next); load(next); }}>Next round ({next}) →</Button>
          </Card>
        );
      })()}
    </div>
  );
}
