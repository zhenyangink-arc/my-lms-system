# Packet 1：统一任务模型、状态/优先级枚举、任务标识与深链构造器

## 背景
你已经在 Packet 0 中读过 `docs/student-home-daily-learning-aggregation-roadmap.md`，理解了整体方案、关键决策与非目标。本 Packet 是路线图第20节 Round1/Packet1 的落地。

## 目标
新建目录 `src/features/student-home-learning/`，只建立类型定义、枚举、任务标识规则、路由(深链)构造器，**不接入任何真实数据源、不新增页面、不新增路由、不写数据库**。

## 必须新建的文件

- `src/features/student-home-learning/api/types.ts`
  - 按路线图第333-377行定义 `HomeLearningTask` 类型（字段名、类型、可选性完全对齐路线图）。
  - 定义 `sourceType`、`status`、`priority` 的 TypeScript union/枚举。
  - 类型中不得包含颜色、图标、CSS class 等视觉字段。
- `src/features/student-home-learning/routes.ts`
  - 提供深链构造函数，覆盖：作业详情、考试详情、课程最后学习位置、章节巩固详情、指定能力+章节的专项训练、错题复习、成绩/评语页面（路线图第705-725行）。
  - 每个构造函数接收必要的业务 id（如 assignmentId、courseId 等）和当前 `space`（租户/机构路径 slug，参考 `src/app/[space]/page.tsx` 中已有的 space 参数用法），返回真实业务路由字符串。
  - 提供统一安全回退：当缺少必要 id 或无法生成具体深链时，返回对应模块目录的顶层路由，不允许返回 404 或无效路径。
  - 参考仓库中真实存在的业务路由路径（在 `src/app/[space]/` 下查找作业、考试、巩固中心、专项训练(toolbox)、错题复习(review-center)等页面的实际路径），构造函数返回的路径必须是仓库中真实存在的路由，不能是路线图中虚构的路径。
- `src/features/student-home-learning/status.ts`
  - 提供从来源状态数据映射到统一 `status` 枚举的**纯函数签名和类型**（路线图第427-463行的状态机描述），但由于本 Packet 不接入真实数据源，这些函数体可以是最简单的直传/占位实现，只要类型签名正确、可被后续 Packet（作业/考试聚合、课程/巩固/训练/错题聚合）复用即可。函数需要有清晰的输入类型（不能是 any）。
- `src/features/student-home-learning/priority.ts`
  - 定义任务标识（taskKey）构造函数：`studentAppId:sourceType:sourceId`（路线图第379-391行）。
  - 定义默认优先级顺序的类型/常量骨架（路线图第469-489行的10级优先级列表可以先做成一个只读常量数组+排序比较函数，暂不需要真实数据接入）。

## 非目标 / 禁止事项
- 不修改 `src/app/[space]/page.tsx`、`src/app/[space]/apps/korean/page.tsx`、`DashboardHomePage.tsx` 或任何现有页面。
- 不新增任何路由文件。
- 不新增或修改任何数据库表/迁移文件。
- 不读写 `learning_assignments`、`learning_submissions`、`lesson_progress` 等真实业务表。
- 不引入装饰性英文标签字段（如 eyebrow、typeLabel、interactionLabel），这是本项目 CLAUDE.md 的硬性要求。

## 验收标准
1. `src/features/student-home-learning/` 目录存在且包含上述4个文件（types.ts / routes.ts / status.ts / priority.ts）。
2. `HomeLearningTask` 类型字段与路线图第333-377行一致，且不含视觉样式字段。
3. 每类来源（assignment/exam/course/chapter_practice/specialized_practice/review/teacher_recommendation/student_plan）都有稳定任务标识格式。
4. 每类来源都有对应的深链构造函数，且都指向仓库中**真实存在**的路由（用 grep/ls 验证路径存在，不是编造的）；缺少 id 时有安全回退，不产生 404 路径。
5. 没有新增页面、没有新增数据库写入、没有修改任何现有业务文件。
6. `npm run typecheck` 通过（新文件不引入类型错误）。
7. `npm run lint` 对新文件不报错（如果整体 lint 因既有代码报错，只需确认新文件本身无 lint 错误，并在报告中说明）。

## 验证要求
实现完成后，自己运行：
- `npm run typecheck`
- `npm run lint`（至少确认新文件无报错）

如果失败，自行修复后重新运行，直到通过为止。不要跳过验证或放宽断言。

## 交付报告格式
1. 改动/新增文件列表。
2. 每条验收标准的 PASS/FAIL/BLOCKED。
3. 实际运行的验证命令、退出码和关键输出。
4. 已知假设、遗留问题或范围偏差说明。
