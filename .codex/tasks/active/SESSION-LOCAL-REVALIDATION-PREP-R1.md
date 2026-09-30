# TASK — Local30 runner consolidated revision
## Identity
TASK ID: SESSION-LOCAL-REVALIDATION-PREP-R1
STATUS: SPECIFIED
## Routing
IMPLEMENTATION PROFILE: worker_high (GPT-6 Sol high)
VERIFICATION PROFILE: verifier (GPT-6 Sol high)
ARCHITECT GATE: prior SESSION-CONTEXT-TRANSITION-GATE-01 ALLOW design reused; no contract change
MODEL ROUTING REASON: bounded runner bookkeeping/deadline defects, original tests unchanged
DISPATCH RECORD REQUIRED: YES
## Objective
One consolidated new private R1 packet correcting all five independent R0 findings. Do not run original tests or runtime. Preserve R0 intact. No new diagnostic framework.
## Context
R0 /tmp/session-local-revalidation-prep-4xqz65xf; Packet SHA 7541b0cb25e9c394e10e8c87b114eb7094010f56d29d5c286e7dcf6b88863186.
Independent report /tmp/session-local-revalidation-prep-verify-ip6y69d6/VerificationReport.md SHA fe0d56911d12dc393ecde2e5f8941987ca3518931af5cdb1aad1f412919cb3ec.
Original Task SESSION-LOCAL-REVALIDATION-PREP-01.md and Gate /tmp/session-context-transition-gate-7e8qxfuu/GateReport.md SHA 0363d910ddd8a4d373b1530a555cfa246281580fe62db6d7ec98f33cca3ac920 otherwise remain applicable.
## Scope
WRITE: one new private /tmp/session-local-revalidation-prep-r1-* tree only.
READ: frozen R0, independent report, original named source/test/native bindings and role manuals.
FORBIDDEN: repository/test/source/I/B/history/authority changes; old packet edits; .codex changes by Worker; credentials/env; Docker including inspect; original module import; original tests; DB/SQL/network/build/publication.
You are not alone; revert nothing. Supervisor handles Task metadata.
## Contracts
No public contract change. Original30 exact IDs/order and all original definitions unchanged. NONQUALIFYING_LOCAL_FOCUSED_REVALIDATION. Local runtime authorization not consumed by preparation; do not launch.
## Data / Security Impact
Database/RLS/Auth changes NONE. Private runner correctness only; no expanded authority.
## Requirements
1. Read full verifier report, close all five findings together. Keep standard unittest selection with failfast=True and private result/output logging; no operational semantics monkeypatch.
2. Success iff all30 individually final PASS, exact selected identity set/order, no skip/expected failure/unexpected success/failure/error/incomplete/NOT_RUN, no deadline, bound inputs before/after unchanged. Do not use wasSuccessful alone. Save raw failures without replacing a prior outcome.
3. Snapshot/revalidate all bound regular inputs and actual interpreter/alias before and after, prior to PASS. File missing, symlink change, length/hash drift => nonzero invalid result; preserve evidence.
4. Deadline: dedicated BaseException sentinel outside Exception/KeyboardInterrupt/OSError/Failure, stop active result before raise. Prevent subsequent methods after deadline even when test catches the sentinel. Arm hard cutoff before optional logging; logging failure must not disable cutoff. Hard cutoff remains through evidence finalization/fsync, disarm only after durable result. Prefer minimal single-process solution. Grace is bounded termination/original cleanup opportunity, not guaranteed cleanup-only. Do not promise hard real-time or prove resource-zero without evidence. Original timeout/cleanup semantics otherwise unchanged. No external delete fallback.
5. Consume single invocation with exclusive claim before input preflight; preflight failure leaves claim/disposition, no automatic retry. Exact CLI/packet binding still required. Handle refused second invocation without changing first evidence.
6. Correct resource wording: peak conditional4 containers/1internalnetwork/4GiB configured container memory, 0publishedports, cachedpinnedimages/no pull. Original fresh synthetic private bind mounts are allowed and must be precisely listed with source template, container target, mode, source evidence. No production mounts. This corrects inaccurate no-host-mount wording, does not change argv. No old retained-container inspection/deletion; remaining resources unknown if not observable.
7. Finite budget remains2400s body+600s termination grace+600s separate review, with exact enforcement vs workflow claims truthful. No original runtime now.
8. Freeze new packet/runner/command/proof/report hashes after changes. Include R0 preserved hashes and per-finding closure. No executer invocation during preparation.
## Acceptance / Required Validation
AST/syntax and private standard-library dummy unittest sanity only. Exercise all-PASS positive, skipped/expected-failure rejection, missing record rejection, input drift rejection, OSError assertion cannot swallow deadline, caught BaseException still stops next method, evidence logging error cannot remove hard cutoff, claim preflight failure/nonretry, timer active through finalization. Tests must use synthetic dummy inputs and not import original test/fixture or start Docker/DB. Avoid rerunning closed original fix checks. Record exact command/rc/output hashes. If timing implementation cannot be proved, report bounded limitation and revise claims rather than original tests.
## Parallelism
Serial implementation then independent verifier; no source writers.
## Escalation
Need source, public contract, credentials, Docker or original test run => stop and report.
## Reports
Full CODEX_WORKER.md Worker Report with actual scope, per-finding closure, private file hashes, static/synthetic commands, counters, known limits. Verifier uses CODEX_VERIFICATION.md. No runtime PASS claim.
