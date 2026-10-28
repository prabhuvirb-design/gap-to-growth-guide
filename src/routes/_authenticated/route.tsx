import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/** Anything under this folder needs a signed-in learner; the rest of the app stays open. */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/auth", search: { next: `${location.pathname}${location.search}` } });
    }
  },
  component: () => <Outlet />,
});
