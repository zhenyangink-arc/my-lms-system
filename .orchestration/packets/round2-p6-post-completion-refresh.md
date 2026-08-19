# Packet 6：完成任务后的首页刷新（Round 2 / Packet 6）

## 背景
Packet 4 升级了 `/{space}` 门户首页摘要，Packet 5 升级了韩国语应用首页任务区（`DashboardHomePage.tsx` / `DailyLearningWorkspace.tsx` / `SystemGrowthHomeView.tsx`），都依赖 `src/features/student-home-learning/api/service.ts` 的聚合结果。目前这些数据是页面加载时读取一次，学生从作业/考试/巩固/训练/错题等页面完成任务返回首页后，摘要和任务区可能还是旧状态。

方案原文（只读参考）：`docs/student-home-daily-learning-aggregation-roadmap.md` 第727-749行（16. 数据刷新）、第986-1000行（Round2 Packet6 原始任务与验收标准）。

## 目标
让学生完成以下动作后返回首页时，摘要和任务区能反映最新状态（路线图第729-740行列出的触发场景，第一版重点覆盖学生可直接触发的场景）：
- 保存作业草稿
- 提交作业或考试
- 完成课程/教材活动
- 完成章节巩固
- 完成专项训练
- 完成错题复习

## 关键要求
1. **先调研 Next.js 项目当前的数据刷新/缓存机制**：这是一个基于 App Router 的 Next.js 项目，查看现有页面在完成操作后如何刷新数据（例如 `revalidatePath`、`revalidateTag`、`router.refresh()`，或客户端重新 fetch）。参照仓库里作业/课程/巩固/训练/错题这几类"完成后跳转"或"提交成功后"的现有代码模式，采用与项目现有约定一致的方式，不要引入一套新的、和现有页面不一致的缓存机制。
2. **建议使用统一缓存标签**（路线图第742-747行提到的思路，可以采纳也可以按项目现有约定调整命名）：
   ```
   student-home-learning:{tenantId}:{studentId}
   student-app-home:{tenantId}:{studentId}:{studentAppId}
   ```
   即使第一版不引入真正的服务端缓存层，也要把"刷新入口"集中封装（例如 `src/features/student-home-learning/api/refresh.ts` 之类的单一入口），不要在每个业务模块里散落写各自的刷新逻辑。
3. 覆盖点：在作业草稿保存、作业/考试提交、课程/教材活动完成、章节巩固完成、专项训练完成、错题复习完成对应的 server action / route handler 里，调用这个统一刷新入口。
4. **保留返回首页后的滚动位置和状态**（路线图第993行验收标准之一）——如果当前首页本来就没有特殊滚动状态管理，说明"无需改动，默认行为已满足"即可，不要为了满足这条而过度设计。

## 非目标 / 禁止事项
- 不改变作业、考试、课程、巩固、训练、错题的判定规则或业务逻辑本身，只处理"完成后如何让首页拿到最新数据"这一件事。
- 不引入新的数据库表或迁移。
- 不重写 Packet 4/5 已经交付的组件结构，只做必要的刷新调用接入。
- 不做真正的分布式缓存/Redis等基础设施改造，第一版允许"不启用缓存但集中封装入口"（路线图749行明确允许）。

## 验收标准
1. 提交作业后，回到韩国语首页，该作业不再显示"未开始"/旧状态（用你能构造的验证方式证明，例如集成测试、或至少展示调用链路：提交 action → 刷新入口 → 页面重新获取数据）。
2. 完成章节巩固后，首页能反映出该巩固任务不再出现在"必做"或状态已更新。
3. 刷新入口被集中封装、有清晰命名，不是分散在各业务文件里各写一套。
4. 没有引入与项目现有缓存/刷新约定冲突的新机制。
5. 没有修改判题、成绩、权限相关的业务规则。
6. `npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:navigation` 全部通过。
7. Round 1/2 已有测试仍然全部通过。
8. `git status --porcelain` 改动范围合理（新增刷新入口文件 + 少量业务 action/route 文件里增加刷新调用，不应有大规模无关重写）。

## 验证要求
实现完成后自己运行：
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:navigation`
- `node --experimental-strip-types --test tests/student-home-assignment-exam-source.test.mjs tests/student-home-course-practice-review-source.test.mjs`
- `git status --porcelain --untracked-files=all`

如果失败，自行修复后重新验证，直到全部通过。不要放宽断言、不要跳过用例。

## 交付报告格式
1. 改动/新增文件列表（含在哪些 action/route 里接入了刷新调用）。
2. 每条验收标准 PASS/FAIL/BLOCKED。
3. 实际运行的验证命令、退出码、关键输出。
4. 已知假设、遗留问题或范围偏差说明（尤其是"滚动位置保留"这条你的判断和依据）。
