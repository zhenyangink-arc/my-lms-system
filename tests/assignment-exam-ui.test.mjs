import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getExamQuestionStatus,
  getExamRemainingSeconds,
  getSubmissionConfirmationStage,
} from "../src/app/dashboard/assignments/assignment-exam-ui.ts";

const root = new URL("../", import.meta.url);

test("exam countdown reaches zero at the duration limit and respects an earlier deadline", () => {
  const startedAt = "2026-08-19T00:00:00.000Z";
  assert.equal(
    getExamRemainingSeconds({
      startedAt,
      durationMinutes: 45,
      now: new Date("2026-08-19T00:44:59.200Z").getTime(),
    }),
    1,
  );
  assert.equal(
    getExamRemainingSeconds({
      startedAt,
      durationMinutes: 45,
      dueAt: "2026-08-19T00:30:00.000Z",
      now: new Date("2026-08-19T00:30:00.000Z").getTime(),
    }),
    0,
  );
  assert.equal(
    getExamRemainingSeconds({
      startedAt,
      durationMinutes: 45,
      expiresAt: "2026-08-19T00:10:00.000Z",
      now: new Date("2026-08-19T00:10:00.000Z").getTime(),
    }),
    0,
  );
});

test("question navigation exposes answered, unanswered, and review states", () => {
  assert.equal(getExamQuestionStatus("答案", false), "answered");
  assert.equal(getExamQuestionStatus("", false), "unanswered");
  assert.equal(getExamQuestionStatus("答案", true), "review");
});

test("an unanswered submission requires a warning before final confirmation", () => {
  assert.equal(getSubmissionConfirmationStage(2), "unanswered");
  assert.equal(getSubmissionConfirmationStage(0), "final");
});

test("time expiry and network recovery reuse the form submission and draft sync paths", async () => {
  const form = await readFile(
    new URL(
      "src/app/dashboard/assignments/AssignmentSubmissionForm.tsx",
      root,
    ),
    "utf8",
  );
  assert.match(form, /remainingSeconds !== 0/);
  assert.match(form, /formRef\.current\?\.requestSubmit\(\)/);
  assert.match(form, /window\.addEventListener\("offline"/);
  assert.match(form, /window\.addEventListener\("online"/);
  assert.match(form, /handleOnline[\s\S]*saveDraft\(\)/);
});
