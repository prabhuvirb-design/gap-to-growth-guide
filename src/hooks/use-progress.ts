import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  listSessions,
  mergeSessions,
  saveSession,
  type NewSession,
  type SavedSession,
} from "@/lib/progress.functions";

export const LS = "mentora-sessions";

/** What the home screen and history list need, from either store. */
export type Session = {
  topic: string;
  date: string;
  overall: number;
  mastery: SavedSession["mastery"];
};

function readLocal(): Session[] {
  try {
    const raw = localStorage.getItem(LS);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Session[]) : [];
  } catch {
    return [];
  }
}

/**
 * Learner progress. Saved to the learner's account when signed in, to this browser otherwise,
 * and anything this browser was holding is moved onto the account the first time they sign in.
 */
export function useProgress() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const fetchSessions = useServerFn(listSessions);
  const writeSession = useServerFn(saveSession);
  const moveLocal = useServerFn(mergeSessions);

  const [local, setLocal] = useState<Session[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLocal(readLocal());
    setHydrated(true);
  }, []);

  const sessionsQuery = useQuery({
    queryKey: ["sessions", userId],
    queryFn: () => fetchSessions(),
    enabled: !!userId,
  });

  const moved = useRef(false);
  useEffect(() => {
    if (!userId || !hydrated || moved.current || local.length === 0) return;
    moved.current = true;
    const count = local.length;
    void moveLocal({ data: { sessions: local } })
      .then(() => {
        localStorage.removeItem(LS);
        setLocal([]);
        void queryClient.invalidateQueries({ queryKey: ["sessions", userId] });
        toast.success(`Moved ${count} earlier session${count === 1 ? "" : "s"} onto your account`);
      })
      .catch(() => {
        moved.current = false;
        toast.error("Couldn’t move your earlier sessions across — your progress is still saved here");
      });
  }, [userId, hydrated, local, moveLocal, queryClient]);

  const sessions = useMemo<Session[]>(
    () =>
      userId
        ? (sessionsQuery.data ?? []).map((s) => ({ topic: s.topic, date: s.date, overall: s.overall, mastery: s.mastery }))
        : local,
    [userId, sessionsQuery.data, local],
  );

  const persist = useMutation({
    mutationFn: async (input: NewSession) => {
      if (userId) {
        await writeSession({ data: input });
        void queryClient.invalidateQueries({ queryKey: ["sessions", userId] });
        return;
      }
      const next = [
        { topic: input.topic, date: new Date().toISOString(), overall: input.overall, mastery: input.mastery },
        ...local,
      ].slice(0, 20);
      localStorage.setItem(LS, JSON.stringify(next));
      setLocal(next);
    },
  });

  return {
    sessions,
    save: persist.mutateAsync,
    signedIn: !!userId,
    ready: hydrated && (userId ? !sessionsQuery.isPending : true),
  };
}
