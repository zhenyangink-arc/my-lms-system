import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseCompletionStatistics } from "../src/features/course-completion/statistics-types.ts";

const files = {
  migration: "supabase/migrations/202608200008_course_completion_statistics.sql",
  service: "src/features/course-completion/statistics-service.ts",
  view: "src/features/course-completion/CompletionStatisticsPanel.tsx",
  route: "src/app/[space]/dashboard/admin/apps/[appSlug]/completion-review/page.tsx",
  browser: "scripts/verify-course-completion-statistics.mjs",
};

async function sources() {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([key, path]) => [key, await readFile(path, "utf8")]),
    ),
  );
}

test("机构统计由数据库按机构、应用和缺口键类别聚合", async () => {
  const { migration } = await sources();
  const institutionFunction = migration.match(
    /function public\.get_institution_course_completion_statistics[\s\S]*?\n\$\$;/,
  )?.[0] ?? "";

  assert.match(institutionFunction, /private\.current_tenant_id\(\)/);
  assert.match(institutionFunction, /array\['tenant_super_admin', 'ceo'\]::text\[\]/);
  assert.match(institutionFunction, /evaluation\.tenant_id = v_tenant_id/);
  assert.match(institutionFunction, /evaluation\.student_app_id = p_student_app_id/);
  assert.match(institutionFunction, /jsonb_array_elements/);
  assert.match(institutionFunction, /group by gap\.value ->> 'key', gap\.value ->> 'category'/);
  assert.match(institutionFunction, /count\(\*\) filter/);
  assert.match(institutionFunction, /certificate\.status = 'issued'/);
});

test("平台趋势按月份、政策编号和版本独立聚合", async () => {
  const { migration } = await sources();
  const platformFunction = migration.match(
    /function public\.get_platform_course_completion_trends[\s\S]*?\n\$\$;/,
  )?.[0] ?? "";

  assert.match(platformFunction, /private\.is_platform_owner\(\)/);
  assert.match(platformFunction, /date_trunc\([\s\S]*?'month'/);
  assert.match(platformFunction, /policy\.policy_code/);
  assert.match(platformFunction, /evaluation\.policy_id/);
  assert.match(platformFunction, /evaluation\.policy_version/);
  assert.match(
    platformFunction,
    /group by[\s\S]*?evaluation\.period_start[\s\S]*?evaluation\.policy_id[\s\S]*?policy\.policy_code[\s\S]*?evaluation\.policy_version/,
  );
  assert.match(platformFunction, /count\(distinct evaluation\.tenant_id\)/);
});

test("服务层每个统计视图只发起一个 RPC，不按学生或机构循环", async () => {
  const { service, migration } = await sources();

  assert.equal((service.match(/\.rpc\(/g) ?? []).length, 1);
  assert.match(service, /get_institution_course_completion_statistics/);
  assert.match(service, /get_platform_course_completion_trends/);
  assert.doesNotMatch(service, /for\s*\(|forEach|Promise\.all\([^)]*\.map/);
  assert.match(migration, /current_evaluations as materialized/g);
  assert.doesNotMatch(migration, /\bloop\b/i);
});

test("统计界面展示两个比率、缺口分布和政策版本趋势，无装饰性英文标签", async () => {
  const { view, route, browser } = await sources();

  for (const label of ["符合资格率", "颁发率", "主要未达标缺口", "跨机构结课趋势", "政策版本"]) {
    assert.match(view, new RegExp(label));
  }
  assert.match(view, /CardTitleWithHint/g);
  assert.match(view, /role="img"/);
  assert.match(view, /<table/);
  assert.equal((view.match(/tabIndex=\{0\}/g) ?? []).length, 2);
  assert.match(view, /focus-visible:ring-2 focus-visible:ring-\[var\(--primary\)\]/);
  assert.match(view, /aria-label="跨机构结课趋势数据表"/);
  for (const width of [375, 768, 1280]) {
    assert.match(browser, new RegExp(`width: ${width}`));
  }
  assert.match(browser, /getByLabel\("跨机构结课趋势数据表"\)/);
  assert.match(route, /CompletionStatisticsPanel/);
  assert.doesNotMatch(view, /LEARNING JOURNEY|COURSE OUTCOMES|READY TO START|INTERACTION/);
});

test("统计响应解析保留政策版本和精确分子分母", () => {
  const parsed = parseCompletionStatistics({
    scope: "platform",
    trend: [
      {
        periodStart: "2026-08-01",
        policyId: "11111111-1111-4111-8111-111111111111",
        policyCode: "KOREAN-L1",
        policyVersion: 2,
        policyTitle: "韩国语一级结课政策",
        institutionCount: 3,
        totalEvaluations: 40,
        eligibleCount: 24,
        eligibleRate: 60,
        issuedCount: 18,
        issuanceRate: 75,
      },
    ],
  });

  assert.equal(parsed.scope, "platform");
  assert.equal(parsed.trend[0].policyId, "11111111-1111-4111-8111-111111111111");
  assert.equal(parsed.trend[0].policyVersion, 2);
  assert.equal(parsed.trend[0].eligibleCount, 24);
  assert.equal(parsed.trend[0].issuedCount, 18);
});
