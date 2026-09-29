# Stage 1F-R6B — Teaching Script Draft Creation & Validation

## 1 Executive Summary

**Overall: GO。Teaching Script Draft: CREATED。Script Authoring Status: READY FOR SCRIPT NODE AUTHORING。**

使用用户本人已正常登录的现有Chrome，在 **韩文字母入门 / 第0章 / 课前导航** 精确上下文点击一次“新建教学脚本”。官方workflow成功创建 **1条 Script Version（version1、draft）+ 1条 create_draft 审计记录**。UPDATE0、DELETE0、教学节点0、Publish0、Runtime0。

当前模型没有独立Script根表；脚本以Teaching Lesson下的版本记录表示。UI没有名称/描述/语言/版本名/alias输入，初始title为 `{}`。**“韩文字母入门 · 课前导航”与 `hangul-introduction-prelesson` 是本报告逻辑名称/alias，未伪称写入数据库。**

新版本关联正确，R6A完整canonical行及objectives hash不变、无重复内容。Feature OFF、allowlists EMPTY、Agent五表0、Provider0、Pins0。Chrome停在“新增小节”之前且保持打开。**未进入R6C；Stage1G NOT READY。**

## 2 Scope

采用DEVELOPMENT-FIRST / NEW AUTHORING CONTENT IS CANONICAL。R6A canonical `hangul-introduction` 保持不变，不重新创建教材/版本/章节/module/Teaching Lesson。

用户按第13节明确批准：“批准这一次精确创建”。范围为通过正式UI创建初始draft版本及官方审计日志，不包括节点、Publish、运行、Provider、Agent、Pins、definition、Feature/allowlists、Auth或基础设施变更。

实际content writes为NONZERO，不能记为Production Writes0。精确变化及授权见 [authorization-scope.json](evidence/teaching-agent-stage-1f-r6b/authorization-scope.json)、[creation-result.json](evidence/teaching-agent-stage-1f-r6b/creation-result.json)。

## 3 Auth / Browser Boundary

CDP `http://127.0.0.1:9222`；Playwright Core为用户提供路径；复用原Chrome及原Profile，没有启动新Chrome、重新登录或关闭浏览器。

正常同源own-profile GET确认角色为平台负责人；在浏览器内散列账号标识，再与R6A已绑定本人身份比对。未读取/导出Cookie、JWT、密码、Authorization Header或Session Token；没有magic link、Auth写入、service-role impersonation或选择其它owner。

开始时Chrome位于教材制作页。经官方导航进入Script Studio，再用章节下拉和GET“定位章节”，严格匹配R6A chapter hash。首次只选择下拉后的导航等待超时，是GET表单尚未提交；随后按实际UI点击“定位章节”，没有内容写入重试。

创建前再次确认正常会话、form lesson hash、chapter URL hash及目标标题，批准后才点击。见 [target-context.json](evidence/teaching-agent-stage-1f-r6b/target-context.json)、[ui-fields.json](evidence/teaching-agent-stage-1f-r6b/ui-fields.json)、[ui-create-result.json](evidence/teaching-agent-stage-1f-r6b/ui-create-result.json)。

## 4 Production Preflight

提交前与最终只读检查一致：

| 项目 | 结果 |
|---|---|
| PostgreSQL / ledger / latest | 17.6 / 457 / 202609140007 |
| Build | 6IhDHN8Dm1nCewiCEZnV5 |
| PM2 | online；PID 934715；restart count 0 |
| Feature / allowlists | OFF / EMPTY |
| Agent five tables | each0 |
| R6A canonical chain / Teaching Lesson | 1 / 1 |
| Script versions / nodes before creation | 0 / 0 |
| Active inconsistent dependency fences | 0 |
| Runtime / launcher / Tailscale | UNCHANGED |

持久candidate SHA与锁定值一致；1394个部署文件逐个匹配artifact，编译产物存在真实创建action/RPC引用。当前DB RPC函数正文与202608310001最终定义一致，catalog已核对列、默认值、唯一约束/索引、触发器、owner/security definer/search_path/execute权限。

证据：[preflight.json](evidence/teaching-agent-stage-1f-r6b/preflight.json)、[approved-pre-submit-check.json](evidence/teaching-agent-stage-1f-r6b/approved-pre-submit-check.json)、[running-build-contract.json](evidence/teaching-agent-stage-1f-r6b/running-build-contract.json)、[database-contract.json](evidence/teaching-agent-stage-1f-r6b/database-contract.json)。

## 5 Target Context

Target：**韩文字母入门 / 第0章 / 课前导航**。

- Content alias：`hangul-introduction`。
- Script logical alias：`hangul-introduction-prelesson`。
- Chapter SHA：`5672961a0fc8222118a1071b0446c45c609ad320bf42983e25f3b1189d7c9f0d`。
- Teaching Lesson SHA：`870d1e4c70d884294d31fa8da3cb62d5ecadb2d050b4056c03c9ce47525497c3`。
- Actual Script Version SHA：`dd808c0ed6d816809f0a527523473c1da4021f2ece369d82efa902312ed860a8`。

创建form绑定精确Teaching Lesson，不根据“相近课时”或首个module选择。新版本结果与UI隐藏version_id的散列一致；资源UUID未输出到报告。

## 6 Duplicate Audit

创建前：逻辑Script0、Script Version0、Node0、目标日志0。创建后：逻辑Script1、Script Version1、Node0、create_draft日志1，没有其它目标日志action，无重复版本。

逻辑Script count按该Teaching Lesson是否存在脚本版本计算；数据库没有独立Script根，不额外创建虚构根对象。RPC锁Teaching Lesson，若已有draft则返回；数据库one_draft索引及lesson/version唯一约束继续启用。见 [duplicate-check.json](evidence/teaching-agent-stage-1f-r6b/duplicate-check.json)、[post-create-observation.json](evidence/teaching-agent-stage-1f-r6b/post-create-observation.json)。

## 7 Script Studio Workflow

真实调用链：

1. `src/app/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/page.tsx` 解析chapter；`page-content.tsx` 精确限制对应module。
2. `src/features/learning-agent-script-studio/service.ts` 经Platform Owner鉴权读取教材链与脚本版本，默认优先draft。
3. `TeachingScriptStudio.tsx:634` 的“新建教学脚本”为直接submit；没有预创建弹窗。业务表单只有hidden `lesson_id` / `return_to`，没有命名、描述、语言、版本名或alias输入。
4. `src/app/dashboard/admin/teaching-scripts/actions.ts:252` 执行requirePlatformOwner及UUID校验，使用当前用户Supabase client调用 `create_learning_agent_script_draft`。
5. RPC再次auth.uid/is_platform_owner校验；锁Teaching Lesson，检查已有draft，计算max(version_number)+1；同事务插入draft版本和create_draft日志。首次无published来源，title默认空对象，不复制节点或audio。
6. Action的published-secret复制与node video补配置仅处理已有来源/节点；本目标均0，因此没有这些写入。
7. revalidate后Studio显示“脚本版本 1 · 草稿”“0 个教学小节”和“新增小节”。

现有authoring lock及dependency fence继续生效，未绕过保护。创建合同没有独立客户端CAS字段，不将节点保存的updated_at CAS误称为创建输入。源码对应当前已部署Build及安装RPC，见 [database-contract.json](evidence/teaching-agent-stage-1f-r6b/database-contract.json)、[running-build-contract.json](evidence/teaching-agent-stage-1f-r6b/running-build-contract.json)。

## 8 Draft Creation

**PASS。** 用户明确批准后只执行一个logical create attempt：

| 字段 | 结果 |
|---|---|
| Click start UTC | 2026-09-16T07:11:49.270Z |
| DB created_at UTC | 2026-09-16T07:11:49.544966+00:00 |
| Script Version INSERT | 1 |
| create_draft audit INSERT | 1 |
| UPDATE / DELETE | 0 / 0 |
| Logical create attempts / blind retries | 1 / 0 |
| UI result | SUCCESS_VISIBLE |
| Independent DB verification | PASS |

UI结果和新READ ONLY查询互相确认；created_by与日志actor匹配当前本人正常会话身份，日志关联同一版本，sourceVersionId为null。没有手工INSERT、补名称或重试。

一次性attempt guard保持发起时UNKNOWN状态用于防重复；最终状态以 `ui-create-result` 和独立DB验证为准，未发生不明确提交。见 [creation-result.json](evidence/teaching-agent-stage-1f-r6b/creation-result.json)、[ui-create-result.json](evidence/teaching-agent-stage-1f-r6b/ui-create-result.json)、[script-structure.json](evidence/teaching-agent-stage-1f-r6b/script-structure.json)。

## 9 Script Version

实际版本1，status=draft，title={}，change_note为空，published_at/published_by均null。版本数恰好1。

正式UI没有名称输入，所以没有将建议名称“韩文字母入门 · 课前导航”或“初始草稿”补写进DB；logical alias不伪装为数据库slug。实际identifier只保留安全hash。当前UI显示上下文“课前导航”和“脚本版本 1 · 草稿”。见 [script-version.json](evidence/teaching-agent-stage-1f-r6b/script-version.json)。

## 10 Script Node Boundary

**Node count0 / Node writes0。** 官方首次创建没有自动root/default节点；没有点击“新增小节”、填写教学台词、自动保存或保存正文。当前无节点编辑表单被提交。见 [script-node-boundary.json](evidence/teaching-agent-stage-1f-r6b/script-node-boundary.json)、[ui-handoff.json](evidence/teaching-agent-stage-1f-r6b/ui-handoff.json)。

## 11 Canonical Relationship

新版本 `lesson_id` 的hash精确对应R6A Teaching Lesson。原链：Teaching Lesson → orientation Module → chapter0/preparation → textbook version1 → Textbook → 既有catalog lesson/course/app。

R6A六类对象（含catalog lesson）的全行内容仅在DB内聚合散列，前后hash相同，覆盖关联、status、revision和四条objectives；所以没有重复或替换教材/章节/module/lesson，原app/tenant边界不变。其它目标之外11类authoring/catalog元数据hash亦一致。

见 [canonical-content-diff.json](evidence/teaching-agent-stage-1f-r6b/canonical-content-diff.json)、[unrelated-content-diff.json](evidence/teaching-agent-stage-1f-r6b/unrelated-content-diff.json)。没有导出教材正文或学生数据。

## 12 Publication Boundary

Script及唯一初始版本为DRAFT；published_at/by为空。create_draft日志属于审计记录，**不等于Publish**。目标publish日志0，发布操作0，Runtime/Preview执行0。

原R6A教材/版本/章节/Teaching Lesson保持Draft，未做student-visible或runtime-live启用。见 [draft-status.json](evidence/teaching-agent-stage-1f-r6b/draft-status.json)。

## 13 Agent / Provider Boundary

Feature OFF，tenant/course/user三allowlists EMPTY；Agent五表各0、Agent Runs0、Provider Requests0、Pins0、Definition publication0、Auth writes0。Provider0为本任务范围，不代表供应商全账户流量审计。

没有通过Agent POST或Provider smoke test验证。没有reconciler、persistent cancel、First Enable或Stage1G。见 [agent-provider-boundary.json](evidence/teaching-agent-stage-1f-r6b/agent-provider-boundary.json)。

## 14 Production End-State

最终只读时间：2026-09-16T07:12:51.236795+00:00。Ledger457/latest140007、批准Build、PM2 online不变。Foundation schema摘要、runtime、launcher、Tailscale未变；无migration/deploy/PM2/config/Auth写入。

授权实际写入：**script_versions INSERT1 + create_draft日志 INSERT1**。Unauthorized writes0、Teaching Node writes0、Publish writes0。Chrome保持在正确脚本Draft上下文，“新增小节”可见但未点击。

见 [production-end-state.json](evidence/teaching-agent-stage-1f-r6b/production-end-state.json)、[ui-handoff.json](evidence/teaching-agent-stage-1f-r6b/ui-handoff.json)。

## 15 Gate Matrix

| Gate | Name | Status | Evidence scope |
|---|---|---|---|
| G-R6B-1 | Foundation Ready | PASS | Verified in final read-only evidence |
| G-R6B-2 | R6A Canonical Content Ready | PASS | Verified in final read-only evidence |
| G-R6B-3 | Authenticated Platform Owner | PASS | Verified in final read-only evidence |
| G-R6B-4 | Target Context Exact | PASS | Verified in final read-only evidence |
| G-R6B-5 | Duplicate Script Audit | PASS | Before0; after exactly1 initial draft version; no independent Script root table |
| G-R6B-6 | Official Script Studio Workflow | PASS | Existing authenticated Chrome -> action -> installed official RPC |
| G-R6B-7 | Single Create Attempt | PASS | Exactly one click/logical attempt; no retry |
| G-R6B-8 | Teaching Script Created | PASS | Logical Script represented by version1; no fabricated root row |
| G-R6B-9 | Teaching Lesson Association | PASS | Version FK matches exact R6A Teaching Lesson hash |
| G-R6B-10 | Module Association | PASS | Existing module parent hash and row unchanged |
| G-R6B-11 | Chapter Context | PASS | Chapter0 hash matches browser context and R6A |
| G-R6B-12 | Script Draft State | PASS | status draft; published_at/by null |
| G-R6B-13 | Initial Version Contract | PASS | Version1 draft, title={}, change_note empty; official UI has no naming field |
| G-R6B-14 | Script Node Boundary | PASS | Nodes0; no automatic root/default node |
| G-R6B-15 | No Teaching Node Authoring | PASS | Verified in final read-only evidence |
| G-R6B-16 | No Publish | PASS | Verified in final read-only evidence |
| G-R6B-17 | Canonical R6A Content Unchanged | PASS | Whole canonical row hashes including objectives unchanged |
| G-R6B-18 | Feature OFF | PASS | Verified in final read-only evidence |
| G-R6B-19 | Allowlists EMPTY | PASS | Verified in final read-only evidence |
| G-R6B-20 | Agent Rows Zero | PASS | Verified in final read-only evidence |
| G-R6B-21 | Provider Zero | PASS | Verified in final read-only evidence |
| G-R6B-22 | Pins Zero | PASS | Verified in final read-only evidence |
| G-R6B-23 | Definition Publication Zero | PASS | Verified in final read-only evidence |
| G-R6B-24 | Auth Writes Zero | PASS | Verified in final read-only evidence |
| G-R6B-25 | Runtime Unchanged | PASS | Verified in final read-only evidence |
| G-R6B-26 | Tailscale Unchanged | PASS | Verified in final read-only evidence |
| G-R6B-27 | Receipt Boundary | PASS | Safe hashes/status only; no raw resource UUID/session credentials |

证据为本次源码、实际DOM和独立只读DB观察。JSON、helper语法、敏感信息扫描、文件范围及git diff --check见 [workspace-scope.json](evidence/teaching-agent-stage-1f-r6b/workspace-scope.json)。只新增/更新R6B报告和证据，R6A及其它历史记录不改写。

## 16 Next Stage

**READY FOR SCRIPT NODE AUTHORING**。候选下一阶段为 **R6C — TEACHING SCRIPT NODE AUTHORING**，本任务未开始。Stage1G仍NOT READY；Feature OFF、allowlists EMPTY继续保持。

## 17 Final Recommendation

R6B签署 **GO**：唯一官方初始Draft版本及审计记录已建立，父链、零节点、未发布和基础设施边界通过验证。当前官方合同没有自定义脚本名称输入，保留实际title={}，不为匹配建议名称新增写入。

停止在“新增小节”按钮之前。没有节点authoring、Publish、Runtime、Provider、Pins、Feature/allowlist变更，未进入R6C或Stage1G。
