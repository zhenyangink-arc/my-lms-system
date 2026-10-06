# TASK — 当前远程桌面会话只读关联

## Identity
TASK ID: COURSE-EXPLAIN-DESKTOP-ASSOCIATION-06
TITLE: Identify current user-owned remote desktop metadata without changing browser
STATUS: SPECIFIED

## Routing
IMPLEMENTATION PROFILE: worker_medium | GPT-6.1 Sol medium
ARCHITECT GATE: NOT_REQUIRED — ordinary read-only own-session metadata.
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high
MODEL ROUTING REASON: Frozen small metadata projection; no application/auth/desktop configuration changes.
DISPATCH RECORD REQUIRED: YES

## Objective / Context
User explicitly confirmed the prepared Korean1 lesson is in remote server desktop Chrome. Task05 MCP has0matchingorigin tabs and old DISPLAY11 produced0captures twice in distinct user states (first fixedwindow inactive, then no activewindow ID). Do not infer user/login/app failure. Determine authoritative current own-session display candidates from OS metadata, without guessing or probing arbitrary desktops.

## Scope
WRITABLE SCOPE: new private /tmp/course-explain-desktop-* directory0700/helper/receipt/reports0600; Supervisor Task metadata.
READABLE DEPENDENCIES: project rules, this Task; Task05 saved WorkerReport and UserReadyObservationReport /tmp/course-explain-entry-0tcz92ck/; installed loginctl help/man if necessary. Prepare helper only; Root executes reviewed helper once.
Allowed actual operation after review: loginctl list-sessions once, immediately filter to current UID from os.getuid (expected1001). Never emit or persist unrelated user/session raw rows. For at most6 own-session IDs, loginctl show-session exact data-only argv using frozen properties Id,User,Type,Class,State,Active,Remote,Service,Display,Leader,Seat,TTY. Do not collect RemoteHost,Address,environment,cmdline or session logs. Validate session IDs as bounded alphanumeric strings before using argv. Capture safe bounded output projection and actual return codes; no raw stderr on error. Result can identify X11/xrdp session/display only when properties directly support it; empty Display is unknown, not permission to guess DISPLAY12 or scan X sockets.
FORBIDDEN: browsing/capturing/focusing/scroll/input/navigation/restart/reconfiguration; X11 properties or desktop enumeration in this metadata phase; reading process env/cmdline/PM2/private credentials or other users' details; HTTP/DB/model; package installs; source/tests/config mutations; broad process/log scans. No helper retry or alternate runtime fallback after failure. Root tool permission normal, no child hidden escalations.

## Contracts / Data Impact
MAY CHANGE PUBLIC CONTRACT: NO
DATABASE/AUTH/RLS IMPACT: NONE
SECURITY: filter own UID immediately, save minimum nonsecret metadata. No claim of browser account/lesson/Explain availability.

## Requirements
1. Prepare bounded stdlib-only helper; pure/syntax sanity only, no actual loginctl fromWorker.
2. Single exclusive private receipt; safe stdout, actual childrc, timestamp, no raw other-user data. Do not execute application.
3. If exactly one current eligible display is directly established, report it as a candidate for later guardedChrome observation, not an image/currentaccount claim. Multiple/empty fields -> explicit unresolved and smallest next metadata needed; no self-expansion.
4. No new screenshot in this Task; preserve all previous attempts; root controls any separately scoped later observation.

## Acceptance / Validation
Truthful own-session mapping or bounded missing-evidence result. Static helper review plus independent saved receipt verification; tests/build/DB/E2E NOT_REQUIRED. Reports CODEX_WORKER.md/CODEX_VERIFICATION.md. No repeatedTask05liveoperation.

## Parallelism
May overlap saved-only Task05verification. One metadata operator only; no shared state mutation.

## Escalation
Need moreOSdata or GUIaction -> exactscope request; no config changes, no arbitrarydisplay guesses. Root may resolve bounded read-only follow-on under existing user instruction, with explicit Task update.

## Supervisor final review — 2026-10-05
STATUS: COMPLETED
DECISION: PASS for bounded own active remote X11 session metadata association only.
Worker report: /tmp/course-explain-desktop-elw6f4yl/PostReadWorkerReport.md SHA256 4002c8ab2e846c1241741bf6d10b9f7f544420575f3cbde3746c218b75ac8e3f.
Independent verification: /tmp/course-explain-desktop-verification-qdajtw_7/VerificationReport.md SHA256 bda6ea4c0b1d25ce5a49691dfa57a3a69c3916edf49ea827f5ba03d1a1bc74e3.
Receipt: /tmp/course-explain-desktop-elw6f4yl/receipt.json SHA256 ef6c901ecbd483e8df671a3805d312249781894097cd752709ddc1afd37ba7db.
Actual result: one list-sessions and five own-session show-session reads, all rc0; unique eligible own UID1001 session c2, DISPLAY :11, active X11 xrdp. No screenshots/input/config/network/model operations under Task06. This alone establishes neither account nor current Chrome content; Task05 supplies separate saved visual evidence. No source changes.
