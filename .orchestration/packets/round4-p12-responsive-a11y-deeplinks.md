# Packet 12：响应式、可访问性和真实跳转收尾（Round 4 / Packet 12，最后一个 Packet）

## 背景
这是整个方案（`docs/student-home-daily-learning-aggregation-roadmap.md`）12个 Packet 中的最后一个。前面已交付：
- Round 1：统一任务模型、深链、作业考试/课程/巩固/训练/错题聚合。
- Round 2：门户首页摘要（`/{space}/page.tsx`）、韩国语首页任务区（`DashboardHomePage.tsx`/`DailyLearningWorkspace.tsx`/`SystemGrowthHomeView.tsx`）、完成后刷新。
- Round 3：学生周计划、老师推荐、建议暂缓。
- Round 4：老师班级今日看板（Packet 10）、机构/平台概览（Packet 11）。

本 Packet 是收尾验证与修复，目标是让整个方案达到路线图第1205-1245行（26. 总体验收标准）列出的技术质量门槛。

方案原文（只读参考）：
- 交互与视觉要求：第689-703行（14节）。
- 总体验收标准：第1205-1245行（26节）。
- Round4 Packet12 原始任务与验收：第1080-1095行。

## 目标
对 Round 1-4 交付的所有新增/修改页面和组件做一次系统性收尾检查和修复，覆盖：

1. **响应式布局**：375px（手机）、平板、桌面三档视口下，门户首页摘要、韩国语首页任务区、老师班级今日看板、机构/平台概览这几个新增/修改的 UI 都不能出现横向滚动。
2. **可访问性**：
   - 核心触控区域至少 44px。
   - 状态用图标+文字，不能只靠颜色。
   - 键盘焦点顺序与视觉顺序一致，所有交互元素可通过键盘访问。
   - 手机端主要正文至少14px，辅助状态不低于12px。
   - `card-title-with-hint` 的叹号提示支持鼠标悬停、键盘聚焦和触屏点击，且有可访问名称（如果 Round 1-4 各 Packet 里已经正确使用了这个组件，这里主要是复核，不是重新实现）。
3. **真实跳转验证**：用真实关联数据验证以下跳转链路（路线图第1131-1142行列出的浏览器测试场景）：
   - 门户首页 → 韩国语任务
   - 韩国语首页 → 作业
   - 韩国语首页 → 考试
   - 韩国语首页 → 课程最后位置
   - 韩国语首页 → 章节巩固
   - 韩国语首页 → 专项训练具体章节
   - 韩国语首页 → 错题复习
   - 来源模块完成 → 返回首页并刷新
   
   由于你没有真实浏览器，用你能做到的最高精度方式验证（例如：读取 `routes.ts` 深链构造器的输出，逐一确认生成的路径在 `src/app/` 下确实存在对应 `page.tsx`；或者编写一个脚本遍历所有可能的 `sourceType`/参数组合，断言生成路径都能匹配到真实路由文件），不要仅凭"代码看起来对"就下结论。
4. **覆盖错误、空状态和时间边界**：确认门户首页、韩国语首页、老师看板、机构概览在数据加载失败、无数据、以及路线图第822-837行列出的时间边界场景（未开始/开始瞬间/今天23:59截止/明天截止/截止瞬间/逾期允许迟交/逾期禁止提交/补考）下都有合理表现，不报错、不空白。

## 关键要求
- 这是**修复和收尾**性质的 Packet，不是新增大功能。如果检查中发现 Round 1-4 已交付内容有响应式/可访问性/跳转问题，直接修复；如果发现的是超出本方案范围的问题，只记录不修复。
- 不破坏任何已通过的验收标准和已有测试。
- 不新增数据库表。

## 验收标准（对齐路线图第1240-1245行）
1. 375px 视口下，本方案新增/修改的页面无横向滚动。
2. 核心触控区域至少44px。
3. 状态均使用图标和文字（不仅靠颜色）。
4. 本方案所有 `HomeLearningTask` 类型任务的深链都能到达真实存在的最终页面（不是404，不是模块目录占位——除非确实缺少必要参数，此时安全回退到模块目录是允许的设计，不是缺陷）。
5. `npm run typecheck`、`npm run lint`、`npm run build` 全部通过。
6. 项目全部既有测试套件通过：`npm run test:navigation` 以及 Round 1-4 新增的所有测试文件（`tests/student-home-assignment-exam-source.test.mjs`、`tests/student-home-course-practice-review-source.test.mjs`、`tests/student-weekly-learning-plan.test.mjs`、`tests/teacher-learning-recommendation.test.mjs`、`tests/student-learning-task-preferences.test.mjs`、`tests/teacher-class-today.test.mjs`、`tests/institution-platform-overview.test.mjs`、`tests/student-home-refresh.test.mjs`）。
7. `git status --porcelain` 改动范围合理（应该是对已有文件的小幅修复，不是大规模重写）。

## 验证要求
实现完成后自己运行：
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:navigation`
- 上面列出的全部 Round 1-4 测试文件（一次性全部跑一遍，确认没有任何一个变红）
- 深链真实性验证脚本（自己编写并运行，产出证据）
- `git status --porcelain --untracked-files=all`

如果失败，自行修复后重新验证，直到全部通过。这是最后一个 Packet，请在报告最后给出"整个12-Packet方案是否已经全部落地"的总结判断。

## 交付报告格式
1. 检查发现的问题列表（如果有）及修复情况。
2. 每条验收标准 PASS/FAIL/BLOCKED。
3. 实际运行的验证命令、退出码、关键输出（尤其是深链真实性验证脚本的输出）。
4. 已知假设、遗留问题或范围偏差说明。
5. 对12个 Packet 整体完成情况的总结（哪些完全落地，哪些有已知缺口，哪些是刻意跳过的非目标）。
