# UPLY Teaching Agent — Stage 1F-R3B Pilot Readiness

## 1. Executive Summary

**Overall: CONDITIONAL PREPARATION COMPLETE。Production Pilot BLOCKED；Stage 1G NOT READY。**

真实 Candidate 仍为 **0**。推荐准备 korean-beginner / **hangul-introduction（预备课：韩文字母入门）**：已 published/immediate、有现成字母学习界面、教学位置合理，无需改 unlock。但它没有数据库教学内容链，当前页面也未接 Agent 选句动作；正式从零 authoring 骨架工作流尚未从源码确认。因此 Pilot Content Preparation 标 **PARTIAL**，不能用文档完成声称可发布。

Tailscale 独立端口测试及 Provider 字段政策的审批请求、角色/值守/监控方案均已准备；没有实际批准、没有执行 Tailscale 变更。R3A 的 Drain PASS 保持，产品/迁移/历史文档未改。Production ledger449、Agent tables0、flagOFF、allowlistsEMPTY，本任务 production writes0/live Provider0。

## 2. Current R3/R3A State

已完整阅读 Stage1F、R1、R1B、R2、R2A、R3、R3A 的阶段报告，重新追查 R3 inventory/ops 与 R3A contract/candidate。历史报告是历史验证证据；当前生产内容由本轮 READ ONLY metadata 确认，不能用 synthetic 数据替代。

[teaching-agent-stage-1f-r3-production-operations-gate.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r3-production-operations-gate.md) 原 G-R3-21 FAIL 保留；[teaching-agent-stage-1f-r3a-run-reconciliation.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r3a-run-reconciliation.md) 34/34 Gate PASS、两例真实强杀收敛、零 late Provider/Tool/教学写入证明关闭该项，**只针对 reconciliation，不代表 Pilot GO**。

本轮不重跑大型 Full Supabase / 1135+199：1303项 release inputs、7份迁移、baseline、R3A运维脚本与固定候选 archive 全部 hash 匹配。做了新 production-mode 隔离构建（90.58s，1376 files，exit0）、tsc、scoped lint、17项迁移/rollout静态测试、18项实际隔离 PostgreSQL reconciler assertions。未发现需改产品的回归。

## 3. Files Changed

仅新增本阶段文件；保留任务开始已有工作区修改，不提交、不清理旧文件。

| 新增文件/目录 | 用途 |
|---|---|
| [teaching-agent-stage-1f-r3b-pilot-readiness.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r3b-pilot-readiness.md) | 本报告与 Gate 汇总 |
| [teaching-agent-pilot-content-preparation.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-pilot-content-preparation.md) | 全17项评分、目标、正式内容流程缺口、验收/单lesson决定 |
| [teaching-agent-tailscale-verification-request.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-tailscale-verification-request.md) | 精确临时绑定批准请求与撤销/测试计划 |
| [teaching-agent-provider-policy-approval.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-provider-policy-approval.md) | 实际Provider字段、排除项、风险、10项问题/批准模板 |
| [teaching-agent-pilot-operations-roles.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-pilot-operations-roles.md) | 执行模式比较、角色/值守/监控 |
| [production-inventory.sql](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3b/production-inventory.sql) | 只读课程对象metadata聚合，无学生表 |
| [targeted-reconcile.mjs](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3b/targeted-reconcile.mjs) | 隔离network-none数据库定向验证，fixture setup不声称零写 |
| [verify-build.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3b/verify-build.py) | 私有副本production构建，public配置一致，无服务部署 |
| docs/evidence/teaching-agent-stage-1f-r3b/ | 本轮脱敏inventory、完整性、构建、验证、安全、scope证据 |

最终 scope 检查见 [workspace-scope.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3b/workspace-scope.json)。脚本是本轮验证工具，不是生产修改或 authoring 绕行工具。

## 4. Real Course Inventory

生产通过 TLS + READ ONLY 事务读取 catalog/teaching metadata。[course-inventory.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3b/course-inventory.json) 记录观察时间、ID、slug、状态与计数；不含学生数据或教材正文。

| 范围 | 当前结果 |
|---|---|
| Korean courses | 5：beginner/intermediate/advanced/life-essentials/TOPIK-I，均published/immediate |
| Catalog lessons | 19 published；17 immediate + 2 prerequisite_passed |
| 17 immediate内容链 | 所有textbook/version/chapter/module/teachinglesson/关联profile/script/node均0，草稿也0 |
| 唯一有发布脚本链的lesson | basic-pronunciation：1教材/1published version/17chapters/132modules/132teachinglessons/1published script/8nodes |
| 该lesson限制 | prerequisite_passed，不受当前StudentPolicy支持 |
| Korean-containing nodes | 上述published链8个；不等于实际segments/pins |
| Real Pilot Candidate | **0**，必要条件已否定，无需查看实际enrollment/progress |

没有改 prerequisite_passed/prerequisite_completed/previous_completed 的不支持边界。

## 5. Pilot Content Target

**korean-beginner / hangul-introduction**，course ID `2f79a679-6e25-4cf9-9f71-455905584787`，lesson ID `6ad20a2b-2306-4173-9d3f-73eb9691ff58`。教学合理性与已有 HangulInteractiveBook 是选择依据，成本 Unknown，不宣称工时最少。全部17 immediate评分与来源在内容包第2节。

source：[page-content.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page-content.tsx:735)。目标现有课堂内容可复用，但没有 `loadStudentTeachingSlots`；不能把普通学习UI当成已支持Agent。

## 6. Pilot Content Preparation Package

完整包：[teaching-agent-pilot-content-preparation.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-pilot-content-preparation.md)。

需正式建立 textbook/version/chapter/module、正确profile关联的teachinglesson、发布script/nodes、真实韩文segments和objectives。可审核复用已有 `uply-korean-teacher` Script profile，不与 Agent Core definition 混淆。现有 Studio 仅加载已有骨架；稿件创建/节点保存/校验发布、教材章节快照发布已确认，**完整从零创建入口 Unknown**。必须先由工程/教学责任方确认正式路径，不输出生产 SQL 或 bypass脚本。

未来 Candidate Checklist 包含所有父级published/关联、StudentPolicy、server Pins、正式action、Tool evidence/output/source；模块和节点的“发布”遵循父快照/script语义，不要求不存在的status字段。内容模板仅给结构与审核项，不复制fixture/全教材，不自动发布。

## 7. Single-Lesson Scope

当前三名单没有lesson。目标course恰有3lesson，其中只有目标immediate，另2个prerequisite_passed。现在eligible0：**NOT PROVEN SINGLE ELIGIBLE LESSON**。

决定：暂不实现lessonallowlist；冻结course3lesson/解锁/Policy且仅准备目标可得“最多1”上界，真实目标验收后再签“恰好1”。新增lesson、支持的解锁或内容发布变化会使证明失效。若无法冻结或出现第二个eligible，另行提出server-only stablelessonID/defaultdeny/与tenant-course-user相交的rollout tightening；不更改StudentTeachingPolicy。

## 8. Tailscale Verification Requirements

Actual Tailscale四项仍BLOCKED：NDJSON streaming、Origin/Host/Scheme、Compression/Buffering、Disconnect。只读确认UPLY 8443→3000，daemon1.102.2。拟9443→43183独立Next production probe，三帧约0/200/400ms，身份/压缩与浏览器/curl交叉采样，保留server/client时间；Origin沿用实际validator逻辑、正负向验证；首帧后断连确认abort/cancel、清理timer。无真实Agent/Provider/Supabase/cookie。

## 9. Tailscale Operational Approval Request

[teaching-agent-tailscale-verification-request.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-tailscale-verification-request.md) 明确独立端口/path、≤30分钟绑定窗口、≤10分钟采样目标、获批客户端、已有binding不变、add→验证→remove→配置前后完全比较的runbook。9443/43183目前无listener，未来执行仍需复查。

**批准REQUIRED，未创建binding/未执行probe。** 只移除自己新增的9443，不使用reset，不覆盖他人并发修改。隔离probe不能代替真实课堂Auth/Policy验收，需记录与8443配置差异后才判断可关闭哪些技术Gate。

## 10. Provider Data Flow

真实adapter：DeepSeek / deepseek-v4-flash / HTTPS chat completions / thinking disabled / tool schemas+stream usage。System（base/role/Kim/Skill/constraints）+opaque verified selection+question → model选择Lesson Tool → safe lesson/evidence projection →后续模型。optional saved-state projection仅在授权session绑定时，当前UI未保证此路径。

不注入结构化学生姓名/email/rawtenant/studentUUID/其他学生/全progress/成绩/rawnode/answerkey/全教材/JWT/Cookie/DBcredentials。API服务认证必须使用Provider凭证；它不进Prompt/Tool/日志，不能写成“Provider认证接口完全收不到secret”。自由文本可能含个人信息，refs可关联，不能声称法律匿名。

## 11. Provider Policy Approval Package

[teaching-agent-provider-policy-approval.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-provider-policy-approval.md) 含完整字段、长度/入口限制、排除项、数据风险、10项政策问题和签署模板。retention、training、region/cross-border、DPA、告知要求均Unknown/待责任方确认。Approval owner/date/scope/expiry/revocation未伪造。

**BLOCKED / APPROVAL REQUIRED**；未确认批准人，不以代码或测试代签。

## 12. Reconciler Operations

[teaching-agent-pilot-operations-roles.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-pilot-operations-roles.md) 比较部署手动、人工周期、scheduler、monitor-triggered四种模式。Wave1建议pre/post每Run检查 + deployment显式drain + 有人值守窗口内每5分钟人工safety sweep。依据45s deadline+6s grace及低并发单用户，不是高频自动job或SLA。

Incident/Release Operator使用R3A有界一次性命令、明确tenant，检查COMMIT receipt、再查全部active；future/terminal均不改，只收敛eligible orphan。无scheduler安装。运行安排提案已明确，执行人/备班未落实。

## 13. Operator Roles

Release Operator、Pilot Operator、Incident Operator、Data/Policy Approver、Teaching Content Owner均有任务、签署边界、备班/联系方式/窗口空白模板；Engineering Owner协助确认from-zero authoring/UI缺口。**角色定义PASS，实际人员分配BLOCKED**。普通平台管理员JWT没有reconciler权限；infra凭证不等于全tenant人工授权。

## 14. Pilot Monitoring Checklist

每Run检查status、tool.completed、evidence/output pass、source、modelCallId级usage、duration、terminal reason、active/expired/eligible、无orphan/无教学写入。model.started无usage必须UNKNOWN，不填0 tokens/cost。

Selection未持久计时，计划冷/暖页面手工smoke各5样本，区分页面action到达总耗时与server projection耗时，不虚构生产p95。已有运维SQL与receipt用于安全字段记录；未观测项写Unknown，重复异常暂停。值守未填写，故原Monitoring Gate仍PARTIAL。

## 15. Updated R3 Gate Matrix

这是新评估，不改历史R3报告。PASS中注明沿用者表示同一源码/固定候选的既有证据，不表示本阶段重跑或生产启用。

| Gate | 名称 | 当前状态 | 依据/范围 |
|---|---|---|---|
| G-R3-1 | Real Course Inventory | PASS | R3B READ ONLY：5 courses / 19 lessons，详见本轮 inventory |
| G-R3-2 | Policy-Compatible Pilot Candidate | FAIL | 真实必要内容条件不成立；0 Candidate，17 immediate 全部无内容链 |
| G-R3-3 | Published Script Coverage | FAIL | 真实必要内容条件不成立；0 Candidate，17 immediate 全部无内容链 |
| G-R3-4 | Real Pilot Selection Pin Feasibility | BLOCKED | 真实内容/授权 Pins 不成立，不读取学生数据强行测试 |
| G-R3-5 | Formal Classroom Synthetic Route | PASS | 沿用 R3/R3A 同源码的历史验证，本阶段未重跑该完整场景 |
| G-R3-6 | Formal Classroom Regression | PASS | 沿用 R3/R3A 同源码的历史验证，本阶段未重跑该完整场景 |
| G-R3-7 | Actual Tailscale Path Identified | PASS | 当前只读 Serve status：8443→3000，配置未变 |
| G-R3-8 | Actual Tailscale Streaming | BLOCKED | 独立 binding 审批包已准备；未批准、未实测 |
| G-R3-9 | Origin / Host / Scheme | BLOCKED | 独立 binding 审批包已准备；未批准、未实测 |
| G-R3-10 | Compression / Buffering | BLOCKED | 独立 binding 审批包已准备；未批准、未实测 |
| G-R3-11 | Disconnect Behavior | BLOCKED | 独立 binding 审批包已准备；未批准、未实测 |
| G-R3-12 | Migration Inventory Locked | PASS | R3A 7份迁移 SHA 全匹配；本轮静态 inventory PASS |
| G-R3-13 | Target Schema Migration Rehearsal | PASS | 沿用 R3A 包含006的 rehearsal/definition证据；hash未变，无生产应用 |
| G-R3-14 | Ordered Migration Verification | PASS | 沿用 R3A 包含006的 rehearsal/definition证据；hash未变，无生产应用 |
| G-R3-15 | Migration Failure Stop | PASS | 沿用 R3A 包含006的 rehearsal/definition证据；hash未变，无生产应用 |
| G-R3-16 | Definition Publication Rehearsal | PASS | 沿用 R3A 包含006的 rehearsal/definition证据；hash未变，无生产应用 |
| G-R3-17 | Exact Production Build Artifact | PASS | R3A固定原始候选仍有效；R3B另做90.58s验证构建，非部署 |
| G-R3-18 | Release Candidate Manifest | PASS | R3A manifest / 1303 inputs / archive SHA实测匹配，未替换 |
| G-R3-19 | Kill New Admission | PASS | 沿用 R3/R3A 同源码的历史验证，本阶段未重跑该完整场景 |
| G-R3-20 | Existing Run Recovery While OFF | PASS | 沿用 R3/R3A 同源码的历史验证，本阶段未重跑该完整场景 |
| G-R3-21 | Drain Procedure | PASS | R3A 两例强杀闭环 + R3B 18项定向DB验证；旧R3 FAIL记录不改 |
| G-R3-22 | Application Rollback Exercise | PASS | 沿用 R3/R3A 同源码的历史验证，本阶段未重跑该完整场景 |
| G-R3-23 | Agent Data Preservation | PASS | 沿用 R3/R3A 同源码的历史验证，本阶段未重跑该完整场景 |
| G-R3-24 | Operator Run Lookup | PASS | 沿用 R3/R3A 同源码的历史验证，本阶段未重跑该完整场景 |
| G-R3-25 | Monitoring Signals | PARTIAL | checklist/5分钟人工方案已准备；selection未持久计时，值守人未填写 |
| G-R3-26 | Stop Conditions | PASS | 沿用 R3/R3A 同源码的历史验证，本阶段未重跑该完整场景 |
| G-R3-27 | Provider Data Minimization | PASS | R3B重新追到实际Prompt/Tool/adapter白名单，认证用途例外明确 |
| G-R3-28 | Provider Policy Approval | BLOCKED | 数据范围模板齐备，无实际组织批准 |
| G-R3-29 | RLS Security Regression | PASS | 沿用R3A真实JWT/RLS验证；本轮另测anon/authenticated reconciler拒绝 |
| G-R3-30 | Teaching Domain Zero Writes | PASS | R3A79表历史指纹；R3B23表定向fixture运行前后hash一致（setup单列） |
| G-R3-31 | Production Ledger Unchanged | PASS | 本轮READ ONLY 449→449，完整ledger metadata相同 |
| G-R3-32 | Production Writes Zero | PASS | 本任务production writes=0，非全站其他活动断言 |
| G-R3-33 | Production Feature Flag OFF | PASS | runtime config OFF/三名单EMPTY，hash/PM2与R3A及本轮核对相同 |
| G-R3-34 | Pilot Allowlist Plan | PARTIAL | 当前eligible=0；冻结三lesson后至多1，实际单lesson证明待验收 |
| G-R3-35 | First Enable Runbook | PASS | 沿用 R3/R3A 同源码的历史验证，本阶段未重跑该完整场景 |

本轮R3B准备Gate：19 PASS / 1 PARTIAL。文档/角色定义PASS不消除下节外部BLOCKED项。

| Gate | 名称 | 状态 | 依据/限制 |
|---|---|---|---|
| G-R3B-1 | Real Course Inventory Refreshed | PASS | 本轮只读元数据证据 |
| G-R3B-2 | Best Pilot Content Target Identified | PASS | 全部17 immediate评分；hangul-introduction |
| G-R3B-3 | No Unauthorized Course Mutation | PASS | 无课程/解锁写入 |
| G-R3B-4 | Pilot Content Preparation Complete | PARTIAL | 准备文档完整；从零authoring路径和目标课堂入口尚缺 |
| G-R3B-5 | Single-Lesson Scope Decision | PASS | 条件性最多1；明确未证明实际1，不实施新allowlist |
| G-R3B-6 | Tailscale Test Plan Complete | PASS | 隔离9443/43183，三类probe、压缩、撤销验收 |
| G-R3B-7 | Tailscale Approval Request Complete | PASS | 精确临时binding/窗口/责任模板，实际批准未取得 |
| G-R3B-8 | No Tailscale Mutation | PASS | 只读status前后一致 |
| G-R3B-9 | Provider Data Flow Complete | PASS | 实际prompt/tool/adapter字段与认证例外 |
| G-R3B-10 | Provider Policy Questions Complete | PASS | 10项待回答 |
| G-R3B-11 | Approval Record Template Complete | PASS | 字段/撤回/期限模板，空白审批信息 |
| G-R3B-12 | No Fake Policy Approval | PASS | 明确BLOCKED/APPROVAL REQUIRED |
| G-R3B-13 | Reconciler Operations Plan | PASS | pre/post+drain+5分钟人工提案；无scheduler |
| G-R3B-14 | Operator Roles Defined | PASS | 角色已定义；实际姓名/备班仍未指定 |
| G-R3B-15 | Wave1 Monitoring Checklist | PASS | 逐Run/checklist；missing usage UNKNOWN |
| G-R3B-16 | Updated R3 Gate Matrix | PASS | 35项新评估，原R3不改 |
| G-R3B-17 | Production Ledger Unchanged | PASS | 449→449 exact |
| G-R3B-18 | Production Writes Zero | PASS | 本任务0 |
| G-R3B-19 | Production Flag OFF | PASS | OFF/三名单EMPTY/Agent表0 |
| G-R3B-20 | Live Provider Zero | PASS | 无真实请求；测试使用fixture |

## 16. Remaining External Approvals

| 所需闭环 | 责任方 | 当前状态 |
|---|---|---|
| 内容/权利/正式创建发布、目标UI任务 | Teaching Content Owner + Engineering Owner | 未指定/未批准/未执行 |
| actual Tailscale隔离binding与采样 | 基础设施责任方 + Release Operator | APPROVAL REQUIRED |
| DeepSeek字段/跨境/保留/训练/合同/告知 | Data/Policy Approver | BLOCKED，owner未确认 |
| 目标tenant/course/user/singlelesson冻结与最终Pins | Release + Teaching/Pilot Operator | 目标已提出，实际范围证明未完成 |
| 人员、备班、窗口、受限操作权限与5分钟安排 | 运维责任方 | 待填写/确认 |

不包含本阶段生产部署/迁移/enable授权；未来仍需遵循first-enable runbook全部前置条件。

## 17. Production Safety

[production-safety.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3b/production-safety.json)：生产catalog在任务开始/结束READ ONLY验证，ledger449→449完整metadata相同，Agent tables0；inventory必要计数不变。runtime config/PM2在本轮中后段只读快照一致并与R3A hash一致；不将其时间点冒称为本轮最早启动快照。flagOFF、三allowlistsEMPTY、PM2同PID/15s配置、Tailscale status前后相同。

Production migration NOT APPLIED；本任务production writes0、deploy0、enable0、Tailscalemutation0、liveProvider0；未读学生enrollment/progress/成绩/聊天。零写范围是本任务行为，不断言全站其他用户没有活动。

验证证据：[release-integrity.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3b/release-integrity.json)、[targeted-reconcile-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3b/targeted-reconcile-result.json)、[validation-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3b/validation-result.json)、[verification-build-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3b/verification-build-result.json)。18项DB验证在network-none私有fixture，包括终态不变、越tenant/fence拒绝、超期/取消收敛、幂等、latecompletion拒绝、future保护、anon/auth拒绝、batch边界、owner状态、23教学表hash不变。fixture setup会写合成数据，不冒充生产零写证明；容器finally清理。

本轮新构建ID `S4DNZa8E0lxznv1YbGzYG` 仅验证，私有构建目录已删除。R3A原始candidate `T45ZN3yOYh5w194F5gq8o` archive仍匹配，**R3B不替换候选**；后续真实UI/产品改动会使其失效并需重建重验。

## 18. Stage 1G Readiness

**NOT READY**。进入下一阶段必须真实具备：至少1Policy-compatible lesson；真实serverPins；目标正式classroomaction/route通过；实际Tailscale四项PASS；Provider政策APPROVED；allowlist仅覆盖目标范围的有效证明；人员/备班已填写；reconciler执行安排被接受并可履行。

目前真实内容/Pins/目标UI、实际网络测试、政策批准、人员和单lesson最终证明均未关闭。Formal synthetic route PASS只证明既有接入，不覆盖本次新选的hangul-introduction。准备包不能替代这些事实。

## 19. Final Recommendation

保持**CONDITIONAL PREPARATION COMPLETE**。将四个准备包交由教学、工程、运维、政策责任方分别审阅；本阶段到此停止，不发送代审批消息、不进入Stage1G、不部署、不改生产课程/Tailscale、不迁移、不enable。

Original Drain Gate **PASS**；生产保持原状。优先待办是确认并正式补齐目标authoring链与课堂入口，其次获得实际Tailscale测试和Provider政策授权、填写值守人员，最后完成真实Pins/单lesson证明；这些是剩余前置项，不是本阶段自动执行指令。
