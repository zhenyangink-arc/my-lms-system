# R3D disposable authoring verification

Local owned Full Supabase only. Never pass a production endpoint or credentials.
Reuse the hard guards and lifecycle in `../teaching-agent-r2/README.md`.
Keep each phase sequential and stop on a nonzero exit. Never archive private JSON,
logs, cookies, JWTs, or the private source tree.

1. R2 `staging.py prepare/start/status/bootstrap`, then `auth.mjs` and `seed.py`.
   Those seeded teaching trees are **separate security fixtures**, not the from-zero target.
2. R2 `security.mjs` (138 assertions), `integration.mjs` and `ports.mjs`. Use
   `node --import ./tests/fixtures/smart-textbook-legacy-adapter/register-server-only.mjs`
   for TypeScript server imports. Definition publication runs once.
3. R3D `actors.mjs`, `catalog-fixture.py`, `failure-fixture.py`, `rpc-tests.mjs`.
   Catalog fixture creates a new target lesson with zero teaching parents/children;
   saves the prior security IDs in `security-fixture.json`. Partial/race/failure
   fixtures use other lessons. No target skeleton is seeded.
4. R2 `next.py prepare`, R3 `candidate.py` with the existing runtime configuration
   path (only public build configuration is used). Freeze the original candidate.
   R3C `instrument.py`, then R2 `next.py build`. Inspect `build-result.json.exit`;
   the old build wrapper can return shell exit zero when its child build fails.
5. In a retained supervisor, R3 `process.py start-watched`; run R3D
   `author-browser.mjs`, then always `process.py stop` in `finally`.
   All target writes use the real management UI/Server Actions: create skeleton,
   create script, add/save sections in both locales, review sources, publish script,
   publish chapter/root/version. Service credentials are read-only observers here.
6. R3D `project-pins.mjs` with the server-only register import above. Pins must be
   regenerated after authoring; never reuse the earlier security fixture's pins.
7. R2 `observe.py capture`; reset owned `control.json` to OFF/100ms. In a retained
   supervisor start-watched, run R3C `formal-browser.mjs`, then stop. This test ends
   with the feature OFF. For `layout.mjs`, use a separate supervisor with
   `process.py start-on`, run the layout checks, then always stop in `finally`.
   Only Provider HTTP/SSE is a fixture; Auth/RLS/policy/domain/runtime are real.
8. Repeat R2 `security.mjs` after authoring. For a long rehearsal, first run R3D
   `refresh-auth.mjs` to renew synthetic sessions through real password Auth.
   R3A `rpc-permissions.mjs`; R3B `targeted-reconcile.mjs`; R3D
   `rehearse-migrations.py --snapshot <authorized schema-only snapshot> --output <new private directory>`.
   Rehearsal extends R3A only to inject failure before uppercase or lowercase COMMIT.
9. R3D `candidate-build.py <private output directory>/build-result.json` freezes
   the final uninstrumented product after any fixes; it never starts/deploys it.
10. Archive only reviewed result JSON/screenshots. R2 `observe.py cleanup` removes
    precisely the owned containers/network/volumes/private directory.

Authoring writes are expected. Capture teaching table fingerprints **after** all
authoring and before Agent execution; the R3C observer additionally attributes
actual Agent POST calls using AsyncLocalStorage. Do not classify authoring writes
as Agent writes, or replace the real runtime with an in-memory test.

The complete author role remains the existing Platform Owner. Tenant manageContent
does not grant Script Studio write/publication access. MA is a real tenant content
manager used to prove this denial and cross-tenant denial; PO/PO2 are two separately
authenticated legal authors. No role or RLS policy is broadened.
