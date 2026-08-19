# Packet 11：机构与平台概览（Round 4 / Packet 11）

## 背景
Packet 10 已交付老师端"班级今日情况"看板，用单次数据库 RPC + `GROUP BY`/`FILTER` 聚合避免了逐学生查询，并用真实事务测试验证了权限隔离（跨老师访问被 SQLSTATE 42501 拦截）。本 Packet 沿用同样的聚合与验证方式，把范围扩大到机构负责人和平台负责人两个更高权限层级。

方案原文（只读参考）：
- 机构负责人权限：`docs/student-home-daily-learning-aggregation-roadmap.md` 第216-225行（6.2）。
- 平台负责人权限：第204-214行（6.1）。
- 机构概览细节：第872-882行（19.3）。
- 平台规则细节：第884-895行（19.4，第一版可用集中代码默认值）。
- Round4 Packet11 原始任务与验收：第1066-1078行。

## 目标
1. **机构负责人概览**：今日活跃率、今日必做完成率、作业按时完成率、考试参与率、章节巩固使用率、错题复习使用率、班级对比。范围限定在本机构内。
2. **平台负责人概览**：跨机构使用趋势（可以是简化的汇总列表：各机构的活跃率/完成率对比）。范围限定在平台负责人有权限查看的机构集合。
3. **平台规则配置**：任务类型默认优先级、即将截止时间范围、系统建议数量上限、薄弱能力推荐门槛、错题推荐门槛、默认周目标——第一版**允许使用集中代码默认值**（路线图第895行明确允许），不强制要求做管理界面。如果你评估后决定做一个只读展示当前默认值的页面也可以，但不是硬性要求。
4. **必须用聚合 SQL 实现，不能逐机构/逐班级循环查询**（延续 Packet 10 的要求）。

## 关键要求
1. **权限判定复用现有模式**：机构负责人只能看本机构数据，平台负责人看跨机构范围。查找仓库里现有的"机构负责人"、"平台负责人"角色判定逻辑（可能在现有的机构管理、平台管理页面里），复用其查询模式，不要重新发明角色体系。
2. **机构之间必须完全隔离**（红线）：用真实数据库事务测试证明（参考 Packet 10 的验证方式：创建两个机构的测试数据，用机构A负责人身份查询，确认看不到机构B数据）。
3. 新增文件放在合适的 `src/features/` 目录（例如 `src/features/institution-platform-overview/`），复用 Packet 10 建立的目录组织风格（`api/service.ts` + `model.ts` + `types.ts` + `components/`）。
4. 页面可以接入到现有机构管理/平台管理入口下（先查看仓库现有机构/平台管理页面结构），不要新建一级导航。

## 非目标 / 禁止事项
- 不允许跨机构数据泄露（红线）。
- 不允许逐机构/逐学生循环查询产生查询瀑布（红线）。
- 不修改老师端 Packet 10 已交付的任何文件核心逻辑。
- 不要求做完整的平台规则配置管理界面（第一版代码默认值即可）。

## 验收标准
1. 机构负责人只能看到本机构统计数据——真实数据库事务测试证明（创建两机构数据，交叉验证不可见）。
2. 平台负责人按授权范围展示——如果仓库现有平台角色本身就是全局权限，说明清楚这个前提，不需要额外发明"平台负责人只能看部分机构"的机制（除非现有代码已经有这种细粒度授权，复用即可）。
3. 各项统计指标（活跃率、完成率、参与率、使用率）口径与 Packet 10/学生首页状态判定一致。
4. 用聚合 SQL 实现，无查询瀑布——给出证据（查询数量与机构/班级/学生数量无关）。
5. `npm run typecheck`、`npm run lint`、`npm run build` 通过。
6. Round 1-4（含 Packet 10）已有测试全部仍然通过。
7. `git status --porcelain` 改动范围符合预期。

## 验证要求
实现完成后自己运行：
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:navigation`
- `node --experimental-strip-types --test tests/student-home-assignment-exam-source.test.mjs tests/student-home-course-practice-review-source.test.mjs tests/student-weekly-learning-plan.test.mjs tests/teacher-learning-recommendation.test.mjs tests/student-learning-task-preferences.test.mjs tests/teacher-class-today.test.mjs`
- 为新增汇总查询编写 fixture 单元测试
- 机构隔离的真实数据库事务测试（参考 Packet 10 方式）
- `git status --porcelain --untracked-files=all`

如果失败，自行修复后重新验证，直到全部通过。**机构隔离和无查询瀑布是硬性红线，必须有真实证据。**

## 交付报告格式
1. 改动/新增文件列表（含引用的现有权限判定逻辑源文件+行号）。
2. 每条验收标准 PASS/FAIL/BLOCKED。
3. 实际运行的验证命令、退出码、关键输出。
4. 机构隔离和"无查询瀑布"的具体证据。
5. 已知假设、遗留问题或范围偏差说明。
