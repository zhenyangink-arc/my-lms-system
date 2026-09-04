import assert from "node:assert/strict";
import { test } from "node:test";

import { getVisibleAdminNavigation } from "../src/app/dashboard/admin/admin-navigation.ts";

const fullAccess = {
  canManageConversationPractice: true,
  canAccessAnnouncements: true,
  canManageHelpCenter: true,
  canManageGradeCenter: true,
  canManageLearningRecords: true,
  canManageLibrary: true,
  canManageDocumentReviews: true,
  canManageTenants: true,
  canAccessQuestionBank: true,
  canManageVisas: true,
  canManageStudentAssignments: true,
};

const expectedNavigation = {
  platform_super_admin: [
    "应用中心",
    "Agent 运营中心",
    "模型用量",
    "管理首页",
    "通知公告管理",
    "帮助中心管理",
    "资料库管理",
    "账号管理",
    "租户管理",
    "权限中心",
  ],
  tenant_operator: [
    "应用中心",
    "管理首页",
    "租户管理",
  ],
  platform_course_inspector: ["课程前台巡检"],
  tenant_super_admin: [
    "应用中心",
    "模型用量",
    "管理首页",
    "通知公告管理",
    "帮助中心管理",
    "资料库管理",
    "账号管理",
    "成绩中心",
    "学习记录",
    "学生作业分配",
    "资料审核",
    "签证管理",
  ],
  ceo: [
    "应用中心",
    "模型用量",
    "管理首页",
    "通知公告管理",
    "帮助中心管理",
    "资料库管理",
    "账号管理",
    "成绩中心",
    "学习记录",
    "资料审核",
    "签证管理",
  ],
  admin: [
    "应用中心",
    "管理首页",
    "通知公告管理",
    "资料库管理",
    "成绩中心",
    "学习记录",
    "资料审核",
    "签证管理",
  ],
  teacher: [
    "应用中心",
    "管理首页",
    "帮助中心管理",
    "成绩中心",
    "学习记录",
    "资料审核",
    "签证管理",
  ],
  student: [],
};

function labelsFor(role, access = fullAccess) {
  return getVisibleAdminNavigation(role, access).map((item) => item.label);
}

for (const role of Object.keys(expectedNavigation)) {
  test(`${role} 的管理导航契约保持完整`, () => {
    assert.deepEqual(labelsFor(role), expectedNavigation[role]);
  });
}

test("能力开关仍会隐藏未授权入口", () => {
  const labels = labelsFor("teacher", {
    ...fullAccess,
    canManageConversationPractice: false,
    canManageHelpCenter: false,
    canManageGradeCenter: false,
    canManageLearningRecords: false,
  });

  assert.deepEqual(labels, ["应用中心", "管理首页", "资料审核", "签证管理"]);
});

test("老师不会获得平台或机构负责人的专属入口", () => {
  const teacherLabels = new Set(labelsFor("teacher"));
  for (const protectedLabel of [
    "课程树管理",
    "平台标准题库",
    "学生管理",
    "课程管理",
    "账号管理",
    "租户管理",
    "权限中心",
  ]) {
    assert.equal(teacherLabels.has(protectedLabel), false, `${protectedLabel} 不应对老师显示`);
  }
});

test("学生不会获得任何管理导航", () => {
  assert.deepEqual(getVisibleAdminNavigation("student", fullAccess), []);
});

test("Agent 运营中心只出现在平台负责人导航中", () => {
  for (const role of ["tenant_operator", "platform_course_inspector", "tenant_super_admin", "ceo", "admin", "teacher", "student"]) {
    assert.equal(labelsFor(role).includes("Agent 运营中心"), false, `${role} 不应看到 Agent 运营中心`);
  }
  assert.equal(labelsFor("platform_super_admin").includes("Agent 运营中心"), true);
});
