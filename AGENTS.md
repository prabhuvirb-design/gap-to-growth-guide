<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- AI tutor calls live in server functions (src/lib/tutor.functions.ts) backed by a server-only helper (src/lib/ai.server.ts); keeps the AI key off the client.
- Learner progress is stored in browser localStorage (no accounts yet); keeps the app sign-in free.
- Practice difficulty rules live in src/lib/adaptive.ts with tests; keeps adaptation logic testable.
