import { createFileRoute } from "@tanstack/react-router";
import { GoogleLogin } from "@/components/google-login";

export const Route = createFileRoute("/student-login")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => typeof search["next"] === "string" ? { next: search["next"] } : {},
  head: () => ({ meta: [
    { title: "Student Google sign-in — Mentora" },
    { name: "description", content: "Sign in to your Mentora student account with Google." },
    { property: "og:title", content: "Student Google sign-in — Mentora" },
    { property: "og:description", content: "Access your saved diagnostics and personal learning progress." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: () => <GoogleLogin role="student" next={Route.useSearch().next} />,
});