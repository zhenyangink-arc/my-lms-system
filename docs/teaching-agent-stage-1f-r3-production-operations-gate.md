# UPLY Teaching Agent — Stage 1F-R3 Production Operations Gate

## 1. Executive Summary

**Overall: NO-GO。Stage 1G: NOT READY。** 本阶段只完成 R3 运维验证、证据、内容准备清单及受阻 runbook；没有生产部署或启用。

四类实际阻断：① 5 门已发布 Korean course / 19 个 catalog lesson 中 **0 个现有 Policy-compatible candidate**；② 实际 Tailscale 上的 NDJSON、Origin/Host/scheme、压缩缓冲、断连尚无独立获准测试绑定；③ 生产当前 PM2 15 秒停止期限在隔离演练中强杀慢请求，**47.021 秒后 Run 仍 running，cancel_requested 已持久化却未收敛**；④ 未找到责任方批准真实课程片段发送 DeepSeek 的政策记录。

已通过：真实正式课堂 slug 路由 synthetic 闭环；138 项真实 JWT/RLS 检查；严格 replay / 正常 45 秒 deadline read-tail；六步增量的两路径逐份 rehearsal / failure stop；原始完整 build 和 manifest；短请求 OFF/recovery/drain、已知旧应用源码的回滚演练；tenant-scoped 只读 operator 查询。成功不覆盖上述四类阻断。

Production Writes **0**；Agent Teaching Domain Writes **0**；production ledger **449→449**、Agent tables **0→0**；生产 flag **OFF**、三名单 **EMPTY**、migrations **NOT APPLIED**；live Provider requests **0**。[production-safety.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/production-safety.json)

## 2. Inputs & Baseline

日期 2026-09-14（Asia/Seoul）；Git HEAD `b1672390ae96357a2143358235cc10edeff8d488`。读取 Current State Audit、Architecture v1、Stage 0A/0B/1A–1E/1F/R1/R1B/R2/R2A，长文分段补齐；优先级为当前源码/实测 > R2A > 旧报告。报告中的旧阶段建议、完成声明不作为本轮授权或实测替代。Next 16.2.10 本地 self-hosting/compress 指南已读。

开始冻结 **2720 个既有文件**的 SHA-256；保留此前未提交工作。切点 `202609130003_runtime_authoring_nonretryable_error`，baseline SHA `e5de2f48fa40da53ebcae5353aa4907b1738e15998a304a37b3d0fc555c7bac5`；本阶段不回写 baseline、manifest 或 migration。

安全方法：生产 TLS 验证、BEGIN READ ONLY、只读会话/超时约束下 schema-only snapshot 与 aggregate catalog；真实 Auth/Kong/PostgREST/RLS 使用新 disposable stack `uply-agent-r2-862115d18b2d`（复用已审阅 R2 guard 命名）。API 51581、DB 43177、Next 36411 独立；Supabase CLI 默认 wildcard port mapping，不能称网络层 loopback-only。所有 harness 连接强制 loopback。完整栈与无网络 schema clone 是两种不同证据。

未取真实学生 JWT、选课明细、成绩、progress、聊天或教材全文；生产公开 login GET 不携 Cookie。中断恢复后按资源归属继续，不重新 seed 生产。

## 3. Files Changed

本轮只新增 `scripts/teaching-agent-r3/`、`docs/evidence/teaching-agent-stage-1f-r3/` 与本报告；既有源码、测试、迁移、配置和文档保持开始字节。最终核验见 [workspace-changes.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/workspace-changes.json)。

| 新增模块 | 职责 |
|---|---|
| production-inventory.sql | 生产只读 Korean catalog/出版链 aggregate；无学生明细 |
| rehearse-migrations.py | owned schema clone 两路径逐份应用/对象/ledger验证与失败注入 |
| formal-fixture.py / instrument.py / formal-browser.mjs | synthetic 数据对齐正式 slug；私有副本 Provider/观测 seam；真实课堂浏览器闭环 |
| candidate.py / release-manifest.mjs | 原始生产 build 冻结；release inputs/迁移/definition/config 摘要 |
| process.py / operations.mjs | 独立 Next startup OFF、替换、跨进程 cancel、drain、previous-app rollback 与 15 秒强杀复现 |
| operator-*.sql / verify-operator.py | 受限只读诊断、active run、监控及真实 staging 验证 |
| README.md | 安全复现范围、证据与受阻操作步骤 |

未新增产品 API、Tool、Skill、Prompt、Provider、auth bypass。私有测试副本与原始 candidate artifact 分开，不混称相同字节。

## 4. Real Course Inventory

本轮生产 READ ONLY 观测时间 `2026-09-14T12:23:12.311519Z`；[production-inventory.sql](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3/production-inventory.sql) → [production-inventory.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/production-inventory.json)。

| Korean app catalog / 内容 | 计数 |
|---|---:|
| 已发布 courses（全部 immediate） | 5 |
| 已发布 catalog lessons | 19 |
| lesson immediate / prerequisite_passed | 17 / 2 |
| published textbook / chapters | 1 / 17 |
| textbook modules / published teaching lessons | 132 / 132 |
| published script versions / nodes | 1 / 8 |
| 出版链下含 Korean 的 nodes | 8 |
| 有 script 的 teaching lesson / 全部 | 1 / 132（约0.76%） |

五门课程：korean-beginner、korean-intermediate、korean-advanced、korean-life-essentials、topik-i-foundation。唯一内容链属于 basic-pronunciation；其 lesson unlock 是 prerequisite_passed。其余18个 lesson 的本文所查 textbook/script 链均为0。Korean 节点计数只在 SQL 内匹配正文，不输出正文；8个 node 不是8个已核验 selection pins。

## 5. Pilot Candidate Analysis

**NO CURRENT PILOT CANDIDATE：0/19 catalog lessons；现有教材目标0/1。**

| 候选组 | 失败必要条件 | 当前结论 |
|---|---|---|
| basic-pronunciation（lesson `26fd3e57-e6cf-4df9-8514-646786f61e1d`） | prerequisite_passed 不被 independentlyUnlocked 支持 | 即使有8个已发布 node，也不能产生可授权 Pilot |
| daily-greetings | prerequisite_passed，且内容链0 | 不支持 |
| 其余17个 immediate lessons | published textbook / teaching script / Korean node 链为0 | 独立解锁条件不等于有可解释内容 |

根据 [access-rules.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/policies/access-rules.ts)、[supabase-student-teaching-repository.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/repositories/supabase-student-teaching-repository.ts) 与真实 aggregate，已足以否定现有 candidate；不需要读取真实进度来绕过规则。**没有确认至少一个真实 lesson 能生成可用 Pins**。这是必要条件静态判定；没有拿真实学生身份实际运行 projector，实际用户级性能/资格保持 Not tested。

## 6. Pilot Content Preparation

只交付 authoring-level checklist，**NOT APPLIED，无生产 DML**。首选供教学团队评估的现有独立 lesson：korean-beginner / hangul-introduction，course `2f79a679-6e25-4cf9-9f71-455905584787`，lesson `6ad20a2b-2306-4173-9d3f-73eb9691ff58`；这是准备对象，**不是已批准 Pilot Candidate**。

| 教学/内容负责人核验 | 当前缺口 / 放行证据 |
|---|---|
| 课程/lesson设计与独立解锁 | 保持既有规则；逐个父级确认发布、时间与锁状态 |
| published textbook/version/chapter/module | 此 lesson 当前0；需通过正式 authoring/publish 流程建立真实内容与关联 |
| public Agent profile / feature | 实際发布 profile、资格、教材 app 链一致；不能只给 fixture profile |
| published teaching lesson / script version | 当前0；目标、讲稿及版本须正式审阅发布 |
| node / locale / Korean segment | 合法已发布节点、安全 view 白名单、非空韩语、长度/切分/revision 一致 |
| server Pins | 在获批环境用原 Student Policy/projector 正向与拒绝矩阵；不可用客户端句子替代 |
| 正式页面接点 | 当前 curated 选择区域针对 basic-pronunciation / korean-level-one-smart；新内容不会自动获得另一 lesson 的相同 UI。需另行核验真实页面支持 |
| 内容权利/Provider授权 | 由教学及数据政策责任方确认，不由工程推定 |

basic-pronunciation 的131个无 script teaching lessons 可纳入正常内容补齐，但补稿本身不解除父 lesson 锁。禁止为本次 Agent 把 prerequisite 改 immediate，禁止把 synthetic “저는 학생입니다.” 写进生产。

## 7. Formal Classroom Route Validation

**PASS（synthetic production-shape）。** 实际 route：`/r2-a/apps/korean/courses/korean/korean-basic/korean-beginner/basic-pronunciation`。

调用链：`src/app/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page.tsx` → 原 `dashboard/courses/.../page-content.tsx` → `SmartTextbookShell` → `KoreanLevelOneSmartTextbook` → `lesson-slots.tsx`（user JWT、safe view、Policy/pins）→ `StudentAiTeacherPanel` → POST `/api/teaching-agent/runs` → `production.ts` → `student-run-coordinator.ts` → DeepSeek adapter（仅 HTTP/SSE fixture）→ real Tool/Domain Port → real PostgREST → evidence/output/DB终态 → NDJSON。

私有 `/r2-lesson` 已从此次测试副本移除。真实产品 login + SSR cookies；最终浏览器讲解1835ms，来源badge存在，内部字段/哨兵未泄露。三个普通 HTTP 样本1182/1217/1112ms，均2次 fixture model calls。严格同run/conversation replay、message/有效segment冲突409、owner/non-owner状态与cancel通过。

OFF UI无入口/POST404；startup wrong-course/wrong-user无入口/POST403，新增runs0；A2无选课页面无入口。角色与 enrollment 独立边界另有真实 JWT/Policy/RLS矩阵，不把rollout403冒充enrollment证明。

[browser-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/browser-result.json)、[operations-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/operations-result.json)、[ui-completed.png](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/ui-completed.png)。首轮 deadline尾部混入 LiveClassEntryBanner 每8秒的3次查询；UI/cancel测完后关闭页面，再执行HTTP-only截止测试，未关闭产品轮询或忽略真实 Agent 读取。完整失败记录见 [harness-attempts.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/harness-attempts.json)。

## 8. Production Network Topology

只读确认：Tailscale HTTPS `kmgwak-system-product-name.taila18cd5.ts.net:8443` → `http://127.0.0.1:3000` → PM2 `uply-first-enable`，fork_mode、instances=1、PID1176676、cwd `/home/yangzhen/releases/uply-first-enable-20260910/source`。其他端口的服务不算 UPLY worker。

启动器 `/home/yangzhen/.config/uply-first-enable-20260910/start.mjs` 从 runtime.json 注入 process.env，再 Next start；不是动态配置服务。PM2当前 `kill_timeout=15000ms`。未restart/reload、未改serve、未改配置。[production-safety.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/production-safety.json)、[production-network.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/production-network.json)。

## 9. Tailscale HTTPS Verification

真实路径识别和 public `/login` HTTPS reachability **PASS**；两次无登录安全 GET 均200、TLS验证通过。不存在已获准独立 test binding。

**Actual Tailscale Streaming: BLOCKED — OPERATIONAL APPROVAL REQUIRED。** 继续间隔 NDJSON probe 需要另一个绑定/端点配置；按用户§23/83停止该动作，未修改Tailscale，也没有开启Agent测试。Public login收到多个buffer不证明逐帧生成；private staging直连或旧TLSfixture均不替代实际生产链。证据 [production-network.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/production-network.json)。

## 10. Origin / Host / Scheme

实际外部 scheme=https、Host带:8443、同源Origin为完整HTTPS origin。login第二次带不可信Origin仍200，是公共GET页面的正常证据，**不是Agent POST CSRF测试结果**。

实际下游 `request.url` 与 `x-forwarded-proto` **Unknown**，未建立安全echo/probe。[student-handlers.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/student-handlers.ts) 按请求URL protocol与Host验证Origin；本机实际Next负向/正向测试通过不保证Tailscale转发后的scheme一致。生产组合 Gate **BLOCKED**，不能关闭Origin校验来放行。

## 11. Streaming / Compression / Buffering

真实 login响应：HTTP/1.1、text/html、gzip、Cache-Control s-maxage=31536000、Transfer-Encoding chunked；7112 bytes，第一请求4块均约29ms、第二3块均约4ms。不能由HTML缓存/压缩推断Agent NDJSON缓存或缓冲问题。

Agent transport源码输出 application/x-ndjson、no-store、nosniff、X-Accel-Buffering:no；正常功能为阶段事件 + 最终整段answer.final，不是逐token答案流。Next默认压缩未在本阶段更改。直连正式staging可看到run/tool状态分时到达。**实际Tailscale NDJSON压缩/间隔帧：BLOCKED，是否整段buffer Unknown**。

## 12. Disconnect Semantics

代码链：Request signal / ReadableStream.cancel → local AbortController → runtime signal，并以 owner-scoped store 持久 cancel；Stage1D实际Next fixture重跑通过。OFF以后GET/cancel保留owner边界。

实际Tailscale客户端断开→Next signal/probe停止 **BLOCKED**，没有使用真实用户Agent请求验证。跨进程持久cancel在短请求演练通过；强杀后的孤儿Run另为FAIL，二者不得合并成“断连安全已全部通过”。Provider远端停止计算/计费未测，live requests=0。

## 13. Migration Inventory

重新扫描整个 active runner，与 frozen baseline manifest逐份比对，当前6份post-cutover增量；生产不能装baseline或重放449条历史。

| 顺序 | 文件 | SHA-256 |
|---|---|---|
| 1 | 202609140000_agent_core_foundation.sql | `7abc5545f6cb926c37a74a890fc6fcdbad4f89a5c35474a4628af67b7e0afa8b` |
| 2 | 202609140001_agent_runtime_completion_evidence.sql | `a0ece84b6030f029ff68781e3dcffa73e5d7ea2448c33c750ff76c1098f3456b` |
| 3 | 202609140002_agent_run_cancel_request.sql | `a8c0d60432a39f08dd45cea08b7ea0e6565885a8d0a65d15118c1f093dc9fb62` |
| 4 | 202609140003_teaching_operations_reissue.sql | `cb2a1e90011f154185f4b5695e3a14d00dce9a60e37063c1b38d2ca854fac794` |
| 5 | 202609140004_completion_policy_management_reissue.sql | `20358b17f0deed997263660f15bb0e4c2551caffa6b950d09fc9d4c5d609573e` |
| 6 | 202609140005_student_teaching_content_isolation.sql | `ec4454eea39f38bb9f8a7313b203cea444b831bc90cc1e7d30b070400d4c7674` |

[release-candidate-manifest.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/release-candidate-manifest.json)。140003/140004为R1B已审阅业务reissue，不因非Agent名字而遗漏。140005为R2A隔离迁移。全部源字节不变，生产状态NOT APPLIED。

## 14. Production Migration Rehearsal

**PASS，两个路径各6/6。** 最新生产 schema-only snapshot（无表数据/真实Auth行）→ owned offline clone，只执行上述六份；另一库只装平台schema前置→冻结应用baseline→exact449ledger→相同六份。target-upgrade明确baselineApplied=false。

每步：预检ledger完整version/name与文件SHA → SQL成功 → actual catalog与声明对象验证 → 记录该步ledger → exact ledger再验 → 下一步。两路径before/after15类normalized catalog均等价。grant/policy/owner/security definer/search_path等被比较；没有把schema clone称作真实Auth，后者另有Full Supabase矩阵。

[migration-rehearsal.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/migration-rehearsal.json)。Schema-only不包含真实业务行：存量业务数据兼容、生产锁等待/耗时不在本轮证明范围；未来备份与变更窗口仍必需。

## 15. Per-Migration Verification

| Migration | Ledger before→after（两路径同） | 对象/权限要点 |
|---|---|---|
| 140000 | 449→450 | Agent五表、Run约束/事件/usage、scope RPC；RLS/ACL纳入差分 |
| 140001 | 450→451 | definition guard、event v2、完成证据/输出/来源写入wrapper |
| 140002 | 451→452 | persisted cancel/status/check RPC、终态wrapper、event seq |
| 140003 | 452→453 | curriculum_plan_assessments、教学运营函数/trigger/policy |
| 140004 | 453→454 | completion draft/publish/health/retry四函数及grants |
| 140005 | 454→455 | 3 caller-bound函数、7策略变化、安全node view；authenticated可读view、anon不可读、无configuration列 |

每步证据记录schemaBefore/schemaAfter摘要、变化category、声明关系/函数存在断言及actualACL/policy差分。12份 `*-diff.json` 位于本报告evidence目录；函数/view定义以SHA归档，原定义可从锁定migration复现，避免全文堆入metadata证据。

**Failure injection PASS**：首步内CREATE sentinel后SELECT1/0，事务回滚；laterStepsAttempted=0、applied=[]、ledger仍449、schema不变、flagOFF。未调用repair/mark失败SQL。验证helper的CRLF/数字后缀parser问题修正仅在新helper，最终重新执行通过；没有改migration换绿灯。

## 16. Definition Publication Rehearsal

**PASS（staging）。** 真实Auth合成身份/tenant建立后，用 `pinStudentRuntimeDefinition()` 精确编译产物在受限harness控制面插入tenant definition；不是 migration自动seed，不是浏览器自由发布入口。manifest与数据库逐项比较，Student runtime通过真实repositoryadmission。

Profile `student-ai-teacher@1.0.0`，definition digest `4b6299be0d5fcb33b9bdc10e8c35ac894905cfbf55540522e8628380e2ff3d8c`。真实repository面对错误digest按已存DBmanifest返回FORBIDDEN；没有创建额外Run。[ports-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/ports-result.json)、[integration-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/integration-result.json)。

未来发布步骤：获准operator确认目标tenant、授权发布actor/profile、release hashes；从同artifact对应代码计算pin，校验完整manifest；仅在授权变更窗口通过受限server/operator会话发布；读取回比全部refs/digests；同版本已存在但不同内容则STOP，不覆盖不可变定义。当前没有给普通tenant admin/teacher开放publication API，也没有生产definition写入。

## 17. Production Build Artifact

**PASS（原始完整构建、固定可校验产物；不是上线证明）。** `next build --webpack`，95.31秒exit0，未使用ignoreBuildErrors。构建发生在私有副本加入fixture之前，只注入生产public Supabase构建配置，未带入生产service key/Provider key。

- Build ID：`E17_661sEdKfiul8NvQS9`。
- `.next` 非cache1376文件 canonical path→SHA digest：`0d0880c7d1468f7da74a087ba5cbc335a9dbda6897d6b0af500c8e8306b13793`。
- tar archive SHA：`55037d8983e217261fa11bc0dece86747f73ead777fe9c149281ec0ee7330b09`。
- 留存私有产物：`/tmp/uply-r3-release-candidate/candidate-build.tar.gz`，未部署。包含.next（无cache）、public、package.json、next.config.ts；不含.env或node_modules；依赖环境由lock digest固定。

原产物提取后实际Next start、flagOFF、外网fetch-deny preload下新POST404；原build字节没有被fixture替换。325 client chunks私密值/服务器实现标记扫描0命中。[candidate-build-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/candidate-build-result.json)、[exact-artifact-smoke.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/exact-artifact-smoke.json)、[client-boundary.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/client-boundary.json)。

功能ON/Auth/Tool/正式课堂测试使用另一个staging public-config + Provider-fixture构建；不能称原始产物已完成生产ON全链验证。`/tmp`为临时保留，未来先转入获准私有不可变制品库并核同SHA；若消失或任何字节变化，不能依旧报告直接部署新build。

## 18. Release Candidate Manifest

[release-candidate-manifest.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/release-candidate-manifest.json) 包含Git HEAD、2720文件开始摘要、1303 release inputs摘要、Build ID、artifact/archive SHA、baseline/cutover、六份migrationSHA、精确definition及其artifact refs、RLS迁移、四个配置名与rollout源码SHA版本。

releaseInputDigest `fee44034f0607ed838e503a28bdf5fd784224a8ede72b249c5405e349721bcdf`；范围为src/public/package/lock/Next/TS/PostCSS，报告/测试/运维helper另由最终workspace核对，不冒称Git HEAD包含未提交成果。源码没有独立rollout语义版本，因此用 `source-sha256` 标明事实。

任何源码、migration、definition、依赖、制品改变使相关Gate失效；manifest变更也需审阅重新核验。生产public配置值不输出，config/secret文件不归档；manifest不是生产执行授权。

## 19. Kill Switch

**PASS（新admission关停机制的单worker隔离实测），生产停机协调另受Drain FAIL约束。** 当前不是热开关；只修改runtime文件无法改变已有worker环境，staging已实证configFileAloneDoesNotSwitchOff=true。

可验证的行为顺序：停止旧ON listener接受新请求 → 用startupOFF配置启动替代Next在同一端口服务 → 逐个serving worker确认OFF及新POST404。旧已接纳连接可由旧进程继续有限收尾；不能把它称新serving worker已热更新OFF。当前生产只有1个serving进程，多worker未来需逐实例确认，不能沿用此次单worker证明。

演练：新POST404、extraRuns0、ownerGET200/cancel200，旧stream最终cancelled，旧请求总11.541秒；staging最终active0，尾部2.2秒新增Provider/Tool0。实际生产未替换任何进程。不能执行原样PM2 restart并保证所有慢请求安全，见§20。[operations-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/operations-result.json)

## 20. Drain Procedure

**FAIL：在生产当前15秒强停条件下未收敛。** 演练实际production-mode Next、启动时ON，Providerfixture延迟30秒；SIGTERM后15秒强杀owned process。300ms后独立harness调用现有owner-bound cancel RPC，cancel_requested_at已保存；47.021秒后仍status=running，deadline已过。新OFF实例不能让已死亡旧executor完成terminal CAS；源码status只读取，未发现自动清理该Run的后台worker/定期sweeper。

短请求成功与强杀失败均保留。最坏case不是改短deadline的模拟，也没有修改生产PM2。[operations-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/operations-result.json) / [operator-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/operator-result.json)；[run-store.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/run-store.ts) 与140002 RPC可追踪。

受阻runbook：①停止新admission并核全部serving实例OFF；②按获准tenant查询active runId/status/created/deadline；③使用已有owner-safe cancel路径或受限既有RPC请求cancel并等待；④逐Run确认durable终态、无新model/tool活动；⑤active=0后才做安全应用回滚。**当前第③→④对强杀Run失败，不能把等待45秒当成功，也不能提供未审查UPDATE修补status。** 生产kill_timeout/进程编排与崩溃后终态收敛必须另行闭环后重跑此Gate。

## 21. Rollback Exercise

**PASS（staging应用/数据库兼容回滚），全生产操作流程仍受Drain阻断。** 从真实当前known-good release源码 `/home/yangzhen/releases/uply-first-enable-20260910/source` 只读复制1258文件；sourceDigest `b1cd271291c9ff5c2f1edcdefdab7a27d959f57d461b58a0cc72cc7f7431f543`，原Build ID `LuAZe2VMY32YjOo1WvtrC`。

为避免浏览器访问生产Supabase，该旧源码用staging public配置重建（92.34秒，Build ID `6Azd86-4HgXWFeHp0TcGq`）。candidate短请求drain后停止→切换旧应用目录→startupOFF：正式课堂200，3个实际learning targets，无Agent按钮、新POST404。此为同旧源码的隔离环境构建，不宣称生产旧binary逐字节回滚已执行。

回滚前后agent_runs15、messages25、conversations15、events200，完全一致；五表及additive migrations保留。没有down migration/DROP/删除消息。强杀孤儿case在该成功回滚后单独执行，最终16runs含1孤儿，不能混称回滚删除了1run。[previous-source.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/previous-source.json)、[previous-build-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/previous-build-result.json)、[operations-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/operations-result.json)。

## 22. Operator Observability

**PASS（最小只读诊断）。** 新增 [operator-run-lookup.sql](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3/operator-run-lookup.sql)、[operator-active-runs.sql](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3/operator-active-runs.sql)、[operator-monitor.sql](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3/operator-monitor.sql)。必须由获授相应tenant范围的基础设施operator在受限SQL会话运行；current_user限制不赋予人员业务授权，tenant参数是强制过滤而非授权凭证。普通教师、学生、任意tenant admin没有该数据库入口。

run lookup返回status/version/skill、modelCall/toolCall关联、evidence/output状态、usage状态与token/duration、受限terminal code及sourceCount；不取prompt/message正文/rawToolResult/JWT/reasoning/教材全文。用 modelCallId将model.started阶段与usage连接；unknown在event中，不从缺token行推成0。

真实staging查询completed/cancelled/failed/超期running四例，跨tenant同runId均0row；缺tenant变量拒绝；authenticated角色被拒绝。active查询定位孤儿；[operator-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/operator-result.json)。没有在生产空Agent表上执行查询。pre-admission拒绝尚无runId，不能用此查询定位；没有完整所有HTTP请求的统一追踪。

## 23. Monitoring Signals

**PARTIAL：逐Run诊断可用，尚无完整生产监控与值守落地。**

| Signal | 当前观测路径 / 限制 |
|---|---|
| new/completed/failed/cancelled/active/expiredActive | tenant-scoped agent_runs aggregate；超期active必须单列 |
| deadline / required evidence missing / output invalid / Provider unavailable | terminal_reason白名单计数 + evidence/output/model事件核对 |
| unknown usage | model.usage metadata.usage.status；缺记录的model.started也需逐call核对 |
| run duration | ended_at-created_at；与receivedAt总预算起点不同，不冒称全HTTP耗时 |
| completed缺source | assistant source_refs存在性；缺失立即停止 |
| selection projection latency | 当前不持久化；只在本轮harness单独测量，不伪造历史指标 |

实测16runs：10completed、2failed、3cancelled、1expiredActive，4unknown-usage events，0completedWithoutSource。被强杀的model.started无对应usage事件，**不包含在4个unknown事件计数中**；operator须检查未配对调用。10次pin projection 1.861–1.946秒，每次16pins、288repository SELECT（另16harness auth SELECT），未接近12秒，但不是生产p95。

未来Wave1逐Run观察即可作为小范围策略；需指定值守/停止决策人、确认独立selection耗时证据和缺失usage处理。没有虚构p95/SLA、告警接收人或零成本结论。

## 24. Stop Conditions

以下为发布/值守执行条件，不是本轮已启用监控：

| 触发 | 必须动作 |
|---|---|
| 任何跨tenant/user数据暴露、raw configuration/answer泄露 | 立即关新admission，确认所有serving实例OFF；保存最小metadata；暂停Pilot |
| Agent Teaching Domain写入 | 同上，停止；不可用回答正常掩盖 |
| completed无evidence/source、output gate未通过却成功 | OFF并按runId核验；不继续第二Run |
| migration/hash/ledger/grant/policy异常 | 不执行下一步、不登记失败SQL、不启用 |
| 实际proxy整段buffer、Origin错误或断连行为不明 | 不启用；不关闭安全校验 |
| cancel/drain不能收敛、expiredActive | 不启用/保持OFF；不手工改status冒充终态 |
| Run无法按ID定位、usage调用缺失无法解释 | 暂停Pilot；核对事件/Provider完成性，不把缺数当0 |
| 非allowlist请求获admission、范围出现额外可解释lesson | OFF并重新界定Wave1 |
| Provider数据政策未批准或数据范围改变 | 不启用，不以技术测试代替批准 |

负责人是未来变更窗口必须填写的职责，不虚构姓名；当前全部生产配置继续OFF。

## 25. Provider Data Minimization

配置仍 DeepSeek / `deepseek-v4-flash` / `deepseek-tools-disabled-v1` / thinking disabled；R3 **未发任何live Provider请求**。以下“发送”指当前代码将构造的请求，以及fixture捕获验证范围。

| 阶段 | 数据 |
|---|---|
| System | base safety、student role、Kim persona style、explain Skill procedure、只读/证据/输出约束 |
| Planning user DATA | verified_selection、opaque lessonRef/segmentRef、revision、locale/sourceLocale；不预取权威原句；history明确empty |
| User question | 当前问题；UI固定“请解释这句话”，API仍有严格受限message输入 |
| LLM-selectable schemas | 两个已批准只读Tools，参数不提供任意tenant/user/SQL |
| Lesson Tool result | lesson/module title各≤200 code points、原句≤4000、最多6目标×400、contentVersion/locale/sourceRefs/completeness/truncation |
| Optional State Tool | 同一已授权本人session的最小last_saved位置投影；正式UI本轮没有session绑定，不称verified_current |

[student-prompt-assembler.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/runtime/student-prompt-assembler.ts)、[current-lesson-read-port.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/domain-ports/current-lesson-read-port.ts)、[get-current-lesson-context.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/tools/get-current-lesson-context.ts)。

白名单排除身份姓名字段、raw tenant/student UUID、完整progress、其他学生、raw node config、answer keys、全教材、adjacent/authoredExplanation、credentials。opaque refs仍可关联，不能自称法律匿名化；已发布自由文本/用户问题仍可能人为包含姓名或个人信息，代码没有通用语义PII净化保证。内容最小化不等于供应商保留/跨境政策已批准。

## 26. Provider Policy Status

**POLICY APPROVAL REQUIRED / BLOCKED。** 对项目docs/src中的Provider agreement、privacy/data-processing/cross-border/retention/organization approval词族及已读阶段材料未找到可以确认本次真实学生课程片段发送的正式批准。Architecture v1中的保留期限是建议，Stage0A/1C合成live能力测试不是许可文件。

责任方需要明确：供应商/endpoint/模型及地域、课程权利与用户数据使用范围、保留/训练用途、跨境处理、组织批准与撤回条件。批准人/批准编号/生效范围当前 **Not confirmed**。不自行做法律结论，不以阅读厂商公开页面替代组织批准；本阶段也未为此发live请求。

## 27. RLS / Agent / Classroom Regression

| 检查 | 本轮结果 |
|---|---|
| Real Full Supabase JWT/PostgREST安全 | 138项PASS；raw node/config、跨tenant、draft、enrollment、staff public/owner authoring边界 |
| 实际两Domain Ports / exact definition坏digest | PASS；user-JWT，非service-role Teaching read |
| 广泛62files | 1146tests：1135PASS、0FAIL、11SKIP |
| Core/1A–1E显式opt-in DB/Next/UI | 199/199PASS、0skip |
| Blackboard | 8/8PASS |
| baseline纯单测 / staging guards | 7PASS+3opt-inSKIP / 4PASS |
| 最新snapshot baseline-fresh + target-upgrade | 两路径6步、before/after15类等价PASS；failure stopPASS |
| Formal classroom / strict replay / deadline tail | PASS |
| 完整build / 全项目tsc(no incremental) / R3 scoped ESLint | PASS |

覆盖4A14、4A7、publication、sidebar、video、Director/runtime presentation、1EChromium；不是全部浏览器或生产性能认证。套件重复覆盖不累计造总数；live opt-in始终关闭。初次测试测量问题保留，实际运维强杀FAIL不算成测试代码异常吞掉。

最终deadline真实receivedAt到terminal45072ms、client45078ms；随后2228ms Provider/Tool/Teaching读写增量均0。最后planning开始+406ms，最后Teaching读取+364ms；slowcase无Tool，前序正常Tool/read为观测正向控制。45秒正常预算可有有限stop-only收尾，不能宣传精确≤45000ms所有I/O消失。

[tests-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/tests-result.json)、[regression-files.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/regression-files.json)、[stage1e-browser-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/stage1e-browser-result.json)、[security-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/security-result.json)。

## 28. Production Safety

生产开始/结束readonly catalog逐项一致，449ledger、Agent tables0。生产migrations/definition/AgentRun/Auth seed/DML0、真实学生Agent流量0、Providerlive0；未改unlock/content、.env、生产runtime配置、PM2或Tailscale，未部署。只有schema/aggregate read与无登录安全GET。

Agent窗口覆盖formal UI、正常/重放/取消/deadline、kill/drain/rollback/强杀演练，**79张教学/身份/catalog/progress/assessment等表前后rowcount与排序rowJSON指纹不变**，changedTables=[]；真实repository方法GET-only。seed/formal-fixture只在开始指纹前写合成数据，不把setup称零写；operator查询只读。[side-effects-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/side-effects-result.json)。

Production Writes0是本任务未发生产写操作，不是证明其他操作者或后台绝无写入。R2A migration未应用生产，不能说旧RLS风险已在线修复。私有credentials/日志/真实教材全文不入evidence。自有6个containers、1个network、2个volumes及私有stack目录已删除；Next36411已关闭；本轮1D/1E及原产物smoke三份临时副本已清理，只私有保留固定candidate归档。最终secret扫描与owned cleanup结果见 [privacy-scan.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/privacy-scan.json)、[cleanup-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3/cleanup-result.json)。

## 29. Controlled Pilot Plan

**计划冻结，NOT EXECUTED。** 当前真实名单EMPTY，没有用synthetic UUID填生产名单。

| Wave1边界 | 未来必要条件 |
|---|---|
| 1 tenant | 责任方明确批准的单一机构；active tenant授权仍校验 |
| 1 course | server解析lesson.course_id，exact course UUID名单 |
| 1 internal/test user | 已批准真实internal账户；有效enrollment/feature不可豁免；本轮不创建production用户 |
| 1 verified lesson | 真实出版链、原Policy支持、真实server pins及正式页面验证 |
| 首次请求 | 1次明确选句解释；逐Run检查Tool证据/来源/用量/终态；未审阅前不扩围 |

**当前只有tenant/course/user三名单，没有lesson allowlist。** 因此“1 lesson”不是现有服务端强制能力：需在放行前证明所选course只有一个可支持lesson，或获得另行范围约束的明确验证；仅叮嘱操作员点某一课不能当技术隔离。现在course candidate不存在，不填名单、不globalON。

四个服务端配置名见manifest；名单命中仍有StudentPolicy，不能让客户端role/organizationId/courseOverride控制授权。范围变更必须重开相关gate。

## 30. First Enable Runbook

**Runbook已形成，当前执行前置未通过；本轮不得执行。** 未来另开Stage1G并取得明确执行授权后，依序：

1. 填写变更窗口、release operator、数据政策/教学/运维审批、监控与停止决策人；确认所有critical gates关闭，含15秒强杀收敛与实际Tailscale验证。
2. 建立并确认生产备份/恢复点、known-good previous artifact、回滚访问与清理窗口；此处本轮未执行备份。
3. 核完整449ledger/cutover与最新schema，核manifest/source/build/dependency/definition hashes；任何差异STOP并重审，不能拿旧snapshot续推。
4. 仅依§13清单逐份140000→140005：preflight→apply→对象/ACL/policy验证→ledger核验→next。target不装baseline、不初始化449历史、禁止一键db push entire directory。
5. SQL失败立即停止，不能登记applied/继续/启用；SQL已commit但验证或ledger失败时保持OFF，保留实际状态交由受限operator核实，不盲目重跑CREATE。
6. 将§17完全相同SHA的候选制品放入获准release位置，配置保持OFF；所有serving worker核OFF；验证原课堂/媒体/导航及新POST拒绝。
7. 按§16发布并回读精确tenant definition；不覆盖同版本不同manifest。失败则保持OFF。
8. 配置批准的单tenant/course/internal user名单，仍OFF；核1lesson范围约束与有效原Policy、真实Pins；当前此步骤BLOCKED。
9. 完成实际HTTPS Origin/Host/scheme、间隔NDJSON、压缩/断连检查、owner-safe status/cancel、operator runId定位；无auth bypass。
10. 仅在单独启用授权和全部前置通过后让所有serving worker实际加载Wave1 ON配置；不能仅改runtime文件宣称生效。
11. 运行一条批准internal选句解释，记录runId、source、model/tool/evidence/output/usage/耗时；确认Teaching Domain零写。
12. 值守逐Run复核后再决定继续或OFF；任一停止条件按§24，执行已重新验证的§20drain与§21应用回滚；保留DB增量和Agent数据。

**当前停在第1步前，不包含可绕过审批的一键生产执行脚本。** 模型能力/政策、proxy绑定、真实内容与安全drain修复不能通过这份文档自动批准。

## 31. Gate Matrix

| Gate | Name | Status | Evidence / scope |
|---|---|---|---|
| G-R3-1 | Real Course Inventory | PASS | 19lesson只读aggregate |
| G-R3-2 | Policy-Compatible Pilot Candidate | FAIL | 0现有candidate |
| G-R3-3 | Published Script Coverage | FAIL | 1/132且父lesson锁不支持 |
| G-R3-4 | Real Pilot Selection Pin Feasibility | BLOCKED | 真实可授权pins未成立 |
| G-R3-5 | Formal Classroom Synthetic Route | PASS | formal route真实Auth/Next/Tool |
| G-R3-6 | Formal Classroom Regression | PASS | 广泛课堂+1E无失败 |
| G-R3-7 | Actual Tailscale Path Identified | PASS | 8443→3000已确认 |
| G-R3-8 | Actual Tailscale Streaming | BLOCKED | 需独立获准binding |
| G-R3-9 | Origin / Host / Scheme | BLOCKED | 下游request.url/forwarded scheme未知 |
| G-R3-10 | Compression / Buffering | BLOCKED | 实际NDJSON未测 |
| G-R3-11 | Disconnect Behavior | BLOCKED | 实际proxy断连未测 |
| G-R3-12 | Migration Inventory Locked | PASS | 6份exact SHA |
| G-R3-13 | Target Schema Migration Rehearsal | PASS | 最新schema-only双路径 |
| G-R3-14 | Ordered Migration Verification | PASS | 每步对象/ACL/ledger |
| G-R3-15 | Migration Failure Stop | PASS | 失败不继续不mark |
| G-R3-16 | Definition Publication Rehearsal | PASS | exact pin+DB坏digest拒绝 |
| G-R3-17 | Exact Production Build Artifact | PASS | 原始完整build固定；ON功能另fixture构建 |
| G-R3-18 | Release Candidate Manifest | PASS | 1303输入/版本/摘要 |
| G-R3-19 | Kill New Admission | PASS | 单worker替换OFF新POST404；drain另FAIL |
| G-R3-20 | Existing Run Recovery While OFF | PASS | ownerGET/cancel200 |
| G-R3-21 | Drain Procedure | FAIL | 15秒强杀后超期running |
| G-R3-22 | Application Rollback Exercise | PASS | 旧release源码staging重建回滚PASS |
| G-R3-23 | Agent Data Preservation | PASS | 15/25/15/200四表counts原样保留 |
| G-R3-24 | Operator Run Lookup | PASS | 四Run+跨tenant/role负向 |
| G-R3-25 | Monitoring Signals | PARTIAL | selection耗时未持久，值守未落实 |
| G-R3-26 | Stop Conditions | PASS | 触发/行动/禁止启用明确 |
| G-R3-27 | Provider Data Minimization | PASS | 当前safe projections已核，不代替政策 |
| G-R3-28 | Provider Policy Approval | BLOCKED | 无责任方批准证据 |
| G-R3-29 | RLS Security Regression | PASS | 138 real JWT checks |
| G-R3-30 | Teaching Domain Zero Writes | PASS | 79表指纹无变化 |
| G-R3-31 | Production Ledger Unchanged | PASS | 449→449 exact |
| G-R3-32 | Production Writes Zero | PASS | 本任务生产DML0 |
| G-R3-33 | Production Feature Flag OFF | PASS | startup config OFF，三名单EMPTY |
| G-R3-34 | Pilot Allowlist Plan | PARTIAL | 3名单技术支持；1lesson尚无可证明范围 |
| G-R3-35 | First Enable Runbook | PASS | 完整顺序+STOP规则，执行前置明确受阻 |

状态只对该项明确范围成立。R3-2/4/8/9/10/21/28等critical未通过；R3-34即使计划可写也不能把1lesson技术范围标PASS。总体不能选“OPERATIONS READY”，因为实际运维drain还有FAIL。

## 32. Architecture / Operational Deviations

| 原期望 | 当前证据 / 限制 |
|---|---|
| 配置OFF立即跨worker生效 | 启动时注入；需listener停止/实例替换/逐实例验证 |
| 等45秒即可安全回滚 | 当前PM2先在15秒强杀，持久cancel不能自行终态；无已证实reconciler |
| 一份build完成全部E2E | 原始生产public-config制品已冻结/离线OFF smoke；ON功能通过单独staging fixture构建，不混称字节相同 |
| 回滚同production binary | 实际known-good源码为staging public配置重建；生产binary未操作 |
| 当前课程内容可直接Pilot | 0candidate；只有synthetic formal route支持 |
| 一课程名单即一lesson | 实际无lesson名单；范围还需证明 |
| Operator metadata齐备=完整observability | 单Run可定位；pre-admission/selection耗时/缺usage/值守仍有限 |
| 六层/架构建议等于实现事实 | 只用实际代码和运行结果；未实现memory/verified_current/新Tool或Skill |

没有通过修改Policy、RLS、Prompt、Provider或测试断言的产品语义来让上述限制消失。

## 33. Remaining Blockers

| 优先级 | 阻断 | 关闭证据要求 |
|---|---|---|
| Critical | 0真实Policy-compatible lesson；无真实可用Pins | 教学团队正式authoring/publish且保持原unlock；真实支持页面、用户资格/Pins及单lesson范围验证 |
| Critical | 实际Tailscale stream/Origin/compression/disconnect未验证 | 另行获准安全binding后实测，不能用privateTLS替代 |
| Critical | PM2 15秒强杀可留下expired running | 安全停机/崩溃收敛实际修复与同场景重验；当前只报告不改产品或生产配置 |
| Critical | Provider policy未确认批准 | 有责任方、版本、生效范围的明确批准；能力测试不抵扣 |
| Operational | Wave1名单/值守/selection耗时/缺usage策略未落实 | 明确人员与观察方式，逐Run完整性、准入lesson范围；不能编造生产p95 |

当前原始artifact还没有生产ON全链资格；任何为关闭阻断的release输入改动都使相关manifest/gates失效，须重新固定制品验证。

## 34. Stage 1G Readiness

**NOT READY。不允许自动进入Stage1G。** 本轮满足的是多项synthetic技术和运维证据，不满足真实内容、实际网络、drain与数据政策的生产Pilot条件。

即使以后这些Gate关闭，也必须另开Stage1G并获得用户明确执行授权，才可能生产migration/deploy/definition/allowlist/first enable。本报告与runbook本身不是该授权。

## 35. Final Recommendation

**NO-GO。** 保留已经验证的真实user-JWT Domain、safe projection、Tool/evidence/output、fenced persistence/replay及完整build。当前不适合生产Pilot，尤其不能用“关flag”替代被15秒强杀后的Run终态收敛。

本阶段结束保持：Production Migration NOT APPLIED；Feature Flag OFF；Allowlist EMPTY；Production Writes0；Teaching Domain Writes0；Production Ledger449 unchanged；Live Provider Requests0。完成报告、证据与隔离环境清理后停止，不部署、不改真实课程、不进入Stage1G。
