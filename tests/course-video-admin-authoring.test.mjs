import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyVideoPilotDraft, hasVideoPilotMarker, inspectVideoPilotDraft,
  parseVideoPilotDraft, readVideoPilotDraft,
} from "../src/features/learning-agent-script-studio/video-pilot-authoring.ts";

const activityId = "11111111-1111-4111-8111-111111111111";
const local = { kind: "selected-local", assetId: "course-video-sample01", state: "pending-ingestion" };
const library = { kind: "r2-library", objectKey: "teacher-video/样本.mp4", title: "素材", state: "unverified" };
const full = () => ({ ...createEmptyVideoPilotDraft(), media: { ...local }, cue: { id: "pause-1", atSeconds: 0, activityId } });
const invalid = (value, field) => {
  const parsed = parseVideoPilotDraft(value);
  assert.equal(parsed.ok, false, JSON.stringify(value));
  if (field) assert.ok(parsed.issues.some((issue) => issue.field === field));
};

test("empty and every nullable draft combination round-trip without invented content", () => {
  for (const media of [null, local, library]) for (const cue of [null,
    { id: "pause-1", atSeconds: null, activityId: null },
    { id: "pause-1", atSeconds: 0, activityId: null },
    { id: "pause-1", atSeconds: null, activityId },
    { id: "pause-1", atSeconds: 29.999, activityId }]) {
    const draft = { ...createEmptyVideoPilotDraft(), media, cue };
    assert.deepEqual(parseVideoPilotDraft(draft), { ok: true, draft });
    assert.deepEqual(parseVideoPilotDraft(JSON.stringify(draft)), { ok: true, draft });
    assert.deepEqual(readVideoPilotDraft({ videoPilot: draft }), { kind: "pilot", draft });
    assert.equal(inspectVideoPilotDraft(draft).runtimeReady, false);
  }
  assert.deepEqual(createEmptyVideoPilotDraft().cue, { id: "pause-1", atSeconds: null, activityId: null });
  const first = createEmptyVideoPilotDraft();
  first.cue.atSeconds = 1;
  assert.equal(createEmptyVideoPilotDraft().cue.atSeconds, null);
});

test("marker is an own-property guard independent of validity and truthiness", () => {
  for (const value of [null, undefined, false, 0, "", [], {}, { contract: "unknown" }, JSON.stringify(full())]) {
    const configuration = { videoPilot: value, teacherVideo: { mode: "legacy" } };
    assert.equal(hasVideoPilotMarker(configuration), true);
    assert.equal(readVideoPilotDraft(configuration).kind, "invalid");
  }
  const array = [];
  array.videoPilot = null;
  assert.equal(hasVideoPilotMarker(array), true);
  for (const configuration of [null, undefined, false, "videoPilot", [], {}, Object.create({ videoPilot: full() })]) {
    assert.equal(hasVideoPilotMarker(configuration), false);
    assert.deepEqual(readVideoPilotDraft(configuration), { kind: "absent" });
  }
});

test("root shape is strict, required, noncoercing and versioned", () => {
  for (const value of [null, [], 1, true, "null", "[]", "broken", { ...full(), contract: "unknown" },
    { ...full(), mode: "legacy" }, { ...full(), state: "published" }]) invalid(value);
  for (const key of Object.keys(full())) { const draft = full(); delete draft[key]; invalid(draft); }
  for (const key of ["duration", "sha256", "revision", "admission", "answers", "publicationId", "sessionId", "receipt", "transcript", "cues", "extra"]) invalid({ ...full(), [key]: null });
  invalid({ ...full(), [Symbol("hidden")]: true });
  invalid(Object.create(full()));
  for (const captions of [[], {}, "", false, { src: "a.vtt" }]) invalid({ ...full(), captions });
  const json = JSON.stringify(full());
  assert.equal(parseVideoPilotDraft(json.padEnd(8192, " ")).ok, true);
  invalid(json.padEnd(8193, " "));
});

test("local media has exact identity, state and no authored metadata", () => {
  for (const media of [[], {}, false, "sample01", { ...local, kind: "file" }, { ...local, assetId: "other" },
    { ...local, state: "ready" }, { ...local, state: "unverified" }]) invalid({ ...full(), media }, "videoPilotMedia");
  for (const key of Object.keys(local)) { const media = { ...local }; delete media[key]; invalid({ ...full(), media }); }
  for (const key of ["path", "previewUrl", "sha256", "duration", "videoDurationSeconds", "revision", "title"]) invalid({ ...full(), media: { ...local, [key]: null } }, "videoPilotMedia");
});

test("R2 retains existing key validation and requires trimmed bounded title/unverified state", () => {
  const draft = { ...full(), media: library };
  assert.equal(parseVideoPilotDraft(draft).ok, true);
  for (const objectKey of ["a.mp4", "teacher-video/../a.mp4", "teacher-video/%2e/a.mp4", "teacher-video//a.mp4", "teacher-video/a.mp4?x", "teacher-video/a.webm", "teacher-video/\\a.mp4", `teacher-video/${"a".repeat(490)}.mp4`, 1]) invalid({ ...draft, media: { ...library, objectKey } });
  for (const title of ["", " ", " 素材", "素材 ", "x".repeat(101), null, 1]) invalid({ ...draft, media: { ...library, title } });
  assert.equal(parseVideoPilotDraft({ ...draft, media: { ...library, title: "x".repeat(100) } }).ok, true);
  for (const state of ["ready", "pending-ingestion", "verified"]) invalid({ ...draft, media: { ...library, state } });
  for (const key of Object.keys(library)) { const media = { ...library }; delete media[key]; invalid({ ...draft, media }); }
  for (const key of ["transcript", "duration", "sha256", "revision"]) invalid({ ...draft, media: { ...library, [key]: "forged" } });
});

test("single cue validates exact shape, UUID and true video duration", () => {
  for (const atSeconds of [0, 29.999]) assert.equal(parseVideoPilotDraft({ ...full(), cue: { ...full().cue, atSeconds } }).ok, true);
  for (const atSeconds of [30, 30.001, 30.016, 86400, -0.1, NaN, Infinity, -Infinity, "1", false, undefined]) invalid({ ...full(), cue: { ...full().cue, atSeconds } }, "videoPilotCueAtSeconds");
  for (const atSeconds of [0, 30, 86400]) assert.equal(parseVideoPilotDraft({ ...full(), media: library, cue: { ...full().cue, atSeconds } }).ok, true);
  invalid({ ...full(), media: library, cue: { ...full().cue, atSeconds: 86400.001 } });
  for (const id of ["pause-2", 1, null]) invalid({ ...full(), cue: { ...full().cue, id } });
  for (const cue of [[], [full().cue, full().cue], {}, "", false]) invalid({ ...full(), cue });
  for (const key of Object.keys(full().cue)) { const cue = { ...full().cue }; delete cue[key]; invalid({ ...full(), cue }); }
  for (const key of ["activityRevision", "answer", "grading", "type", "moduleId"]) invalid({ ...full(), cue: { ...full().cue, [key]: "forged" } });
  for (const activityId of ["", "abc", 1, {}, "11111111-1111-4111-7111-111111111111"]) invalid({ ...full(), cue: { ...full().cue, activityId } }, "videoPilotActivityId");
});

test("inspection distinguishes incomplete/configured but never claims runtime readiness", () => {
  assert.deepEqual(inspectVideoPilotDraft(full()), { authoring: "configured", issues: [], runtimeReady: false });
  const result = inspectVideoPilotDraft(createEmptyVideoPilotDraft());
  assert.equal(result.authoring, "incomplete");
  assert.equal(result.issues.length, 3);
  assert.equal(result.runtimeReady, false);
  assert.equal(inspectVideoPilotDraft({ ...full(), mode: "legacy" }).runtimeReady, false);
});
