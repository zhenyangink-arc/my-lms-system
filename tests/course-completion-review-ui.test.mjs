import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  workspace: "src/app/dashboard/admin/apps/ManagementApplicationWorkspacePage.tsx",
  section: "src/app/dashboard/admin/apps/ManagementApplicationSectionPage.tsx",
  route: "src/app/[space]/dashboard/admin/apps/[appSlug]/completion-review/page.tsx",
  service: "src/features/course-completion/review-service.ts",
  actions: "src/features/course-completion/review-actions.ts",
  view: "src/features/course-completion/CompletionReviewWorkspace.tsx",
  sheet: "src/components/ui/sheet.tsx",
  browser: "scripts/verify-course-completion-review-ui.mjs",
};

async function sources() {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([key, path]) => [key, await readFile(path, "utf8")]),
    ),
  );
}

test("结课审核复用韩国语应用工作区并按范围开放审核或统计", async () => {
  const source = await sources();

  assert.match(source.workspace, /key: "completion-review"/);
  assert.match(source.workspace, /appSlugs: \["korean"\]/);
  assert.match(source.workspace, /capability: "manageAssessments"/);
  assert.doesNotMatch(source.workspace.match(/key: "completion-review"[\s\S]*?\n  },/)?.[0] ?? "", /institutionExecutiveOnly/);
  assert.match(source.route, /canReviewInstitution/);
  assert.match(source.route, /context\.access\.scope === "tenant"/);
  assert.match(source.route, /context\.access\.app\.slug === "korean"/);
  assert.match(source.route, /\["teacher", "tenant_super_admin", "ceo"\]\.includes/);
  assert.match(source.route, /canViewPlatformStatistics/);
  assert.match(source.route, /context\.access\.globalRole === "platform_owner"/);
  assert.match(source.route, /getCompletionStatistics/);
  assert.doesNotMatch(source.view, /typeLabel|interactionLabel|KOREAN LEVEL|LEARNING JOURNEY/);
});

test("审核读取显式限定机构与应用，且不展示历史替代资格", async () => {
  const { service } = await sources();

  assert.match(service, /\.eq\("tenant_id", access\.tenantId\)/g);
  assert.match(service, /\.eq\("student_app_id", access\.appId\)/g);
  assert.match(service, /\.neq\("status", "superseded"\)/);
  assert.match(service, /certificateScopes/);
  assert.match(service, /item\.status === "eligible"/);
  assert.match(service, /item\.status !== "eligible"/);
  assert.match(service, /item\.status === "revoked" \|\| item\.status === "reissued"/);
});

test("三类证书操作重新鉴权、校验输入并调用现有 RPC", async () => {
  const { actions } = await sources();

  assert.match(actions, /requireCompletionCertificateManager/g);
  assert.match(actions, /z\.string\(\)\.uuid\(\)/);
  assert.match(actions, /z\.string\(\)\.trim\(\)\.min\(2\)\.max\(1000\)/);
  assert.match(actions, /"issue_course_completion_certificate"/);
  assert.match(actions, /"revoke_course_completion_certificate"/);
  assert.match(actions, /"reissue_course_completion_certificate"/);
  assert.match(actions, /revalidatePath\(`\$\{access\.appPath\}\/completion-review`\)/g);
});

test("资格明细和四类列表具备自然语言缺口、移动端及键盘约束", async () => {
  const { view, sheet, browser } = await sources();

  for (const label of ["待审核", "未达标", "已颁发", "已撤销", "已完成项目", "未达标项目"]) {
    assert.match(view, new RegExp(label));
  }
  assert.match(view, /gap\.reason/);
  assert.match(view, /CardTitleWithHint/);
  assert.match(view, /role="tablist"/);
  assert.match(view, /ArrowLeft/);
  assert.match(view, /ArrowRight/);
  assert.match(view, /min-h-11/g);
  assert.match(view, /grid-cols-2[\s\S]*sm:grid-cols-4/);
  assert.match(view, /w-full max-w-full overflow-y-auto sm:max-w-lg/);
  assert.match(view, /max-h-\[calc\(100dvh-2rem\)\] overflow-y-auto/);
  assert.equal((view.match(/<AlertDialogCancel className="min-h-11">/g) ?? []).length, 3);
  assert.match(sheet, /className="absolute top-1\.5 right-1\.5 size-11"/);
  for (const width of [375, 768, 1280]) {
    assert.match(browser, new RegExp(`width: ${width}`));
  }
  assert.match(browser, /keyboard\.press\("ArrowRight"\)/);
  assert.match(browser, /alert-dialog-content/);
  assert.match(browser, /element === document\.activeElement/);
  assert.doesNotMatch(view, /INTERACTION|COURSE OUTCOMES|READY TO START|LEARNING JOURNEY/);
});
