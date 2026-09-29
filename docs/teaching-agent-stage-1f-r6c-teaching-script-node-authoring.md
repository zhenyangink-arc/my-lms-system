# Stage 1F-R6C — Teaching Script Node Authoring

## 1 Executive Summary

Overall: **GO**。目标“韩文字母入门 / 第0章 / 课前导航”的唯一 version1 Draft 已创建并保存8个教学节点；逐个数据库只读核验与最后浏览器刷新核验全部通过。当前状态 **READY FOR SCRIPT REVIEW**。Node7 按用户明确确认保存两题完整 Draft 文本，自动判分 DEFERRED。Stage1G仍NOT READY；未进入R6D。

## 2 Scope

仅通过既有已登录Chrome的正式Script Studio完成目标8节点及官方保存审计。用户在写前明确回复“批准创建”。新增8条node、24次node更新、32条本阶段官方审计记录（8 add_node + 24 update_node）。R6B已有create_draft审计1条保持原样。没有创建第二版本、删除内容、修改业务源码或部署。

## 3 Teaching Design

按用户原文锁定整体认识→元音→辅音→音节组合→初声/中声/终声→练习→总结。8个标题和台词保存在[node-plan.json](evidence/teaching-agent-stage-1f-r6c/node-plan.json)，没有润色或添加复杂发音规则。主台词字段及可见“韩语版台词”使用正式UI填写；Node7主字段含完整两题/答案/反馈，韩语版字段保留用户提供的韩语反馈。

## 4 Browser/Auth Boundary

复用服务器Chrome CDP 127.0.0.1:9222；只连接现有已登录页面。以用户本人正常登录profile的角色与既有安全hash核对身份，未读取/导出Cookie、JWT、密码或认证头。未创建浏览器/Profile、未重新登录、未冒用身份。结束时Chrome保持打开。

## 5 Production Preflight

写前重新核验PG17.6、ledger457/latest202609140007、Build `6IhDHN8Dm1nCewiCEZnV5`、PM2在线、唯一canonical链和唯一version1/draft、node0。Feature OFF、三项allowlists EMPTY、Agent五表0、active inconsistent fences0。持久candidate SHA与批准值一致，1394个部署文件匹配artifact。证据：preflight、write-time-preflight、artifact-verification、target-context。

## 6 Node Schema Audit

实际链路：`TeachingScriptStudio.tsx` 新增小节 → `addTeachingScriptNodeAction` → 正式node INSERT和add_node日志；`TeachingScriptNodeForm.tsx`表单/1800ms autosave → `saveTeachingScriptNodeAction` → `save_teaching_script_node_atomic` → 原子node/私有答案更新，并记录update_node日志。Platform Owner、draft、updated_at CAS检查保持有效。新增及日志不是同一事务；本次均逐次核对实际行和日志，不以UI响应推断整体原子性。

审计文件：

- `src/features/learning-agent-script-studio/TeachingScriptStudio.tsx`
- `src/features/learning-agent-script-studio/TeachingScriptNodeForm.tsx`
- `src/app/dashboard/admin/teaching-scripts/actions.ts`
- `supabase/migrations/202608260006_learning_agent_script_studio.sql`
- `supabase/migrations/202609070001_teaching_script_atomic_video.sql`

实际DB保存RPC正文与源码一致（忽略首尾空白）。类型仅使用正式enum。`node_key`为只读系统生成值，logical aliases只在报告/evidence映射。UI存在主台词及可见韩语台词、标题、类型、流程、可选提示/例子；不存在独立通用notes/duration输入。本次选择正式“原有形象与朗读”模式保存文本，未选视频、生成语音或播放。

## 7 Eight-Node Plan

| Order | Title | Report-only alias | Formal type | Result |
| --- | --- | --- | --- | --- |
| 1 | 今天认识韩文字母 | `orientation-intro` | `opening` | PASS |
| 2 | 韩文字母怎么组成？ | `hangul-structure` | `explanation` | PASS |
| 3 | 先认识基础元音 | `basic-vowels` | `explanation` | PASS |
| 4 | 再认识基础辅音 | `basic-consonants` | `explanation` | PASS |
| 5 | 把辅音和元音放在一起 | `syllable-combination` | `example` | PASS |
| 6 | 一个音节里面有什么？ | `initial-medial-final` | `explanation` | PASS |
| 7 | 一起试一试 | `guided-practice` | `instruction` | PASS |
| 8 | 今天学了什么？ | `orientation-summary` | `summary` | PASS |

## 8 Node Authoring Execution

严格1→8，每个logical node只点击一次新增。每次新增先核对DB节点数量/关联/顺序，再编辑和等待官方autosave，之后核对内容才进入下一节点。每个节点记录3次成功update_node审计，共24次；没有手工SQL INSERT/UPDATE，也未伪造CAS或绕过autosave。

第1节点遇到两次自动化控件定位中断：第一次发生在任何字段修改之前，只读证明仍为默认节点、update日志0；第二次发生在两个已确认autosave之后、打开类型设置之前。重新只读确认已提交状态后仅完成尚未执行的类型设置，没有重复创建或重发结果不明的保存。没有UNKNOWN创建/提交结果。

浏览器表单把LF换成CRLF；内容比对仅标准化CRLF为LF，保留原文和顺序。每个node-01至08 receipt均PASS。

## 9 Node Ordering

物理节点8、逻辑节点8，sort_order精确1–8，无额外system node、无重复key/id。按正式新增产生顺序，无reorder写入。1–7按顺序继续，8通过正式控件设置结束。没有Runtime执行。

## 10 Practice Node

正式合同一个node只有一道结构化单选题。用户明确接受两题均保留为Draft文本，因此第7节点使用`instruction`，包含原题、各3个选项、B.ㅏ/A.가答案及两组韩语反馈。**Practice Content: DRAFT_TEXT_ONLY；Answer Correctness Runtime: DEFERRED**。没有新schema、自动判分、Agent逻辑或私有答案记录写入。该批准映射通过不代表已完成结构化互动验证。

## 11 Draft State

唯一版本1始终draft，published_at为空；版本元数据与R6B一致。Publish0、Runtime0。刷新后8个节点仍存在并可见，顺序与标题正确。UI保持authoring状态，没有进入学生Runtime。

## 12 Canonical Content Protection

六类canonical对象全行hash与写前一致（catalog lesson、textbook、version、chapter、module、teaching lesson），包含学习目标与关联保护。11类无关内容指纹与写前一致，Foundation schema指纹一致。版本仍唯一；既有R6A/R6B文档不修改。

## 13 Agent / Provider Boundary

Feature OFF；allowlists EMPTY；Agent五表均0。Agent Run、Provider请求、Pins创建、Definition publication、Auth写入均0。本任务仅authoring UI/只读DB路径；Provider0是本任务操作范围记录，没有声称全站所有历史Provider活动为0。

## 14 Production End-State

ledger457/latest202609140007；批准Build仍运行；PM2 online且PID/配置未变；runtime、launcher、Tailscale hashes未变；Foundation schema未变。唯一授权内容变化为8个node和正式node更新/审计。Unauthorized Writes0、Publish Writes0、Agent Writes0。详见production-end-state、write-receipt、canonical-content-diff和ui-final。

## 15 Gate Matrix

| Gate | Check | Status | Evidence note |
| --- | --- | --- | --- |
| G-R6C-1 | R6B Draft Ready | PASS | 见对应 evidence |
| G-R6C-2 | Authenticated Platform Owner | PASS | 见对应 evidence |
| G-R6C-3 | Target Context Exact | PASS | 见对应 evidence |
| G-R6C-4 | Node Schema Audited | PASS | 见对应 evidence |
| G-R6C-5 | Eight-Node Plan Locked | PASS | 见对应 evidence |
| G-R6C-6 | Write Authorization | PASS | 见对应 evidence |
| G-R6C-7 | Node1 | PASS | 见对应 evidence |
| G-R6C-8 | Node2 | PASS | 见对应 evidence |
| G-R6C-9 | Node3 | PASS | 见对应 evidence |
| G-R6C-10 | Node4 | PASS | 见对应 evidence |
| G-R6C-11 | Node5 | PASS | 见对应 evidence |
| G-R6C-12 | Node6 | PASS | 见对应 evidence |
| G-R6C-13 | Node7 | PASS | DRAFT_TEXT_ONLY; automatic correctness DEFERRED, explicitly accepted |
| G-R6C-14 | Node8 | PASS | 见对应 evidence |
| G-R6C-15 | Node Count Eight | PASS | 见对应 evidence |
| G-R6C-16 | Node Order | PASS | 见对应 evidence |
| G-R6C-17 | Node Types Valid | PASS | 见对应 evidence |
| G-R6C-18 | Teaching Content Exact | PASS | 见对应 evidence |
| G-R6C-19 | Practice Content | PASS | DRAFT_TEXT_ONLY; automatic correctness DEFERRED, explicitly accepted |
| G-R6C-20 | No Duplicate Nodes | PASS | 见对应 evidence |
| G-R6C-21 | Script Version Still Draft | PASS | 见对应 evidence |
| G-R6C-22 | No Publish | PASS | 见对应 evidence |
| G-R6C-23 | No Runtime Execution | PASS | 见对应 evidence |
| G-R6C-24 | R6A Canonical Content Unchanged | PASS | 见对应 evidence |
| G-R6C-25 | Feature OFF | PASS | 见对应 evidence |
| G-R6C-26 | Allowlists EMPTY | PASS | 见对应 evidence |
| G-R6C-27 | Agent Rows Zero | PASS | 见对应 evidence |
| G-R6C-28 | Provider Zero | PASS | 见对应 evidence |
| G-R6C-29 | Pins Zero | PASS | 见对应 evidence |
| G-R6C-30 | Definition Publication Zero | PASS | 见对应 evidence |
| G-R6C-31 | Auth Writes Zero | PASS | 见对应 evidence |
| G-R6C-32 | Runtime Unchanged | PASS | 见对应 evidence |
| G-R6C-33 | Tailscale Unchanged | PASS | 见对应 evidence |
| G-R6C-34 | Evidence Boundary | PASS | 见对应 evidence |

## 16 Next Stage

**R6D — TEACHING SCRIPT REVIEW & VALIDATION** 可作为下一阶段，本任务未启动。当前8节点仅Draft，未经过发布/学生运行验收；Node7自动判分继续DEFERRED。

## 17 Final Recommendation

**READY FOR SCRIPT REVIEW**。保留当前唯一Draft及8节点，停止R6C。Feature/allowlists/Provider/Agent/Pins/发布边界全部保持，Stage1G仍NOT READY。
