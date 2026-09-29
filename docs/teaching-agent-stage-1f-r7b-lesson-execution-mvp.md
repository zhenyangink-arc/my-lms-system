# Stage 1F-R7B — Teaching Agent Lesson Execution MVP

## 1 Executive Summary

R7B 在既有 LessonRuntime 中完成确定性执行闭环：原生视频到达 5 秒 Cue 后暂停，现有单选活动显示，服务端隔离 fixture 使用既有 grader 确认完成后恢复播放。Overall **CONDITIONAL**；Execution MVP **PASS WITH FIXTURE LIMITATION**。生产持久化进度尚未验证。

## 2 Teaching Agent Mainline

主线仍为 UPLY Teaching Agent / AI 韩语教师助手。互动视频是 Agent 将来可依赖的 Lesson Execution 能力。本阶段没有运行 Agent，也没有调用 Provider。Runtime Facts 只读入口为后续 Lesson Tool 绑定准备。

## 3 Scope

仅以 Frozen Node5 为讲解来源、Node7 第一题为 Activity 语义来源。保留 version1 Draft 的全部 8 个节点。本次修改 13 个产品文件，新增 6 个产品文件；测试新增 4 个、调整 3 个，开发 fixture 7 个文件。精确路径见 `implementation-plan.json`，最终差异见 `workspace-scope.json`。

## 4 Authorization

先完成源码复核、只读预检和精确文件计划，再请求批准。用户明确回复“批准”，随后再次确认“批准了”。本次代码修改在该批准之后进行。授权不包含生产部署、数据库写入、迁移、发布、Provider、Agent 或启用。

## 5 R7A Inputs

复核 R7A 报告、V2 架构参考与当前 contracts/validator/registry/StepController/TargetRegistry/ActivityExecutor/MultipleChoiceBlock/提交与进度投影/TeacherVideoPlayer/TeacherTimeline/Director/Lesson Tool/Domain Port/协调器实现。当前源码和 schema 优先。Manifest 为严格 schema，没有可直接容纳 Cue 的通用 config；故在同一 V1 family 增加受限可选 execution 字段。V2 的理想分层未产生独立子系统。

## 6 R6F Freeze Verification

开始和结束均使用独立 READ ONLY DB 连接核对 8 个真实节点，逐行及文本、顺序、类型、updated_at 与 R6F 一致；Script Version、四条目标及父链一致。冻结 baseline payload SHA256：55a2b81ed6912e392ab17d502e5d2ffce3e0ddce330ae45d09ba79ccadcd43b8。fixture 在服务端再次核对冻结文本 hash。

## 7 Existing Runtime Reuse

复用现有 RuntimeRoot / LessonRuntime、LearningStateProvider、StepController、TargetRegistry、TemplateRenderer、RegionRenderer 与 MultipleChoiceBlock。既有 ActivityExecutor 的通用活动体系保留，单选使用已存在的 native renderer。没有新增 Runtime 根组件、第二套题库或进度数据库。NativeMediaController 是 Step lease 下的单一媒体呈现 owner；native execution 不接受 compat teacher 混入。

## 8 Native Execution Projection

server-only projection builder 输出相同 LessonManifestV1，经过既有完整 validator。仅输出 Node5 安全教学文本、Node7 第一题的 public DTO、视频/media binding、一个 show_activity Cue、已有 progress refs 与 layout。没有使用 LegacyChapterOneSource、固定第一章 loader、compat capsule 或生产发布 compiler。

## 9 Public / Private Projection Boundary

Public：题干“哪个是元音？”、三个选项以及安全绑定。Private：答案标记与现有 index answer contract 留在服务端 fixture。完整 Node7 作者正文不会进入 public Manifest、浏览器 bundle、DOM 或 Facts。合法选项“ㅏ”可公开；泄漏检查针对答案身份/判分密钥，而非禁止选项本身出现。

## 10 Native Video Renderer

既有 block registry 增加 video renderer。NativeVideoBlock 只转发媒体事件和用户意图；唯一 NativeMediaController 发出 play/pause/seek。开发视频为 30 秒可解码 WebM 测试图案，标记 DEVELOPMENT FIXTURE ONLY，不在 public 或正式发布包。没有制作金老师正式视频、音频或 TTS。

## 11 Timeline Cue Contract

Cue：time / 5秒 / test-video → show_activity → test-activity / mandatory / pauseSource / after_authoritative_activity_completion。只实现 show_activity。严格验证 id、同 Step、源与目标类型、媒体 revision、有限时间、已知和实际 duration、能力、策略、重复身份。Cue 无题干、答案、Provider 参数或任意 DOM 命令。

## 12 Runtime State Machine

READY → PLAYING → CUE_PENDING → AWAITING_ACTIVITY → CHECKING_COMPLETION → RESUME_READY → PLAYING。错误或未知结果保持暂停，媒体失败进入 ERROR。Layout、媒体事件和完成证据分别建模。Cue pending 在任何异步 checkpoint/pause/reveal 之前设置。

## 13 Activity Completion Authority

复用现有 gradeSmartTextbookActivity / single_choice answer contract。新增 activity-completion/1 回执区分 COMPLETED、INCOMPLETE、UNKNOWN，校验 request/session/snapshot/step/block/activity/media/cue/generation、attempt 与状态证据。Content revision、服务端 stateRevision 与 client generation 分开。ActivityResult.ok、correct、layout 和 MEDIA_ENDED 均不是 Step/Lesson 完成依据。Atomic RPC：NOT USED。

## 14 Pause → Activity → Resume

真实 Chromium 测试播放开发视频，自然跨过 Cue，确认视频 paused、Learning Area 中出现原有 MultipleChoiceBlock。正确提交得到服务端 fixture COMPLETED 后恢复，错误答案保持暂停。不会因显示反馈或 ok=true 直接推进课程。

## 15 Cue Dedupe

身份限定于 session + snapshot digest + step + media revision + cue。pending、waiting、completed 分开；连续 timeupdate、重复回调与已完成后重播不会生成第二次强制活动或恢复。TargetRegistry 验证只有一个实际 play owner。

## 16 Seek Handling

使用 time crossing / 已到期未完成 Cue 扫描，避免浮点相等。Forward seek 越过 mandatory Cue 会暂停并展示最早未完成活动；完成后的 backward seek 不强制重做。seek 落点和随后的 timeupdate 不会重复触发。

## 17 Refresh Restore

刷新通过同一合法 fixture session 和服务端状态恢复：等待中的 Activity 继续等待，完成后的 Activity 不重复出现。snapshot/step/activity/media 绑定不一致时 fail closed。视频位置仅 observation，不作为进度。fixture 状态保存在独立服务进程内，仅验证浏览器刷新；服务端重启持久性和生产 durable progress 未验证。

## 18 Stale Generation

沿用 StepController lease/disposal。旧 generation 的完成结果不能控制新 owner；晚到的 play Promise 不能把 AWAITING_ACTIVITY 改为 PLAYING。request correlation 和状态 freshness 也独立校验。

## 19 User Pause / Autoplay

仅当 Runtime 原先暂停的是正在播放的视频，且用户没有主动要求保持暂停时，完成才允许自动恢复。用户 pause 保持；刷新完成状态停在 RESUME_READY。autoplay Promise 拒绝后不循环重试，显示“继续播放”操作。

## 20 Media Error

load/decode/network error 与不合法实际 duration 会进入 ERROR，停止 Cue 推进，不伪造 Activity/Step 完成。MEDIA_ENDED 单独记录媒体观察，不等同文本阅读确认或教学完成。

## 21 Director / Layout

复用 TemplateRenderer presentation owner：播放 split，Activity 阶段 learning，完成后恢复 split。MVP 没有扩展 classroom shot enum 或实现 scenario。布局变更不改变 grade、progress 或 Cue completion。

## 22 Runtime Facts Read-Port

lesson-runtime-facts/1 提供只读 read()：安全 lesson/script/node/block/activity 绑定、snapshot digest、generation、phase、completion summary、state evidence 与允许的呈现动作名称。video position 明确标为 client observation。读取不会执行播放、判分、推进或写入，也不暴露私有答案。

## 23 Lesson Tool Future Integration

既有 Lesson Tool 仍只读取 verified selection 的内容与目标，本阶段未改变其合同或注册新 Tool。后续应先补齐正式 native Activity / durable completion，再把 Facts 经受控 Domain Port 接入 Lesson Tool；Provider 仍不能成为状态 authority。

## 24 Legacy Path Exclusion

新 fixture 不调用旧 learning-agent/respond、Edge Provider、productionTeacherAgentAdapter 或 PGRST202 fallback。没有把 hangul-introduction 伪装成旧第一章。旧路径只在既有回归测试中被检验，未新增兼容层，也未清理旧数据。

## 25 Answer Leakage Protection

测试扫描 public serialized Manifest、预提交 DOM、browser bundle 的依赖图、client logs 和 Runtime Facts。server fixture、原始冻结报告和 grader 模块不进入 client bundle。浏览器测试仅允许 loopback 请求，没有外部网络请求。

## 26 Test Matrix

R7B 58/58 PASS；相关既有 Runtime 回归 50/50 PASS。覆盖 happy path、wrong、UNKNOWN、真实 timeout/readback、重复 Cue/提交、前后 seek、刷新 waiting/completed、失效 restore、stale callback、user pause、autoplay rejection、media error、能力/策略拒绝、答案泄漏与只读 Facts。测试等待事件、DOM 或显式状态；超时测试验证实际 10秒超时边界，不以固定 sleep 推断成功。

## 27 Frozen Content Protection

R6A 父链、R6B Script Version 与 R6F 8 个节点、目标保持 UNCHANGED。没有 INSERT/UPDATE/DELETE frozen content。独立结束查询确认 add_node/create_draft/update_node 审计计数与开始相同。

## 28 DB / Production Boundary

Production DB business writes、Activity inserts、Timeline rows created、Node/Version writes、migration、Publish、Agent/Provider/Pins、Auth、Deploy、PM2/runtime/launcher/Tailscale mutations 均为 0。fixture 的请求、作答和 checkpoint 为测试进程内存变化，不冒称 Production Writes。Feature OFF，Allowlists EMPTY，Agent 五表 0。

## 29 Build / Static Validation

Next 16.2.10 隔离 build PASS，TypeScript PASS，构建副本与最终产品文件 hash 一致。构建不复制生产凭据，未部署。新增产品文件 ESLint 无错误；修改前已存在的 3 个 React Hook lint 错误仍保留，未计为本次新增错误。JSON、scope 与 secret scan 见 workspace evidence。

## 30 Gate Matrix

见下表。所有执行 Gate 的 PASS 均按实际隔离 fixture 证据解释，不代表生产 durable progress。

| Gate | Result |
| --- | --- |
| G-R7B-1 R7A Ready | PASS |
| G-R7B-2 R6F Freeze Verified | PASS |
| G-R7B-3 Write Authorization | PASS |
| G-R7B-4 Existing LessonManifest Reused | PASS |
| G-R7B-5 Existing LessonRuntime Reused | PASS |
| G-R7B-6 No Second Runtime | PASS |
| G-R7B-7 No Second Activity System | PASS |
| G-R7B-8 No Second Progress System | PASS |
| G-R7B-9 Native Projection Implemented | PASS |
| G-R7B-10 Node5 Binding Valid | PASS |
| G-R7B-11 Node7 Public Projection Safe | PASS |
| G-R7B-12 Private Answer Isolated | PASS |
| G-R7B-13 Native Video Renderer | PASS |
| G-R7B-14 Video Play/Pause | PASS |
| G-R7B-15 Time Cue Trigger | PASS |
| G-R7B-16 Cue Validation | PASS |
| G-R7B-17 Cue Dedupe | PASS |
| G-R7B-18 Activity Reveal | PASS |
| G-R7B-19 Existing Activity Renderer Reused | PASS |
| G-R7B-20 Existing Grading Domain Reused | PASS |
| G-R7B-21 Completion Authority Defined | PASS |
| G-R7B-22 Correct Completion Resumes | PASS |
| G-R7B-23 Wrong Answer Does Not Resume | PASS |
| G-R7B-24 UNKNOWN Does Not Resume | PASS |
| G-R7B-25 Completion Readback | PASS |
| G-R7B-26 Duplicate Callback Safe | PASS |
| G-R7B-27 Backward Seek Safe | PASS |
| G-R7B-28 Forward Seek Mandatory Cue Safe | PASS |
| G-R7B-29 Refresh Waiting Safe | PASS |
| G-R7B-30 Refresh Completed Safe | PASS |
| G-R7B-31 Stale Generation Ignored | PASS |
| G-R7B-32 User Pause Respected | PASS |
| G-R7B-33 Autoplay Failure Safe | PASS |
| G-R7B-34 Media Error Fail Closed | PASS |
| G-R7B-35 Layout Single Owner | PASS |
| G-R7B-36 Answer Leakage Scan | PASS |
| G-R7B-37 Runtime Facts Read-Port | PASS |
| G-R7B-38 Runtime Facts No Private Answer | PASS |
| G-R7B-39 Old Learning Agent Fallback Not Used | PASS |
| G-R7B-40 Legacy Chapter-One Not Canonical Path | PASS |
| G-R7B-41 Frozen Teaching Script Unchanged | PASS |
| G-R7B-42 DB Business Writes Zero | PASS |
| G-R7B-43 Migration Zero | PASS |
| G-R7B-44 Publish Zero | PASS |
| G-R7B-45 Agent Runs Zero | PASS |
| G-R7B-46 Provider Zero | PASS |
| G-R7B-47 Feature OFF | PASS |
| G-R7B-48 Allowlists EMPTY | PASS |
| G-R7B-49 Tests Pass | PASS |
| G-R7B-50 Build / Type Validation Pass | PASS |
| G-R7B-51 Evidence Boundary | PASS |

## 31 Remaining Agent Execution Gap

尚缺正式 native Activity binding、可信 durable attempt/completion readback、生产会话和发布 snapshot 接入验证。之后才进行 Lesson Tool / Skill 绑定及另行授权的 Provider/Agent E2E。本次不开放 Draft student admission。

## 32 Next Stage

R7C — NATIVE ACTIVITY / DURABLE COMPLETION BINDING。仅建议，不在本任务启动。Stage1G：NOT READY。

## 33 Final Recommendation

Overall：CONDITIONAL。Execution MVP：PASS WITH FIXTURE LIMITATION。Execution Status：FIXTURE LIMITATION。继续保持内容冻结、Feature OFF、Allowlists EMPTY；完成正式持久化验证后再进入 Agent binding。

