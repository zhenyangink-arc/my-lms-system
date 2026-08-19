# Packet 4：聚合入口服务 + 学生门户首页今日摘要（Round 2 / Packet 4）

## 背景
Round 1 已交付：
- `src/features/student-home-learning/{api/types.ts,routes.ts,status.ts,priority.ts}`（统一模型/深链/状态/优先级）
- `api/assignment-exam-source.ts` + `assignment-exam-mapper.ts`（作业考试聚合）
- `api/{course,chapter-practice,specialized-practice,review}-source.ts` 及各自 `-mapper.ts`（课程/巩固/训练/错题聚合）
- `api/dedupe.ts`（跨源去重）

方案原文（只读参考）：
- 门户首页职责与"不做什么"：`docs/student-home-daily-learning-aggregation-roadmap.md` 第117-160行。
- 门户首页改造细节：第561-604行（12节）。
- 优先级/排序/门户选择规则：第465-510行（10节，尤其10.3门户首页选择规则）。

## 目标（两部分，缺一不可）

### 第一部分：聚合入口服务
新建 `src/features/student-home-learning/api/service.ts`，做两件事：
1. 并行调用 Round 1 交付的5类来源（assignment-exam、course、chapter-practice、specialized-practice、review），合并结果，跑 `dedupe.ts` 去重，用 `priority.ts` 的规则排序，返回完整 `HomeLearningTask[]`（供 Packet 5 韩国语应用首页使用）。
2. 提供一个门户摘要选择函数（对应路线图10.3"门户首页选择规则"），只返回：
   - 排序后第一项（"今天最重要"）
   - 今日必做总数
   - 最近一项即将截止提醒
   - 最近一条已发布反馈（**需要你自行调研**：反馈来源可能是作业/考试成绩发布后的老师评语，在批改/成绩相关代码中查找，例如 `learning_submissions` 的评语字段或成绩发布记录；如果第一版确实没有可用的"最新反馈"数据源，可以先返回空值并在报告中说明原因，不要编造数据源）。
   - 不要把完整任务数组传给门户摘要（路线图第499行明确要求）。

### 第二部分：门户首页摘要模块
修改 `src/app/[space]/page.tsx`（现有学生门户首页），在问候区和应用目录之间新增摘要模块：
- 结构参考路线图第577-589行示例：今天最重要任务（标题/来源应用/截止或进度/推荐原因/进入按钮）+ 三个简洁数字（今日剩余必做/即将截止/新反馈）。
- 第一版只有韩国语数据：正常显示韩国语来源；没有其他应用数据时不显示空的应用区域（路线图第595-598行）。
- 摘要点击进入真实业务页面（用 Packet 1 的深链）。
- 无任务时页面结构仍正常（显示"继续课程"或"进入巩固中心"之类的引导，不要展示报错或空白区域）。
- 遵守本项目 CLAUDE.md 硬性规则：不使用纯装饰性英文眉题/标签；标题+补充说明必须复用 `@/components/ui/card-title-with-hint` 组件，不要自己实现叹号按钮或 Tooltip。

## 非目标 / 禁止事项
- 不新增任何路由（尤其不新增 `/today`）。
- 不新增一级导航入口。
- 不能让门户首页变成"完整任务列表"或韩国语专属页面——只展示摘要。
- 不修改 `src/app/[space]/apps/korean/page.tsx`、`DashboardHomePage.tsx`（那是 Packet 5 的范围）。
- 不修改 Round 1 交付的任何聚合源文件的内部逻辑（如需扩展签名，只能新增，不要破坏 Packet 2/3 已通过的测试）。
- 不写数据库、不新增表。

## 验收标准
1. `service.ts` 并行读取5类来源（不是串行 await 链，用 `Promise.all` 或等价方式）。
2. 门户摘要选择函数只返回"第一项+计数+截止提醒+反馈"，不返回完整数组。
3. `/{space}` 页面新增摘要模块，位置在问候区和应用目录之间。
4. 只有韩国语数据时不展示空的其他应用区域。
5. 摘要"进入任务"按钮的链接来自 Packet 1 `routes.ts` 深链，不是自拼路由。
6. 无任务时页面不报错、不出现空白区域，有合理引导。
7. 标题的补充说明复用 `card-title-with-hint` 组件（如果本次改动确实需要标题+说明的场景）。
8. 没有新增路由文件、没有新增一级导航配置改动。
9. Round 1 已有的测试文件仍然全部通过（不能因为扩展类型/签名破坏既有测试）。
10. `npm run typecheck`、`npm run lint`、`npm run build` 全部通过。
11. `npm run test:navigation`（项目已有的导航测试脚本）通过，确认没有破坏现有路由结构。

## 验证要求
实现完成后自己运行：
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:navigation`
- 重新运行 Packet 2、Packet 3 新增的测试文件，确认仍然通过：
  `node --experimental-strip-types --test tests/student-home-assignment-exam-source.test.mjs tests/student-home-course-practice-review-source.test.mjs`
- `git status --porcelain --untracked-files=all`（确认改动范围符合预期：只有 `src/app/[space]/page.tsx` 被修改，其余是新增文件）

如果失败，自行修复后重新验证，直到全部通过。不要放宽断言、不要跳过用例、不要注释掉失败的测试。

## 交付报告格式
1. 改动/新增文件列表。
2. 每条验收标准 PASS/FAIL/BLOCKED。
3. 实际运行的验证命令、退出码、关键输出。
4. "最新反馈"数据源的调研结论（找到了用什么字段，没找到就说明原因和当前占位方案）。
5. 已知假设、遗留问题或范围偏差说明。
