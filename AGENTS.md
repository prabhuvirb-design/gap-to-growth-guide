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
- Auth begins at the public category picker and uses separate public student/teacher login routes sharing GoogleLogin; OAuth returns to the chosen login route and verifies the stored category before routing to its home, so category selection cannot change access.
- Teacher workspace loads through useServerFn after the managed account gate and verifies its category on the server; query errors retain a visible return path.
- Permanent account self-deletion verifies the caller's stored student or teacher role, deletes only context.userId through the server-only auth admin client, and relies on verified cascading foreign keys for atomic learning and classroom-data removal; both the account page and teacher workspace use the same confirmation control.
- Classroom rosters are teacher-owned records, not linked learner accounts; authenticated teacher functions and owner/role RLS protect students, assignments and marks, with composite foreign keys keeping each result within one teacher's classroom. Removing a student re-checks ownership from the stored record rather than the request, and relies on the verified cascade to drop that student's marks.
- A dedicated mark book page (src/routes/_authenticated/teacher-marks.tsx) is the only surface where a teacher stores a student's result; it reuses the classroom server functions and the validation in src/lib/classroom.ts instead of adding a second write path, so score limits and ownership checks stay in one place.
- The classroom roster (src/components/teacher-classroom.tsx) presents one card per student listing every assignment with its stored mark beside that name, instead of separate students/assignments/marks lists; the mark book remains the only write path, so the roster stays a read view.
