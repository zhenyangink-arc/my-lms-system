# TASK — 学习助手同口径数据核对（继续现有验收）

## Identity
TASK ID: ASSISTANT-LEARNING-DATA-LIVE-CHECK-02
STATUS: BLOCKED

## Routing
IMPLEMENTATION PROFILE: worker_medium for source resume; existing worker_high for browser observation.
ARCHITECT GATE: NOT_REQUIRED — no source/contract/auth/RLS modification.
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high, saved evidence only.
DISPATCH RECORD REQUIRED: YES
MODEL ROUTING REASON: finite source-to-UI/API trace and existing authenticated graphical browser observation; reuse completed discovery.

## Objective
核对顶部学习助手曾报告的教材节点、章节测评和待办数字，使用与该助手相同统计范围的当前本人可见数据；证据不足明确标记，不以不同口径首页卡片判对错。

## Context
用户要求我们自己操作现有 Chrome，上一轮已查看成长首页及我的成绩；最新“继续吧”授权继续同一普通验收。既有两次手动聊天基础功能通过；数据准确性未验证。旧学习记录工具调用被中断，无执行回执，当前页面未知。既有窗口位于正常用户 X11 display :11，window 0x02e00004，曾显示 PUFFY/chen；元数据仅为历史定位线索，动作前须确认当前窗口。既有 MCP Chrome 是另一未登录窗口，不重复登录/端口扫描。已完成的三份任务与私有报告为上游证据。

## Scope
WRITABLE SCOPE: Worker 仅新建 private /tmp/assistant-learning-live-check-*（目录0700，文件0600）；Supervisor 仅 Task 元数据。
READABLE DEPENDENCIES: AGENTS.md、角色手册、当前 Task、先前 acceptance/data/browser reports；仅与 guide-agent-progress、学习记录、只读教材/章节概览及其安全 GET endpoint 直接相关源码。
FORBIDDEN: 修改应用/source/tests/config/fixture/数据库；读取.env、密码、cookie/token/storage/profile、无关用户数据；直接SQL/生产连接串；安装/新调试端口/重启/杀浏览器；旧恢复/authority任务；提交/推送；新模型或聊天请求；课程开始、测评开始/提交、完成/成绩/内容/设置修改。

## Contracts
MAY CHANGE PUBLIC CONTRACT: NO。
普通当前用户浏览器导航和现有只读接口可用；不创建新API、不绕过鉴权、不调用管理接口或抓取凭据。源代码不能自动代表部署版本；历史回答与当前数据非同时快照时明确限制。

## Data / Security Impact
正常已登录本人 UI/只读页面查询；不导出认证信息，不修改 Auth/RLS。正常会话活动不可据此声称全部写入为0。

## Requirements
1. 源码 Worker先恢复进度、git状态和最小安全读取路径，不重复全库调查；如存在无模型的同口径GET，只报告明确路由/输出/只读证据，未经Supervisor确认不请求。
2. Browser Worker复用已有正常 X11授权和安装工具，先仅目标窗口截图确认当前状态；不得重新运行旧 records helper 盲点。新私有 helper可复用已审查有限GUI操作，不碰用户其他窗口。
3. 当前确认后最多一次学习记录左导航，保存窗口截图与退出码。页面如有当前本人章节历史可记录，不点课程/尝试/提交链接。必要只读列表滚动最多3次，坐标按当前截图确认。不得因看不到而展开全站巡检。
4. 当前Task初始不准同源API请求；若源码发现匹配接口，由Supervisor书面追加确切GET/允许字段。身份不符、出现登录表单或动作有写入风险则停并报告。
5. 数据不暴露无关明细；仅验收需用的有限本人字段私有保存。实际统计范围、取数限制、时间、来源分开记录，不能把历史事件条数冒充 retained attempt 数。
6. 0新增chat/model请求、0测试/构建；不更改原2次手动基础聊天结论。不可要求用户再次抄数字。

## Out of Scope
修复、全面安全认证、课程教学Agent认证、生产DB审计、部署和旧恢复管线。

## Acceptance Criteria
同口径值有当前已登录页面/已批准只读接口直接证据则对比；否则给精确缺口。观察与推断分列。不因为工具中断判网站失败。

## Required Validation
SOURCE: narrow read-only trace; E2E/BROWSER: scoped existing-window read.
TYPECHECK/LINT/UNIT/INTEGRATION/MIGRATION: NOT_REQUIRED; no suites.

## Risk Focus
错口径、未证明部署版本一致、误触进度写入、抓取凭据、旧截图盲点、重复已完成检查。

## Parallelism
源码映射和独占GUI仅在不竞争文件/可变资源时可并行。现有窗口同时仅一个Worker操作。

## Escalation Rule
缺少同口径可见读取口则报告限制，不私自读凭据或直接数据库。需扩大接口/动作时先向Supervisor提交明确scope。

## Worker Report
按 CODEX_WORKER.md，结果/证据/命令/计数/未知/下一最小步。

## Verification Report
按 CODEX_VERIFICATION.md，只审保存证据，不重复实际页面和聊天。


## Supervisor review — 2026-10-04

Verdict: PASS for the finite source trace and direct learning-records-page observation; original assistant learning-data accuracy remains UNDETERMINED / NOT VALIDATED. This task is BLOCKED only as to full same-grain numeric acceptance: no matching model-free current-user read-only surface was identified among the narrowly examined existing routes. Do not convert this limitation into an application failure or a claim that all possible endpoints have been inventoried.

Completed and not to repeat:
- Existing server Chrome was located through prior known X11 window metadata. First active-window capture showed the desktop; corrected capture verified actual active window and showed the platform grades URL and chen. No new login/port investigation was performed.
- One confirmed left-nav click opened the real /yuanzhi/apps/korean/records address. First capture showed loading; subsequent screenshot directly proved the page loaded and displayed learning-time and completed-lesson summaries. Limited personal values remain in private evidence, not copied here. These summaries do not have the same scope as stored textbook nodes, retained chapter-test correct/total counts, or pending assignments.
- The final scroll tool request remained pending and Supervisor interrupted it. Tool text was "aborted by user after353.1s", but this was not an independent user cancellation or a website failure. No execution handle/exit code/receipt/screenshot was returned for that scroll. Actual execution and final scroll count are UNKNOWN. No GUI retry occurred after STOP; final browser position is not verified. The earlier loaded snapshot remains valid.
- Source trace found guide context's existing caller is agent-chat POST, which writes chat records and calls a model. It is not a read-only numeric verification endpoint. Normal assignments GET can release due grades and was excluded. No new API, direct database access or credential extraction was used.

Source Worker actual assignment: worker_medium / GPT-6.1 Sol medium (its initial private report routing typo was corrected before acceptance). Browser Worker: worker_high / GPT-6.1 Sol high. Independent verifier: verifier / GPT-6.1 Sol high. Supervisor read actual reports and sampled actual saved screenshots; verifier performed evidence-only review, not a second live run.

Current finite-work counters: new chat/model prompts0; test suites/builds0; direct API/DB calls0; intentional learning/grade/course/settings actions0; application/source/test/config/service changes by this task0. Four saved screenshot files; one confirmed menu navigation; scroll execution UNKNOWN. Normal UI/session bookkeeping was not audited, so total server writes must not be claimed zero. Supervisor task metadata and private evidence are the only authored changes.

Remaining evidence: original reported smart-node count/mean, pooled chapter-attempt counts/correct/total, recent-lesson ordering, and pending-assignment summary lack matching live evidence. Current observation is later than the original response; exact account login ID and deployed-source parity were not independently established. Prior two manually submitted basic-chat cases remain PASS within that scope, unchanged.

Next minimum decision: define a separately scoped, authorized, read-only verification method for the current learner's matching source records before any further numeric acceptance. Do not build a new public API, read credentials, query production DB, reopen old recovery tasks, or claim numeric PASS under this task. Existing pages/source investigation is exhausted for the agreed finite scope; do not ask the user to copy the same cards or log in again.

Evidence bindings:
- /tmp/assistant-data-acceptance-resume-tzbppta3/WorkerReport.md — SHA256 5e25c581483e42ecb78e75bcbe63401e61fe2bc83c94d542df963b16c6910241
- /tmp/assistant-learning-live-check-20261004/WorkerReport.md — SHA256 1186df1fc58ef99799dbcba7122e77c0f648270bf76fc3d4e043c38ddecc68c0
- /tmp/assistant-learning-live-review-akngth7y/VerificationReport.md — SHA256 0a4298c0ec0fba3b93d89a9ff92e119005e2a98a9bc8499a3141e23841de7fee


## Supervisor Administrative Closeout — 2026-10-04
ARCHIVE_STATUS: CLOSED_WITH_LINKED_FOLLOWUP
SUPERVISOR REVIEW: PASS for administrative closeout only; all earlier execution verdicts and evidence bindings remain unchanged.
Original-prefix SHA256: e8dd90f84ab2edbcd6faf9dd21e7b814992ce24af36c3539713dd993375a94f0

原 UI/source 调查及数值证据缺口保持原结果。匹配口径的当前节点、章节测评和待办统计由 ASSISTANT-STATS-READONLY-CHECK-04.md 完成一次核对 PASS；原 UI 本身不因此变成同口径数值证明。近期课时排序、历史回答时点及部署一致性仍 NOT VALIDATED。

后续证据均位于本目录 completed Task04/06。当前顶部学习助手有限验收无必要剩余运行；保留所有 NOT VALIDATED 限界，不切换至单句 Explain 或历史恢复/authority 项目。
