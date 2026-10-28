import { createFileRoute } from "@tanstack/react-router";
import { GoogleLogin } from "@/components/google-login";

export const Route = createFileRoute("/teacher-login")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => typeof search["next"] === "string" ? { next: search["next"] } : {},
  head: () => ({ meta: [
    { title: "Teacher Google sign-in — Mentora" },
    { name: "description", content: "Sign in to your Mentora teacher account with Google." },
    { property: "og:title", content: "Teacher Google sign-in — Mentora" },
    { property: "og:description", content: "Access your classroom, assignments and marks." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: () => <GoogleLogin role="teacher" next={Route.useSearch().next} />,
});