# Disposable full Supabase R2 harness

This harness is deliberately local-only. It never accepts a remote endpoint, DB host,
production credentials, or an existing project name. Run from the repository root.
Do not run it against an existing application database. R2 findings are **NO-GO**;
R2A adds reviewed incremental content isolation and real security assertions. The harness never deploys to production.

Use `staging.py prepare` to generate a new identity. Save its JSON in a private
temporary file, then use its `directory` as `STAGE_DIR`. Never print `status.json`,
`private.json`, `users.private.json`, cookies, or private logs.

Run these phases sequentially, stopping on any nonzero exit:

1. `python3 scripts/teaching-agent-r2/staging.py start --directory "$STAGE_DIR"`
2. `python3 scripts/teaching-agent-r2/staging.py status --directory "$STAGE_DIR"`
3. `python3 scripts/teaching-agent-r2/staging.py bootstrap --directory "$STAGE_DIR"`
4. `node scripts/teaching-agent-r2/auth.mjs "$STAGE_DIR"`
5. `python3 scripts/teaching-agent-r2/seed.py "$STAGE_DIR"`
6. `node scripts/teaching-agent-r2/security.mjs "$STAGE_DIR"` (R2A direct JWT/RLS matrix).
7. `node --import ./tests/fixtures/smart-textbook-legacy-adapter/register-server-only.mjs scripts/teaching-agent-r2/integration.mjs "$STAGE_DIR"`
8. `node --import ./tests/fixtures/smart-textbook-legacy-adapter/register-server-only.mjs scripts/teaching-agent-r2/ports.mjs "$STAGE_DIR"`
9. `python3 scripts/teaching-agent-r2/observe.py capture "$STAGE_DIR"`
10. `python3 scripts/teaching-agent-r2/next.py prepare "$STAGE_DIR"`
11. `python3 scripts/teaching-agent-r2/next.py build "$STAGE_DIR"`
12. `python3 scripts/teaching-agent-r2/next.py instrument "$STAGE_DIR"`
13. Run `python3 scripts/teaching-agent-r2/next.py start "$STAGE_DIR"` in a retained terminal/process.
14. In another terminal run `node scripts/teaching-agent-r2/browser.mjs "$STAGE_DIR"`.
15. Review only allowlisted result JSON and the completed UI screenshot; scan for private
    values before preserving evidence. Do not archive the temporary source copy or logs.
16. Run `python3 scripts/teaching-agent-r2/observe.py cleanup "$STAGE_DIR"` even if a
    test failed. It checks unique ownership before removing containers/network/volumes
    and the private directory. Sandboxed PID namespaces may require cleanup in the host
    namespace; the script still checks the unique working directory before stopping Next.

Auth and seed are one-shot operations on a newly prepared stack. Definition publication
is immutable; do not treat a duplicate second invocation as successful publication.
The application baseline is byte-exact. Its event-trigger owner requires a transient
bootstrap-only PostgreSQL role attribute; the original `NOSUPERUSER` attribute is
restored before incrementals and all student requests.

The private `/r2-lesson` page calls the actual page projection and product component.
It is a synthetic lesson mounting harness, not proof of production catalog routing or
the complete `SmartTextbookShell`. Only Provider HTTP/SSE is replaced in the runtime.
The process-owned file watcher controls staging rollout; it is not an API or UI bypass.

Pure hard-guard regression:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p test_teaching_agent_r2_staging.py
```


R2A observations: `observed-fetch.ts` is injected into the private copy's Supabase
SDK clients to capture request-start metadata; a global fetch wrapper alone may be
replaced by Next. It preserves the exact user/service credential split. No payload,
query string, Cookie, Authorization, or keys are recorded. `request-events.jsonl`
contains the actual handler receivedAt. Tool starts use the Student Runtime's
`tool.requested` event (Core can use `tool.started`). Both are counted. Deadline
assertions first require real teaching reads and earlier real Tool events to have
been observed, preventing a vacuous zero-tail pass. New tables/RPCs are treated as
Teaching Domain unless explicitly allowlisted as Agent infrastructure.

`browser.mjs` compares original/replayed run and conversation identities and counts
Agent run/conversation/message rows through a harness-only read observer. Active
replay and changed-message/changed-valid-segment conflicts are verified. The observer
is never passed to Student Domain Ports.

Synthetic fixture now includes assigned Teacher/Admin public access and platform-global
published educational content. The optional `seed.py --global-only` extends a newly
created local fixture only; it is not for reuse against existing application data.
