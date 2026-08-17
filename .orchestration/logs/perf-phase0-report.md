已完成仅诊断性能审计，未修改 `src/`、RLS、租户或真实用户数据。

产出：

- [perf-baseline.md](/home/yangzhen/projects/my-lms-system/.orchestration/perf-baseline.md)：dev/prod 计时、真实登录链、153 条路由 First Load JS 估算表、proof commands、账号清理证据。
- [perf-audit-backlog.md](/home/yangzhen/projects/my-lms-system/.orchestration/perf-audit-backlog.md)：学生端/管理端覆盖矩阵及 22 条分级 backlog。

验收结果：

- 1：PASS
- 2：FAIL（前置状态）——本任务只新增上述两份报告且 `src/` diff 为空，但开始前已有未跟踪的 `.orchestration/perf-governance-state.md`，因此全仓 `git status` 不可能仅显示两个文件。
- 3：PASS——学生和管理员临时账号均已真实使用并删除；`auth.users` 不存在，`profiles`、`tenant_memberships`、`tenant_provisioned_accounts`、`staff_profiles`、审计行均为 0。
- 4：PASS——覆盖所有主要学生/管理路由分组，并记录了“已检查，无新增发现”的分组。

关键结果：

- `npm run build` PASS，32/32 测试通过。
- prod warm curl：`/` 约 3.44ms total，`/login` 约 2.88ms。
- First Load JS gzip：`/` 128.3 KiB；学生常见 283–310 KiB；管理常见 289–319 KiB；最大 lesson 路由 374.8 KiB。
- prod 真实登录：学生 3278ms 落到 `/yuanzhi`；管理员 2292ms，经历三段 canonical/角色跳转后落到管理首页。
- dev 学生 UI 登录样本因 `.next/dev` manifest 截断而作废，已在报告中作为 caveat 明确标注；其 authenticated canonical 页面测量成功。