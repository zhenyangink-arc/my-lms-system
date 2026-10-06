# Explain 单目标只读资格核对：目标与读取入口准备

Task：`EXPLAIN-TARGET-READMETHOD-PREPARATION-01`；静态查阅日期：2026-10-02（Asia/Seoul）。

**本轮完成了有限目标定位和读取器核对；生产资格仍 NOT VALIDATED，执行请求仍 NOT RUNNABLE。**
新增定位结果是：历史部署回执有精确 Build、PM2 名称与日期；历史教学候选有 course/lesson ID；新核对的制品生成器、全韩语目录查询和 Student 内容读取器均不满足本次只读投影。不是再等待一个泛化“生产读取批准”就能执行。

沿用 [已接受交接](ASSISTANT_AGENT_HANDOFF.md) 和原 Gate，不重写历史结论。学生选择一个已发布韩语课时的一句、Explain 返回真实来源与终态仍为首交目标。Explain 会写 Run/usage/trace，并向 Provider 发数据。

## 已定位目标及其证据资格

| 记录 | 精确候选值 | 时间与来源 | 本次可用性 |
|---|---|---|---|
| 历史 worker / release | PM2 `uply-first-enable`；cwd `/home/yangzhen/releases/uply-first-enable-20260910/source`；HTTPS :8443 → 127.0.0.1:3000 | R3 文档 L99–101，报告日期 2026-09-14（L15）；来源 S1 | 历史定位。今天的 worker/cwd/实例集合未知；旧 PID 不复用 |
| 获准历史部署 | Build `PjpaYHAz0asyvwh0G-lBo`；PM2 `uply-first-enable`；rollback `/home/yangzhen/operations/uply/teaching-agent/r7d-b/20260918T020821Z/rollback` | 部署回执 L4–6、10–18；startedAt `2026-09-18T02:08:22.456074+00:00`，deployedAt `2026-09-18T02:08:24.336363+00:00`，completedAt `2026-09-18T02:18:20.343458+00:00`；S4 | 已获准部署的历史复用候选；不是今天 serving、完整闭包或恢复能力证明 |
| 内容准备对象 | korean-beginner / hangul-introduction；course `2f79a679-6e25-4cf9-9f71-455905584787`；lesson `6ad20a2b-2306-4173-9d3f-73eb9691ff58` | R3 L70–83；2026-09-14；S1 | 明确“不是已批准 Pilot Candidate”，当时 publication 链缺失。不能填成当前 target；没有 student/module/node/snapshot/segment 绑定 |
| 不合格既有 lesson | basic-pronunciation，lesson `26fd3e57-e6cf-4df9-8514-646786f61e1d` | R3 L59–63；2026-09-14；S1 | 当时 prerequisite 不满足，不能借它绕过 Policy |
| sealed C3A candidate | Build `KeQ6bud_Us1ED6hnG7YB8`；143 路径部署闭包 | C3 文档 L365–381；该段未给独立精确观察日期，不能补造；S3 | candidate，C3B NO-GO 保留。L375 记录缺安全 QA Student 与目标；不能自动选择为新 release |

S4 的 `currentBuild`/`pm2=online` 是该回执时间内的词义；本文件不把它改成 2026-10-02 观察。S3 的后续 retained Build/OFF/EMPTY 也不升级为 fresh 事实。

## 暂停期间最新记录：实际对外目标尚未确定

[学科模块交接](HANDOFF-subject-modules-2026-10-01.md) L6–20（S12，2026-10-02状态更新）记录：main合并/推送到 `bcfa177`，触发 Vercel 和 Cloudflare `Workers Builds: lmssystem`；Cloudflare构建开始于 `2026-10-02 00:42:07 UTC`。此前 `8cf9726`（2026-09-29）与 `d43564f`（2026-09-30）两次推送在两边构建均失败；本次两构建在记录观察点 `2026-10-02 01:08 UTC` 尚无结果，哪个环境真正面向用户也未核实。以上是文档报告，**不是当前live proof**；没有重新查远端、构建或服务。旧 `uply-first-enable` PM2只是一个历史候选，不能默认其仍是本次实际服务目标；Vercel/Cloudflare也不能凭构建记录推定已上线。

同段还报告历史源码锁有153个路径不一致（135修改、18删除），另有27个此前已不一致。此处未fresh验证这些数字，未读取或重写锁、未构建。暂停期间的记录必须先纳入目标关联，不能把最新提交全部视作无关；它仍不证明Explain制品闭包或当前资格。

2026-10-03纠正：此前漏用了已交付入口，要求用户再提供网址是错误的。已知入口为 `https://kmgwak-system-product-name.taila18cd5.ts.net:8443`（HISTORICALLY_DELIVERED_ENTRY）；[正式部署结果](TEXTBOOK_GRAMMAR_DEPLOYMENT_RESULT.md) L3、7、13（2026-09-13）、[R3](teaching-agent-stage-1f-r3-production-operations-gate.md) L99–105 与 [R7D-A](teaching-agent-stage-1f-r7d-a-lesson-tool-durable-facts-audit.md) L199–205 记录同一入口及历史 release 对应。无需再向用户索要该网址。历史入口不证明当前可达性、服务映射或加载版本；当前target/worker和所有a–g资格仍null / NOT VALIDATED。

## 有限读取器核对：参数、投影、过滤和上限

本轮新增查阅仅五件直接相关文本：部署回执核 a/e 定位；R3 文件表直接列出的 `release-manifest.mjs` 核 a/d；同表的 `production-inventory.sql` 核 c；R3 直接链接的 Student repository 与 lesson read port 核 c。原因与具体限制在下表。没有继续扫描历史归档或其它运维源码。

| ID / 已有入口 | 精确参数 / 本身过滤 | 本身输出与可证明上限 | 本次判定 |
|---|---|---|---|
| M1 [release-manifest.mjs](../scripts/teaching-agent-r3/release-manifest.mjs) L1–41，S5 | cwd=源码 root；argv[2]=disposable `d`，argv[3]=`out`；要求 state.marker=`uply-teaching-agent-r2-disposable-v1`，build.exit=0、instrumented=false；固定旧 baseline/cutover，不接受 target/worker 参数 | 遍历全部 src/public 和构建配置、读取迁移与 archive；输出 build/artifact/definition hashes 等；无单目标读取上限；创建目录、复制 archive、写两份 manifest；import runtime definition | **不合格**。这是离线制品生成器，含 runtime import 与写入，不能当现况只读 reader；删掉写入或抽函数是新实现 |
| M2 [production-inventory.sql](../scripts/teaching-agent-r3/production-inventory.sql) L1–34，S6 | 无 psql target 参数；student_apps.slug='korean' → 全部关联 courses/lessons；BEGIN READ ONLY | 所有 course IDs/slugs/publication/unlock，全部 lessonCoverage、unlockCounts；无 course/lesson 精确过滤、无数值行上限、无 statement_timeout；不读 Student 明细 | **不合格**。实际范围超出唯一目标；不能执行后筛掉跨课数据 |
| M3 [Student repository](../src/features/teaching-agent/server/repositories/supabase-student-teaching-repository.ts) L24–160，S7 | `readAuthorizedContent(identity, locator, execution)`；identity actorId/tenantId；locator lessonId/moduleId/nodeId/segmentIndex/locale 等；原 user SSR client；按精确 ID/tenant/publication/enrollment 过滤；execution signal/deadline | `one()`：latest 每查询最多1行，其余最多2行以拒歧义（L29–36）；类别祖先最多8层（L60–67）。读取身份角色、标题/objectives 与整节点 teacher_script/segments（L126–138）。**无 metadata-only 参数** | **不合格**。它是合法学生业务读，但本次禁止教材正文/学生身份读取；每查询1/2行不等于总输出只含 pins/hash/布尔。不能 import 调用后删字段；也不统计 course 可支持 lesson 数 |
| M4 [lesson read port](../src/features/teaching-agent/server/domain-ports/current-lesson-read-port.ts) L7–45，S8 | `createCurrentLessonReadPort(verifier, trace).read(input, authority, execution)`；要原 binding authority、verified_selection、lessonRef/segmentRef/revision，且 revalidate | lessonTitle/moduleTitle 各≤200 code points，originalSentence≤4000，objectives≤6×400；sourceRevision/sources；trace 使用 runId | **不合格**。截断上限确实存在，但输出正文并依赖 binding/runtime context，不是零 Run 资格投影入口 |
| M5 [operator-monitor.sql](../scripts/teaching-agent-r3/operator-monitor.sql) L1–29，S9 | tenant_id / since；tenant + created_at>=since；current_user 在固定 operator role 列表；READ ONLY / 5秒 timeout | 固定 JSON aggregate **1个顶层结果行**；tenant 时间窗 active、terminal、usage/source/duration；底层扫描数量无数值上限 | 已知不合格用于 g：不能证明全时段唯一 target active=0；不重复发现或借部分适配声称全项合格 |
| M6 [operator-active-runs.sql](../scripts/teaching-agent-r3/operator-active-runs.sql) L1–10，S10 | tenant_id；active status；role列表；READ ONLY / 5秒 timeout | Run IDs/status/time，**无行上限**、无 course/lesson/count-only | 已知不合格；不先执行后计数 |
| M7 [operator-run-lookup.sql](../scripts/teaching-agent-r3/operator-run-lookup.sql) L1–28，S11 | tenant_id / run_id；role列表；READ ONLY / 5秒 timeout | 逐 Run 结果及 events/usage arrays；脚本无明确 LIMIT，内层数组无数值上限 | 本次不需要 runId 审计；不以唯一 ID 推成所有嵌套输出有界 |

C3B `capture --plan acl-000-v1` 已在原请求和交接中排除：维护 authority/receipt 写入、protected catalog 及 READY/授权 guard 不是本次投影。这里直接沿用，不重读 runner 或私有 authority。
数字“1/2行”“8层”“200/4000/6×400”“5秒”是源码合同；不得拿它们替代七类资格请求的总记录上限。未来希望“一份目标摘要、最多一条 release 身份”的上限是**提议值**，尚无合格实现证明。

## a–g 精确绑定或阻塞

各行的当前 target/worker、operator、window、authorization_ref 均为 **null / HOLD**。只记录历史候选。没有将文件可读、role白名单、历史部署许可或用户“继续准备”当生产读取许可。

| 类别 / 必要读对象 | 候选与直接来源 | 现有入口 / 精确缺失 | 未来最小投影、过滤与上限 | 分开的阻塞 |
|---|---|---|---|---|
| a release / Explain 闭包 | S1 L99–101；S2 L199–205；S4 L4–18；历史 R7D-B 首选复用 candidate | M1 不合格；S4 是已有静态回执，可引用不能 freshly核 serving。有限入口内未找到当前 serving identity + sealed closure 的安全 reader | 单获准 release；opaque target/worker、Build ID、archive/manifest/Explain入口/import closure/依赖/config身份 hashes、release/security ref/匹配结论。过滤 target+release；总上限 **null**（提议1份摘要，worker数须有来源） | **TARGET_CURRENT_RECORD_MISSING + READER_MISSING_FOR_CURRENT_PROJECTION + AUTH_WINDOW_MISSING**。具体部署路径可定位，今天关联缺失 |
| b ledger/RPC/artifact/ACL | S3 L385–391、426、449；known `review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean)` service_role ACL 差异 | M5–M7只读Run，完全没有 catalog 投影；已排除C3B capture；有限查阅未找到本项可复用入口 | 单精确DB/release；ledger prefix digest/version presence；admission/status/events/usage/completion/cancel及artifact1相关 RPC signature/body hash/owner/ACL，constraint/RLS指纹和兼容、安全结论；对象签名/版本白名单须绑定release；上限 **null** | **DB_TARGET_BINDING_MISSING + READER_MISSING + SECURITY_DISPOSITION_MISSING + AUTH_WINDOW_MISSING**；不执行 RPC、不读body、不装migration |
| c 单目标 Policy / publication / pins / 一课范围 | S1 L67–80历史准备ID；S3 L375仍TARGET_PROVISIONING_REQUIRED | M2越界；M3/M4读取正文且无 metadata-only mode；没有合格零正文资格reader | 单tenant/course/lesson/internal Student；enrollment/publication/Policy布尔，revision/snapshot/segment pins/hash，course可支持lesson数或已验证等效服务端约束。精确locator缺失；上限 **null**（提议1份摘要） | **ELIGIBLE_STUDENT_AND_PUBLISHED_TARGET_MISSING + READER_MISSING + AUTH_WINDOW_MISSING**；不是 permission-only。建立/发布目标是独立写任务，当前不授权 |
| d definition / scope / 全worker OFF | S1 L318–326：三allowlist但无lesson名单；S2 L295历史OFF/EMPTY；M1 L34–38仅静态配置名 | M1没有当前DB definition/loaded flags投影；不能读runtime.json/env、PM2全输出后过滤；有限查阅未定位逐worker安全摘要入口 | target+definition version/digest，status/scope-match，allowlist cardinality/match布尔，全serving worker loaded OFF；精确worker集合过滤；上限 **null** | **CURRENT_WORKER_SET_AND_DEFINITION_BINDING_MISSING + READER_MISSING + AUTH_WINDOW_MISSING**。不能拿一实例历史记录证明今天所有worker OFF |
| e recovery / known-good / restore权利 | S4 L3–4明确rollback目录；S2 L205；原Gate §3–4 | 回执rollback是应用部署历史，不含合格snapshotStart/restore PASS/RPO/有效权限；本范围无恢复摘要reader。不得读取该目录备份或凭据 | 单target/recovery opaque ref、snapshot时间/manifest hash/restore结果、known-good hash/兼容范围、RPO/负责人/有效restore授权ref；上限 **null**（提议1份摘要） | **RECOVERY_EVIDENCE_BINDING_MISSING + SUMMARY_READER_OR_OWNER_ATTESTATION_MISSING + AUTH_WINDOW_MISSING**。C3B选中时保留≤900秒与exact target/catalog/package/provenance，旧rollback路径不满足 |
| f Provider范围 / budget | S1 L261–285为静态数据边界和政策未批准记录；交接L94–96为预算候选 | 非秘密责任方摘要是必要外部输入；源码预算/提案不是有效批准；不搜私有policy正文、不调用Provider | 单release/target：有效批准ref，Provider/model、字段/教材/user范围、optional state、自由question界限、tool results/metadata/同Run后续回合、期限/负责人、cost/token/tool/time上限和enforceability ref；上限 **null**（提议1份摘要） | **VALID_POLICY_BUDGET_SUMMARY_MISSING + RELEASE_ENFORCEABILITY_BINDING_MISSING**；窗口/摘要提供方权限也为null；不要求用户发密钥 |
| g stop / active count | S1 L7、L95–123、L241–255；真实proxy/Origin/断连未核，15秒强杀历史失败 | M5时间窗active不够，M6泄露ID且不限行，M7不必要；无符合target/count-only/全时段的已有入口 | release/target匹配stop/drain/proxy/Origin/stream证据ref/结果；全时段target active count，责任人/窗口/阈值；过滤精确target，active聚合提议最多1行但已有实现 **null** | **TARGET_BINDING_MISSING + ELIGIBLE_COUNT_READER_MISSING + MATCHING_STOP_EVIDENCE_MISSING + AUTH_WINDOW_MISSING**；仅观察，active>0 HOLD，不cancel/kill |

这是**限定上述记录与入口的缺失结论**，不声称全仓库、外部运维系统或所有授权人均无reader。各类当前事实均 NOT VALIDATED；没有合格全项读命令，因此不填伪可执行命令或占位符。

## 唯一下一动作：取得现存 release 单目标摘要

已知入口及历史 release 路径足够完成下述单文件观察，网址缺失不再是阻塞。后续当前 serving 关联仍需单独指定的核对或现存非秘密发布记录；由 Supervisor / 用户授权的操作员（目前角色未绑定）整理**现有记录**，继续核 a 的目标绑定；不要求用户自造 binding，也不把它扩成七类重新研究。技术摘要应由获授权的代理/操作员整理，不要求管理此服务器的用户手工制作 binding；当前没有已确认的外部运维团队。只从已持有、允许共享的最新部署记录提取；本轮未联系或要求任何人执行生产操作。

已有具体参考记录是 [R7D-B deployment-receipt.json](evidence/teaching-agent-stage-1f-r7d-b/deployment-receipt.json)，S4；它能提供 schema 与历史候选值。所需新摘要最多 **1份**（提议上限），私有保存，不含帐号/正文/env。字段必须为：

| 最少字段 | 已有候选值 / 处理 |
|---|---|
| 最新记录 reference、SHA256、部署时间、记录所断言的有效时间/环境范围 | S4 SHA见下；历史完成时间2026-09-18；**最新记录 ref/hash/time=null**。只给旧S4则保持HOLD |
| opaque serving target ref、deployment root、PM2 name、worker集合来源ref及数量 | root历史 `/home/yangzhen/releases/uply-first-enable-20260910/source`，PM2历史 `uply-first-enable`；**当前映射/集合ref/count=null**。不输出PID或完整进程/env |
| Build ID、sealed manifest/archive/完整source closure references与hashes | Build历史 `PjpaYHAz0asyvwh0G-lBo`；S2 L183–184有旧candidate build/source archive hash；**当前sealed关联=null**。8 EXACT不足以证明完整binary closure |
| 当次读取者/可提供摘要者角色ref、有效权限ref、可用窗口 | 全部 **null**，由有权操作员从现存权限记录给非秘密摘要；不索要私有批准正文 |
| 可用的既有安全reader准确路径/函数、实际限定参数/输出上限；或明确“未持有” | 本轮核对结果M1不合格；**eligible reader=null**。不要求操作员新写脚本或查生产补空 |

操作员如只持有历史记录、没有当前serving关联，输出 `CURRENT_RELEASE_BINDING_NOT_AVAILABLE` 并停止。这是准确外部依赖，不能把补摘要写成已能完成的生产核对。

本次指定 BUILD_ID 单文件观察无需先实现通用 reader；此前独立 reader 提案不再是立即前置。此观察只确认磁盘 installedBuild，完整 sealed closure、当前 loaded worker 关联及其余六项仍缺有效证据，所有七项资格保持 NOT VALIDATED。后续进程或 HTTP 核对须另行明确范围；本次未执行。

## 有限顺序和停止条件

1. 本准备已交付：候选、限制、精确缺口与来源；独立verifier静态核对后Supervisor审核。没有重跑旧测试或旧Gate。
2. 已知网址不再阻塞。下述单文件磁盘观察已完成；下一步仅需单独指定当前 loaded/serving 关联的核对或整理现存 release 摘要。当前关联缺失仍具名保留，不以新通用 reader 或再询问网址为立即前置。
3. 已有入口及精确target/投影/filter/数值上限/operator/window/auth ref齐备后，Supervisor可提交具体**另行批准**的只读操作；这一步目前无法生成。不能运行占位命令、先完整导出后过滤、为补空读生产或秘密。
4. 后续资格观察仍一次固定a–g；任一未知、来源漂移、越界输出、授权/窗口不足或active Run即HOLD并记录原因。所有适用条件通过后才另准备First Enable/ON、Provider数据与费用、单次Agent Run批准。

C3B NO-GO、practice-binding ACL有权关闭/范围结论、Student Policy/同snapshot pins、一课技术限制、合法恢复与stop门禁完整保留。SESSION未来后置仍要求旧release/schema可用、无C3B依赖、适用安全门禁依法处理、独立合规恢复流程全部成立；当前 UNKNOWN。若选C3B，既有exact fresh backup/restore/provenance链不被本方案豁免。无ON、Provider、Agent、SQL/DB、runtime/tests、网络或服务操作。

## 持久来源绑定

以下 SHA256 于本次标准库静态读取直接计算。原临时输入已与完成Task/交接记录的expected hash核对；S1–S3与原Gate/准备 SourceHashes相同。源码日期为本次2026-10-02静态快照，不是部署日期。

| ID | 路径 | SHA256 |
|---|---|---|
| S0 | docs/ASSISTANT_AGENT_HANDOFF.md | `19494beb5fe1d5b0bebdb9c7158bed9d1d23d90aca6321c8a52d28d0df7102be` |
| S1 | docs/teaching-agent-stage-1f-r3-production-operations-gate.md | `bb66925861eb3e0e6bd1a5d75329452179f0cd5d226282adfe6a4c47dcc00e8e` |
| S2 | docs/teaching-agent-stage-1f-r7d-a-lesson-tool-durable-facts-audit.md | `af3a517a8ecdfbf6999773cf6c386b8d0201fcbb8822ed832e5c35b90b64f64f` |
| S3 | docs/teaching-agent-stage-1f-r7d-c-skill-tool-binding-audit.md | `dd12eb4e2ae503394061a3c11e6cee14f2c57b0d25fbe668c758fd5b7ac1a6c2` |
| S4 | docs/evidence/teaching-agent-stage-1f-r7d-b/deployment-receipt.json | `0f9d1162ab623702eb3c4836ce3f8a82057762cabc70fda7f76483f86f0d90eb` |
| S5 | scripts/teaching-agent-r3/release-manifest.mjs | `705c754a888c221a1c9e42ef4123fecc03701f53eba9dc52dc72294dc1ab3e0b` |
| S6 | scripts/teaching-agent-r3/production-inventory.sql | `d58544306de9e9c161417aa5921e3415aae6a769f66e52ef057a6081509facf3` |
| S7 | src/features/teaching-agent/server/repositories/supabase-student-teaching-repository.ts | `12c38a4bdd7318b98cbbc8735df101f06074eabb77744a7e2670f15c7afb457e` |
| S8 | src/features/teaching-agent/server/domain-ports/current-lesson-read-port.ts | `0cfefa45b837a4779be7376c67715f2a164b31d758b26de54078331b7b325659` |
| S9 | scripts/teaching-agent-r3/operator-monitor.sql | `e4b6b0f8971906e47ea254c88b7c3b82cc7887bdc395db0dd3fcf95e2f96a131` |
| S10 | scripts/teaching-agent-r3/operator-active-runs.sql | `132f08054915df1247d67df32fe0260339148c8a0b0bdad626c4f16af363d370` |
| S11 | scripts/teaching-agent-r3/operator-run-lookup.sql | `c86d12fc4ec53b96f89e9cc98fc71841a2e5a9f6c1bff751fa395560ab9532e9` |
| S12 | docs/HANDOFF-subject-modules-2026-10-01.md | `d2ecc2f99a3683d4a35867ef7ca518f18a538f12a3db2b0856022104bd8a3481` |

原已接受输入（机器本地临时文件，essential结论已在本文件落盘，不依赖它们永久存在）：

| 输入 | 原 SHA256 / 本次匹配 |
|---|---|
| GateReport.md，/tmp/explain-first-use-gate-B1QE9dvY | `6790252d9fe2131a1e930e064ae996737d4bf93f4efe6ab3d685fdf9691ef25f` MATCH |
| 同目录 SourceHashes.txt | `e55fd2ad34973b17c371581ea0954561afb86c9f1e6943fe703a11bc56fd9911` MATCH |
| ReadOnlyQualificationRequest.md，/tmp/explain-first-use-preparation-mf7u65_t | `c7c6eedfa72af1803c7b0d0ebfec6d7a0da40b72a94ee4c78688a768b8f6ffd3` MATCH |
| 同目录 LaunchGapMatrix.json | `43d746e13fbdc2aadf7d14de984e37b1a7b9309d6496f2cf5280916756acbdcd` MATCH |
| 同目录 SourceHashes.txt | `e422e4ae35427e0919abf396023ff891bb11b0f8851fb6741c9839268202d043` MATCH resume记录；不是重审全部底层来源 |
| VerificationReport.md，/tmp/explain-first-use-verify-rqmw8p6x | `9ef01c7babf127515ce81fa9b5e6f06e3eaa46aa4eb4f9c3f39a70eeb85a9352` MATCH |
| resume WorkerReport.md，/tmp/assistant-resume-state-p3ke0KoV | `fc2be845bdbb382b70f3632ae5efdbd332a754543fec8bfd99b870c08d510a3b` MATCH |

**完成范围：准备文件与私有静态绑定/报告；执行 BLOCKED，当前资格 NOT VALIDATED。** 未修改交接、历史、源代码、Task/authority；不声明整个共享工作区未被他人修改。静态检查与产物SHA见对应Worker Report；独立验证由Supervisor另行调度。

## 2026-10-03 单文件观察（EXPLAIN-URL-CORRECTION-RELEASE-METADATA-01）

观察时间：`2026-10-03T04:26:56.262946+00:00`（UTC）。仅沿逐目录 `O_DIRECTORY|O_NOFOLLOW` / `dir_fd` 安全打开 `/home/yangzhen/releases/uply-first-enable-20260910/source/.next/BUILD_ID`；最终文件 `O_RDONLY|O_NOFOLLOW|O_NONBLOCK`。一次 attempt、一次内容 read，成功1、失败0；读取21 bytes，大小上限256 bytes（单次 read cap257），ASCII token 格式有效，前后 dev/inode/size/mtime_ns 一致。

磁盘 **installedBuild=`PjpaYHAz0asyvwh0G-lBo`**，与2026-09-18历史 Build 相同；文件 SHA256=`b8d14107c79e66491bbb8ce920f4963882aa2756a206caee18fe7a4105bd5b12`。这只证明指定磁盘文件值，不证明当前进程 loadedBuild、网站 available、完整闭包或 Agent 已启用。全部 a–g 资格仍 **NOT VALIDATED**。下一步当前进程/HTTP/安全核对需另行明确范围，本次未做。

实际 live-host release metadata 内容读取为 **1次**（不是生产读取0）；DB/业务数据/网络访问、runtime target 写入均0。没有读取 env/runtime.json/其他 release 内容、进程或调用服务命令。私有观察代码、stat/时间/hash receipt、精确文档 diff 与 WorkerReport 位于 `/tmp/explain-url-release-metadata-pwhphipp/`；Verifier 审核这些已保存证据，无需再次读取 host 文件。
