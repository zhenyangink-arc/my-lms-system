# R7C isolated durable Activity verification

Teaching Agent Lesson Execution test capability. Reuses LessonManifestV1,
LessonRuntime, MultipleChoiceBlock, the existing single_choice grader and the
actual seven-argument record_smart_textbook_attempt SQL function.

No production DB, environment file, real learner, Auth service, Provider, Agent,
publication, or second Activity/Progress store. `postgres.mjs` starts a fresh
network-isolated PostgreSQL 17.6 container using the existing repository test
pattern. `bootstrap.sql` reproduces existing Activity/Attempt/Progress structures
and synthetic parent/identity FKs. It is not a project migration. Production
RLS/admission/publication-fence integration is **not** proven by this fixture.

Each independent scenario seeds one parent practice node, one Activity and its
one private answer row. Grading uses the existing server grader. Request
correlation lives in a versioned response envelope in the existing attempts
JSONB, fenced with the same transaction lock as the real RPC. Readback opens a
fresh READ ONLY transaction; its receipt contains no response or private key.
The bare historical RPC itself is not made idempotent for callers outside this
new transaction seam. This seam has no production transport/admission wiring.

`service-process.mjs` runs the existing R7B loopback HTTP/React harness with the
new durable adapter. Tests terminate and recreate this child while its owned DB
survives. Browser waiting hints are scoped presentation observations only:
completion always comes from the DB, and a hint never skips a mandatory cue.
No cue rows or video-position progress rows are created.

Run from the repository:

```sh
node --experimental-strip-types --test tests/teaching-agent-r7c-binding.test.mjs tests/teaching-agent-r7c-durable.test.mjs tests/teaching-agent-r7c-browser.test.mjs
```

Only owned `uply-r7c-isolated-*` containers are removed afterward. Safe aggregate
row counts are appended to `/tmp/r7c-isolated-db-ledger.jsonl`. No answer values,
raw identities, DB credentials or session tokens are logged there.

Expected classification: CONDITIONAL / TEST-ENV VERIFIED. Current canonical
Activity authoring/binding and published student admission remain unverified.
The current frozen Teaching Script and current database remain unchanged.
