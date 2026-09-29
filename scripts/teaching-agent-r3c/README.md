# Stage 1F-R3C verification

No production deployment, authoring, migration, Tailscale mutation or live Provider.
All fixture SQL requires the R2 harness ownership guard and a **new** disposable
Full Supabase project. Never pass production/existing project configuration.

1. Read `../teaching-agent-r2/README.md` and `../teaching-agent-r3/README.md`.
   Prepare a unique stack; start/status/bootstrap → Auth → R2 seed (one shot).
2. Run `hangul-fixture.py <owned-directory>` once, before generating pins.
   It shapes the synthetic catalog as hangul-introduction/immediate plus two
   prerequisite_passed siblings; one locked sibling has published Agent content.
   This setup is NOT a supported product authoring flow and must not be copied
   to production. All teaching text is synthetic R2 fixture text.
3. Run R2 security/integration/ports, then `scope.mjs` with the existing
   `--import ./tests/fixtures/smart-textbook-legacy-adapter/register-server-only.mjs`
   preload. The ESM import shim must be preloaded before static TS dependencies.
   Scope enumerates actual synthetic course rows under real A1 JWT and executes
   current StudentPolicy/projector; it does not prove production eligibility.
4. Capture stack metadata, prepare the Next copy, build/freeze the uninstrumented
   candidate with R3 `candidate.py` and public-only config. Then run this directory's
   `instrument.py` and rebuild with R2 `next.py build` in the private copy.
   Instrumentation replaces only Provider HTTP, blocks external fetches, observes
   safe request metadata, and uses AsyncLocalStorage to distinguish Agent POST
   work from unrelated Hangul reading heartbeats. No Auth/RLS/Policy bypass.
5. Under a retained supervisor, set the private control file OFF/100ms, start R3
   `process.py start-watched`, execute `formal-browser.mjs`, finally stop the owned
   process. Preserve failed-attempt metadata; do not rerun Auth/definition creation.
   The browser test uses the formal Hangul slug route and actual login UI. It reads
   the completed Run via captured idempotency key: reading a delayed Playwright
   response body can fail when an unrelated navigation invalidates its resource.
6. Start the same copy with R3 `process.py start-on`; execute `layout.mjs`, then
   stop it. This checks real mobile/landscape/keyboard Panel behavior. Wait for
   Sheet closure before asserting focus; do not assert in the same keyboard tick.
7. Re-run R3A `rpc-permissions.mjs` against the owned stack, R3B
   `targeted-reconcile.mjs <private-result-file>` (separate network-none fixture),
   required local regression/tsc/lint, and baseline/migration checks.
8. Archive only allowlisted result metadata and synthetic UI screenshots. Never
   archive private keys, cookies, status/users files, whole logs or DB rows.
   Verify active=0. Keep the new uninstrumented archive private and its digest
   public; it replaces the old candidate only as review input, not deployment.
9. Run R2 `observe.py cleanup <owned-directory>` even after failure; verify zero
   owned containers/network/volumes and deletion of the private directory.

The production content-owner checklist remains ENGINEERING BLOCKER REMAINS:
there is no confirmed complete from-zero product authoring workflow. R3C does not
create that workflow or turn fixture setup into an authoring recommendation.
Stage 1G remains NOT READY until real content/Pins, actual Tailscale, Provider
policy, staffing and final production scope are all verified/approved.
