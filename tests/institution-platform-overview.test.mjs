import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildInstitutionPlatformOverviewFixture,
  parseInstitutionPlatformOverviewSnapshot,
} from "../src/features/institution-platform-overview/model.ts";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("fixture aggregates only authorized institutions", () => {
  const snapshot = buildInstitutionPlatformOverviewFixture({
    scope: "institution",
    generatedAt: "2026-08-19T03:00:00.000Z",
    authorizedTenantIds: ["tenant-a"],
    tenants: [
      { tenantId: "tenant-a", tenantName: "甲机构" },
      { tenantId: "tenant-b", tenantName: "乙机构" },
    ],
    students: [
      { tenantId: "tenant-a", studentId: "student-a1" },
      { tenantId: "tenant-a", studentId: "student-a2" },
      { tenantId: "tenant-b", studentId: "student-b1" },
    ],
    facts: [
      {
        tenantId: "tenant-a",
        studentId: "student-a1",
        activeToday: true,
        requiredTaskTotal: 2,
        requiredTaskCompleted: 1,
        homeworkDueTotal: 1,
        homeworkOnTimeCount: 1,
        examEligibleTotal: 1,
        examParticipatedCount: 1,
        usedChapterPractice: true,
        usedReview: true,
      },
      {
        tenantId: "tenant-a",
        studentId: "student-a2",
        requiredTaskTotal: 2,
        requiredTaskCompleted: 0,
        homeworkDueTotal: 1,
        examEligibleTotal: 1,
      },
      {
        tenantId: "tenant-b",
        studentId: "student-b1",
        activeToday: true,
        requiredTaskTotal: 20,
        requiredTaskCompleted: 20,
        usedChapterPractice: true,
        usedReview: true,
      },
    ],
  });

  assert.equal(snapshot.institutions.length, 1);
  const institution = snapshot.institutions[0];
  assert.equal(institution.tenantId, "tenant-a");
  assert.deepEqual(institution.active, { completed: 1, total: 2, rate: 50 });
  assert.deepEqual(institution.requiredCompletion, {
    completed: 1,
    total: 4,
    rate: 25,
  });
  assert.equal(institution.homeworkOnTime.rate, 50);
  assert.equal(institution.examParticipation.rate, 50);
  assert.equal(institution.chapterPracticeUsage.rate, 50);
  assert.equal(institution.reviewUsage.rate, 50);
});

test("RPC parser preserves institution and class rate counts", () => {
  const snapshot = parseInstitutionPlatformOverviewSnapshot({
    generated_at: "2026-08-19T03:00:00.000Z",
    scope: "institution",
    institutions: [
      {
        tenant_id: "tenant-a",
        tenant_name: "甲机构",
        student_count: 4,
        active_count: 3,
        active_rate: "75.0",
        required_task_total: 8,
        required_task_completed: 6,
        required_completion_rate: 75,
        classes: [
          {
            class_key: "teacher-a:app-a",
            class_name: "安老师 · 韩语",
            teacher_id: "teacher-a",
            student_app_id: "app-a",
            student_count: 4,
            active_count: 3,
            active_rate: 75,
            required_task_total: 8,
            required_task_completed: 6,
            required_completion_rate: 75,
          },
        ],
      },
    ],
  });

  assert.equal(snapshot.institutions[0].active.rate, 75);
  assert.equal(snapshot.institutions[0].classes[0].requiredCompletion.total, 8);
});

test("overview uses one role-scoped aggregate RPC with no query loop", async () => {
  const [migration, service, adminPage] = await Promise.all([
    source("supabase/migrations/202608190022_institution_platform_learning_overview.sql"),
    source("src/features/institution-platform-overview/api/service.ts"),
    source("src/app/dashboard/admin/page-content.tsx"),
  ]);

  assert.match(migration, /private\.is_platform_owner\(\)/i);
  assert.match(migration, /membership\.role = 'tenant_super_admin'/i);
  assert.match(migration, /tenant\.id = p_tenant_id/i);
  assert.match(migration, /raise exception using[\s\S]*errcode = '42501'/i);
  assert.match(migration, /with authorized_tenants as materialized/i);
  assert.match(migration, /count\([^)]*\) filter/i);
  assert.match(migration, /group by/i);
  assert.match(migration, /activity\.event_type not in \([\s\S]*'assignment_graded'/i);
  assert.doesNotMatch(migration, /\b(loop|foreach)\b/i);

  assert.equal((service.match(/\.rpc\(/g) ?? []).length, 1);
  assert.doesNotMatch(service, /for\s*\(/);
  assert.match(adminPage, /loadInstitutionPlatformOverview/);
});
