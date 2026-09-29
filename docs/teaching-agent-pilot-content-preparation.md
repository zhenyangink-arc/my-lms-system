# UPLY Teaching Agent — Pilot Content Preparation Package

2026-09-14 UTC；状态：**PARTIAL，准备目标已明确，真实 Candidate = 0**。这是待教学负责人审核的准备包，不是发布许可。未生成生产 DML、未改课程或 unlock、未复制 synthetic fixture、未发布内容。

## 1. 只读事实与选择

来源：[production-inventory.sql](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3b/production-inventory.sql)、[course-inventory.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3b/course-inventory.json)。事务 `BEGIN READ ONLY`，仅课程/教学对象元数据及数据库内韩文字符计数；未读取真实 enrollment、progress、成绩、聊天或学生资料。5 个 Korean courses、19 个 published catalog lessons，17 immediate、2 prerequisite_passed。所有 course 均 published/immediate。

17 个 immediate lesson 的 textbook、version、chapter、module、teaching lesson、linked profile、script、node **全部为 0（包括草稿）**。只有 basic-pronunciation 有 1 本教材、1 published version、17 published chapters、132 modules、132 published teaching lessons、1 published script/8 nodes；草稿与发布合计 10 scripts/75 nodes。该 catalog lesson 是 prerequisite_passed，Policy 不支持。daily-greetings 同样是 prerequisite_passed，且内容链为 0。

SQL 检出 8 个 published-chain Korean-containing nodes，匹配韩文音节及兼容 Jamo；这是节点内容的聚合检测，**不是实际分句数、不是 Selection Pins 数，也不是完整 Policy PASS**。`references.ts` 使用正式 `teachingScriptSegments` 及安全 segment/video 数据，实际 Pin 必须另行通过 server projector 验证。0 Candidate 由必要内容/解锁条件已可否定，不需要访问学生数据。

## 2. 全部 immediate lessons 的评分

评分仅用于安排准备优先级：U=受支持 immediate 1；T/M/L/P/S=已存在教材/modules/teaching lessons/关联 published profile/scripts，各 1；UI 列为“专用已编写学习界面 / 已接 Agent 选句动作”，各 1。教学适配 J：首轮独立字母入门 2，其余需进一步教学评审 1（判断，不是学生评估）。总分相加。成本没有实测，统一 Unknown、不计入总分；不能凭此宣称工时最少。所有行都能进入一般课程路由，UI=0 指没有核实可复用的专用内容/Agent入口，不是没有页面。

| Lesson | U | T | M | L | P | S | UI（学习/Agent） | 内容补齐成本 | J | 分数 |
|---|---:|---:|---:|---:|---:|---:|---|---|---:|---:|
| advanced-grammar-expression | 1 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | Unknown | 1 | 2 |
| campus-and-introduction | 1 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | Unknown | 1 | 2 |
| discussion-and-writing | 1 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | Unknown | 1 | 2 |
| hangul-introduction | 1 | 0 | 0 | 0 | 0 | 0 | 1 / 0 | Unknown | 2 | 4 |
| intermediate-grammar-bridge | 1 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | Unknown | 1 | 2 |
| korean-level-five | 1 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | Unknown | 1 | 2 |
| korean-level-four | 1 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | Unknown | 1 | 2 |
| korean-level-six | 1 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | Unknown | 1 | 2 |
| korean-level-three | 1 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | Unknown | 1 | 2 |
| news-and-academic-reading | 1 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | Unknown | 1 | 2 |
| reading-and-writing | 1 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | Unknown | 1 | 2 |
| restaurant-and-shopping | 1 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | Unknown | 1 | 2 |
| situational-conversation | 1 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | Unknown | 1 | 2 |
| topik-listening-strategy | 1 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | Unknown | 1 | 2 |
| topik-reading-strategy | 1 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | Unknown | 1 | 2 |
| topik-vocabulary-grammar | 1 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | Unknown | 1 | 2 |
| transport-and-medical | 1 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | Unknown | 1 | 2 |

目标是**现有课程结构下最合理的准备目标**；工程成本仍须内容负责人和工程负责人确认。所有候选都缺 authoring 数据链，没有“只改开关即可用”的备选。

## 3. 推荐准备目标

| 项目 | 内容 |
|---|---|
| Course | korean-beginner |
| Course ID | 2f79a679-6e25-4cf9-9f71-455905584787 |
| Lesson | hangul-introduction — 预备课：韩文字母入门 |
| Lesson ID | 6ad20a2b-2306-4173-9d3f-73eb9691ff58 |
| 现状 | published / immediate / is_manually_locked=false / available_from=null |
| 推荐理由 | 已有 HangulInteractiveBook、内容位于课程起点、无需改变学习顺序，适合小范围解释已选韩文片段 |
| 当前缺口 | textbook/version/chapter/module、teaching lesson、profile 关联、script/nodes/韩文 segments/objectives、正式 Agent 课堂入口 |

全局已有 Teaching Script profile `uply-korean-teacher`（93b0c9cd-ad29-4c0d-bc76-819efbab4295，published，subject=korean，feature=korean_course），可在获批 authoring 中核对复用；目标尚未关联。它**不是** Agent Core 的 `student-ai-teacher@1.0.0` definition，后者生产表目前不存在，不能以 Script profile 代替 definition/migration 前置条件。

## 4. 正式 authoring / publish 路径与明确缺口

1. Teaching Content Owner 审核课程/lesson 归属、模块目标、原文权利及教学合理性；Engineering Owner 先确认“从零建立 textbook/version/chapter/module/teaching lesson”的正式管理工作流。**当前源码未确认完整从零入口，不能直接给出可执行的新建点击步骤。** Studio service 仅加载已有教材与 teaching lessons，无对象时返回空列表。此缺口需单独授权的内容/管理流程任务；禁止用 SQL、seed 或 fixture 绕过。
2. 对已正式建立且父子关系正确的 teaching lesson，在管理端 Apps → teaching-scripts（相应 chapter）进入 Studio。路由 [page.tsx](/home/yangzhen/projects/my-lms-system/src/app/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/page.tsx)；加载器 [service.ts](/home/yangzhen/projects/my-lms-system/src/features/learning-agent-script-studio/service.ts:135)。
3. 使用 `createTeachingScriptDraftAction` → `create_learning_agent_script_draft`，再 `addTeachingScriptNodeAction` / `saveTeachingScriptNodeAction` 编辑草稿。它们要求现有 teaching lesson，并不创建教材骨架。[actions.ts](/home/yangzhen/projects/my-lms-system/src/app/dashboard/admin/teaching-scripts/actions.ts:252)。
4. 教学负责人审核后，具备正式管理权限的发布者执行“校验并发布”：`publishTeachingScriptAction` → snapshot 校验（包括实际适用的视频/分段/对象条件）→ `publish_teaching_script_checked`。保留期望 token/并发检查；不能绕过缺失视频或其他校验。[actions.ts](/home/yangzhen/projects/my-lms-system/src/app/dashboard/admin/teaching-scripts/actions.ts:899)。
5. 使用现有 `publishTextbookChapterAction` → `publish_digital_textbook_chapter` 发布教材章节快照；`setTextbookStatusAction` 管理已有教材状态。确认选定 published version 及章节归属，脚本发布与教材发布不能互相代替。[actions.ts](/home/yangzhen/projects/my-lms-system/src/app/dashboard/admin/digital-textbook/actions.ts:168)。版本骨架创建和完整发布顺序必须由正式工作流确认，不能假定现有按钮覆盖全部对象。
6. `digital_textbook_modules` **无独立 status**，其 published 含义是位于已发布 version/chapter/快照。`learning_agent_script_nodes` **也无 status**，通过 published script 和 student-safe view 可见。不要要求不存在的字段。模块沿用现有固定 module codes 和序号，不创建任意 code 绕约束。
7. 教材齐备后还须单独完成目标页面 Agent slot 集成并验证。现有 `page-content.tsx` 的 hangul-introduction 分支仅返回 HangulInteractiveBook；只有 basic-pronunciation 分支接 `loadStudentTeachingSlots` / SmartTextbookShell。[page-content.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page-content.tsx:735)。**R3B 不修改该 UI。**

## 5. 教学内容结构模板（待审核，不是生产正文）

| 对象 | 教学负责人填写/审核内容 |
|---|---|
| 教材、版本、章节 | 正式标题、所属 lesson、章节范围、版本说明；不要保存装饰性 eyebrow/typeLabel |
| 目标模块 | 沿用正式模块类型；选一个适合解释字母/音节组合的模块，明确与现有 Hangul 学习内容关系 |
| Objectives（建议 1–3） | 能识别本段目标字母；能解释其组合成音节的方式；能按当前材料辨别一个例子（具体内容待审核） |
| 节点 1 | 引入目标；明确本段所需已学内容 |
| 节点 2 | 分步解释；教师自行撰写准确、简短的韩文材料及中文说明 |
| 节点 3 | 与解释直接对应的可选韩文例子；不得夹带答案 key、学生资料或整本教材 |
| 可选节点 4–5 | 常见辨别点、总结；仅在现有 script node 类型/发布校验支持时使用 |
| 媒体/分段 | 按现有正式发布器填写必需视频/音频/segment 配置，不默认关闭校验 |
| 审核记录 | 负责人、审阅日期、教材权利、内容版本、预计可选片段位置；均待填写 |

模板不预置 fixture 句子或代替教学审核。目标是少量可解释片段；数量建议不是 Runtime/Policy 新约束。

## 6. Candidate Acceptance Checklist（现在均未整体验收）

- [ ] course、catalog lesson published；同一 tenant/课程关系真实，catalog unlock 受支持且未人为改变。
- [ ] textbook 和选定 version published；chapter published；module 位于该 version/chapter 并进入正式快照。
- [ ] teaching lesson published，与 module/profile 正确关联；profile published 且 feature 正确。
- [ ] script version published；目标 node 通过 published script 的学生安全读取路径可见。
- [ ] 正式 segment 中存在韩文音节/Jamo，源 locale、index、revision 稳定；不是 SQL aggregate 推断。
- [ ] 对获批 Pilot 身份，StudentTeachingPolicy PASS（app/feature、enrollment、tenant、resource 边界都检查）；本阶段不读取这些真实数据。
- [ ] 页面 server projection 生成有效 Selection Pins；只接受当前 revision，重发布后刷新，伪造/过期 Pin 拒绝。
- [ ] 正式 classroom 目标 lesson action 可见且绑定到正确 module/node；不能用旁路 probe 或人工构造 request 代替。
- [ ] 另行获批的端到端试验中，get_current_lesson_context 完成、evidence/output validation PASS、source present；无教学写入。

Selection 验证依据：[selection-projection.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/page-projection/selection-projection.ts)、[references.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/selection/references.ts)、[supabase-student-teaching-repository.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/repositories/supabase-student-teaching-repository.ts:55)。projector 有候选/locale/128 Pin 上限、单 segment 长度及 12 秒页面预算；不要上传整本正文证明可选。记录安全 revision、数量、拒绝原因与耗时即可。

## 7. 单 lesson 范围决定

korean-beginner 现在恰有 3 个 catalog lessons：hangul-introduction immediate；basic-pronunciation、daily-greetings prerequisite_passed。当前 0 eligible，**NOT PROVEN SINGLE ELIGIBLE LESSON**。

如果仅准备目标、冻结这 3 个 lesson 及 unlock/Policy，其他两个仍不受支持，则可证明“最多 1 个符合条件的 Agent lesson”；目标通过真实身份/Pin/UI 验收后才能签署 **PROVEN SINGLE ELIGIBLE LESSON**。不能提前把 0 写成 1。

当前 server rollout 只有 tenant ∩ course ∩ user，[rollout-policy.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/rollout-policy.ts)；浏览器隐藏其他入口不能缩小 API scope。暂不实现 lesson allowlist。启用前复核 course 全部子 lesson、发布状态、支持的 immediate/manual/scheduled 条件以及授权 Pins；每次新增/发布/改 unlock 都使单 lesson 证明失效。如无法冻结或出现第二个 eligible lesson，需要另行进行 Pilot Scope Hardening：server-only、stable lesson ID、default deny、与现有三名单相交；不得修改 StudentTeachingPolicy 来达成限制。

| 待批准内容 | 负责人 | 决定/日期 |
|---|---|---|
| 目标教学合理性、内容范围、权利 | Teaching Content Owner（待指定） | 待填写 |
| 从零 authoring 路径与目标 UI 集成任务 | Engineering Owner（待指定） | 待填写 |
| 单课程冻结与最终 eligible lesson 复核 | Release Operator + Teaching Content Owner | 待填写 |
