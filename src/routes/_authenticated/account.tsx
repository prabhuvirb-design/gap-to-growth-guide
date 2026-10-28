import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useProgress } from "@/hooks/use-progress";
import { useSignOut } from "@/hooks/use-sign-out";
import { getProfile, listPractice, updateProfile } from "@/lib/progress.functions";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Your account — Mentora" },
      {
        name: "description",
        content: "Manage your Mentora profile and see the progress you’ve saved across devices.",
      },
      { property: "og:title", content: "Your account — Mentora" },
      { property: "og:description", content: "Your profile, saved diagnostics, and practice levels." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
type Level = (typeof LEVELS)[number];

function AccountPage() {
  const { user } = useAuth();
  const { sessions, ready } = useProgress();
  const signOut = useSignOut();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getProfile);
  const saveProfile = useServerFn(updateProfile);
  const fetchPractice = useServerFn(listPractice);

  const profileQuery = useQuery({ queryKey: ["profile", user?.id], queryFn: () => fetchProfile() });
  const practiceQuery = useQuery({ queryKey: ["practice", user?.id], queryFn: () => fetchPractice() });

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState<Level>("Beginner");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;
    setName(profile.displayName ?? "");
    setSubject(profile.preferredSubject ?? "");
    setLevel((LEVELS as readonly string[]).includes(profile.level) ? (profile.level as Level) : "Beginner");
  }, [profileQuery.data]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await saveProfile({
        data: { displayName: name, preferredSubject: subject.trim() || null, level },
      });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn’t save your details.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground">
            m
          </span>
          <span className="font-display text-xl font-semibold">Mentora</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/">Back to the tutor</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-6 pb-20 lg:grid-cols-2">
        <Card className="rise p-6 shadow-soft">
          <h1 className="text-2xl font-semibold">Your profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="display-name">Name</Label>
              <Input
                id="display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How should we greet you?"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject you’re focusing on</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Fractions, Python loops, World War I…"
              />
            </div>
            <div className="space-y-2">
              <Label>Comfort level</Label>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((l) => (
                  <Button
                    key={l}
                    type="button"
                    size="sm"
                    variant={level === l ? "default" : "outline"}
                    onClick={() => setLevel(l)}
                  >
                    {l}
                  </Button>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="rise p-6 shadow-soft">
            <h2 className="text-2xl font-semibold">Saved diagnostics</h2>
            {!ready ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading your progress…</p>
            ) : sessions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing yet. Run a diagnostic and it will be waiting here on any device.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {sessions.slice(0, 8).map((s, i) => (
                  <li key={`${s.topic}-${i}`}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{s.topic}</span>
                      <span className="text-muted-foreground">
                        {formatDate(s.date)} · {s.overall}%
                      </span>
                    </div>
                    <Progress value={s.overall} className="mt-1 h-2" />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="rise p-6 shadow-soft">
            <h2 className="text-2xl font-semibold">Practice levels reached</h2>
            {practiceQuery.isPending ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
            ) : !practiceQuery.data?.length ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Practise a gap and the level you earn is remembered here.
              </p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {practiceQuery.data.map((p) => (
                  <li key={`${p.topic}-${p.concept}`} className="flex items-center justify-between gap-3">
                    <span className="truncate">
                      <span className="font-medium">{p.concept}</span>
                      <span className="text-muted-foreground"> · {p.topic}</span>
                    </span>
                    <Badge variant="outline">{p.difficulty}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
