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
- Learner progress goes to the account when signed in and to browser localStorage otherwise, with anything local moved onto the account at first sign-in (src/hooks/use-progress.ts); keeps the tutor usable without an account.
- Private data is only ever read or written through requireSupabaseAuth server functions, and signed-in-only pages live under src/routes/_authenticated/; keeps the browser from deciding who a learner is.
- One onAuthStateChange listener in src/lib/auth-context.tsx owns session state for the whole app; keeps duplicate listeners from fighting over the cache.
- Practice difficulty rules live in src/lib/adaptive.ts with tests; keeps adaptation logic testable.
- Student/teacher categories are immutable rows in public.user_roles, read through authenticated server functions; self-selection never grants another user's data access.
- Auth completes by checking the stored category before routing to the corresponding home; OAuth returns to the public auth page carrying the selected category.
- Teacher workspace loads through useServerFn after the managed account gate and verifies its category on the server; query errors retain a visible return path.
- Permanent student self-deletion verifies the caller's stored role, deletes only context.userId through the server-only auth admin client, and relies on verified cascading foreign keys for atomic learning-data removal.
- Classroom rosters are teacher-owned records, not linked learner accounts; authenticated teacher functions and owner/role RLS protect students, assignments and marks, with composite foreign keys keeping each result within one teacher's classroom.
