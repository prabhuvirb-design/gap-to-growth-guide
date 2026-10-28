import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/** Ends the session cleanly: stop in-flight reads, drop cached data, then leave. */
export function useSignOut() {
  const queryClient = useQueryClient();
  const go = useNavigate();
  return useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await go({ to: "/auth", replace: true });
  }, [queryClient, go]);
}
