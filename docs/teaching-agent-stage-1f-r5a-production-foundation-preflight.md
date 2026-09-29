# UPLY Teaching Agent — Stage 1F-R5A Production Foundation Preflight

## 1 Executive Summary

**Overall: CONDITIONAL。Production Foundation Technical Package: PARTIAL。Production Execution Authorization: NOT GRANTED。Stage 1G: NOT READY。**

Production identity、449条 ledger/latest `202609130003`、8份 migration、baseline、R3D frozen artifact/source 和 R4F operator bundle 均匹配锁定值。没有发现需要触发 `PRODUCTION STATE CHANGED` 或 DRIFT STOP 的证据。开始观测：`2026-09-15T09:50:34.738605+00:00`；结束观测：`2026-09-15T10:09:25.248324+00:00`（UTC）。开始/结束复核见 [production-preflight.json](evidence/teaching-agent-stage-1f-r5a/production-preflight.json) 与 [production-end-state.json](evidence/teaching-agent-stage-1f-r5a/production-end-state.json)。

PARTIAL 源于执行工程的实质限制：历史 migration runner 绑定旧范围，000–007 的受限适配及隔离核验尚未完成；维护凭据的权限/有效期尚未确认；旧应用在保留005新权限后的回退兼容性未单独演练。它不是因 window、standby 或签字待定而判 FAIL。迁移与归档本身 LOCKED。本报告已经完成本阶段要求的只读调查、计划和未签署授权模板，不实施这些适配。

本任务 Production DB Writes=0、Migration=NOT APPLIED、Deploy=0、PM2/runtime/Tailscale未改、Feature OFF、allowlists EMPTY、Agent Runs=0、Live Provider Requests=0、生产内容未改。0 是本任务操作边界；不声称对全站其他正常活动做了流量或业务数据审计。

## 2 Scope

本阶段只读 catalog/ledger、文件/归档、Git 状态、PM2 whitelist、Serve status 和已安装 PG17 client version。完整阅读 R4G/R4F/R4D/R4A/R4、operations runbook/roles、release/baseline/candidate metadata 与000–007原文件；当前文件 hash 见 [input-locks.json](evidence/teaching-agent-stage-1f-r5a/input-locks.json)。当前源码、原归档与真实只读状态优先于历史描述。

生产数据库使用既有只读调查连接、TLS verify-full、PG17.6 Docker client，固定 `REPEATABLE READ READ ONLY`、statement_timeout15s、lock_timeout2s、最终ROLLBACK；仅 catalog与migration ledger。未枚举学生、tenant成员或内容，未调用任何业务/Agent/reconciler RPC。临时私有连接文件由既有 helper 在 finally 清理；未创建新的生产维护 credential，未保存 URI/password/JWT。

仅新增本报告、授权模板、R5A evidence 和两份只读 helper。没有执行 apply/deploy/backup/restore/reconciler/cancel/provider/测试binding/生产浏览器操作。没有运行会写 fixture 的 production smoke/e2e。仓库原有 dirty files 保留，范围核验见 [workspace-scope.json](evidence/teaching-agent-stage-1f-r5a/workspace-scope.json)。

## 3 Current Production State

| 项目 | 当前观测 / 与R4G比较 |
|---|---|
| PostgreSQL | 17.6 / MATCH |
| Project identity SHA256 | `cad8258f794d075042a59e5df2217f60173e29fbe15a2bf4b3324360d79df673` |
| Host identity SHA256 | `33fa58605f9a47d2e80d4304fbd939405198c3be83a78743d878dd1d665041b5` |
| Ledger count / latest | 449 / 202609130003 |
| Full ordered ledger SHA256 | `d864066c601dd9b7e60144773f34eb456f035cbae9dec114a716048fa5151981` |
| Agent migrations / public Agent tables | 000–007 NOT APPLIED / 0（五目标表及agent_前缀表均0） |
| Feature / allowlists | OFF / TENANTS、COURSES、USERS 均 EMPTY |
| PM2 | uply-first-enable / online / fork_mode / instances1；PID、uptime、restart count 与R4G及首尾一致 |
| Runtime hash | `7a4b31b099fb968dd1105f8fbc67b946ae3fa79c30873998f8864ef1578878c8` |
| Launcher hash | `30c81ade417866170cb3c3b3dd1cf9477cb033c9c3c0be363674c0f92eed0039` |
| Serve config canonical SHA256 | `b33a37027b06f50f17d82a983f9c89ff342ca1fc94d58d0908c4e6bbeb83d256` |
| Serve bindings | 443→127.0.0.1:3001、4000→127.0.0.1:4000、8443→127.0.0.1:3000；9443 absent；Funnel false |
| Known-good Build | `LuAZe2VMY32YjOo1WvtrC` |

Full ordered ledger hash 的输入是 version/name 按 version 排序的完整数组，以 sorted-key compact JSON（ASCII escaped）计算；不是只比较最后一条，也不是所有历史 SQL statement 的 hash。baseline ledger **文件字节hash** 是另一指标，不可混淆。客户端 TLS1.3 verify-full 实测成功；server backend TLS catalog显示false，不能把客户端到连接入口的TLS证据扩写成每一跳TLS已证实。

未来任何 identity、ledger、对象、artifact/manifest/source/operator/runtime/launcher/binding 异常变化：**STOP → PRODUCTION STATE CHANGED 或 DRIFT → REPLAN**。不沿用449/457旧计划。

## 4 Migration Package Lock

来源：[R4A manifest](evidence/teaching-agent-stage-1f-r4a/release-metadata-manifest.json)、[baseline manifest](../supabase/bootstrap/baseline-manifest.json)。`postBaselineMigrations`及版本索引均恰好8份；当前 migration目录 cutover之后也恰好8份。顺序、文件名和当前SHA均与锁定manifest一致。

| Version | Filename（supabase/migrations/） | Current SHA256 | Locked SHA256 | Result |
|---|---|---|---|---|
| 202609140000 | `202609140000_agent_core_foundation.sql` | `7abc5545f6cb926c37a74a890fc6fcdbad4f89a5c35474a4628af67b7e0afa8b` | `7abc5545f6cb926c37a74a890fc6fcdbad4f89a5c35474a4628af67b7e0afa8b` | MATCH |
| 202609140001 | `202609140001_agent_runtime_completion_evidence.sql` | `a0ece84b6030f029ff68781e3dcffa73e5d7ea2448c33c750ff76c1098f3456b` | `a0ece84b6030f029ff68781e3dcffa73e5d7ea2448c33c750ff76c1098f3456b` | MATCH |
| 202609140002 | `202609140002_agent_run_cancel_request.sql` | `a8c0d60432a39f08dd45cea08b7ea0e6565885a8d0a65d15118c1f093dc9fb62` | `a8c0d60432a39f08dd45cea08b7ea0e6565885a8d0a65d15118c1f093dc9fb62` | MATCH |
| 202609140003 | `202609140003_teaching_operations_reissue.sql` | `cb2a1e90011f154185f4b5695e3a14d00dce9a60e37063c1b38d2ca854fac794` | `cb2a1e90011f154185f4b5695e3a14d00dce9a60e37063c1b38d2ca854fac794` | MATCH |
| 202609140004 | `202609140004_completion_policy_management_reissue.sql` | `20358b17f0deed997263660f15bb0e4c2551caffa6b950d09fc9d4c5d609573e` | `20358b17f0deed997263660f15bb0e4c2551caffa6b950d09fc9d4c5d609573e` | MATCH |
| 202609140005 | `202609140005_student_teaching_content_isolation.sql` | `ec4454eea39f38bb9f8a7313b203cea444b831bc90cc1e7d30b070400d4c7674` | `ec4454eea39f38bb9f8a7313b203cea444b831bc90cc1e7d30b070400d4c7674` | MATCH |
| 202609140006 | `202609140006_agent_run_reconciliation.sql` | `6014fdee722b967e5264bd827d13f1e45448269f496d8d58c9a1e2ce4528e53a` | `6014fdee722b967e5264bd827d13f1e45448269f496d8d58c9a1e2ce4528e53a` | MATCH |
| 202609140007 | `202609140007_teaching_content_skeleton.sql` | `9d5c34d4e9ef0ff2e9de72db9d3ab1e5ac02bd248f222ddd312042a8c94339a4` | `9d5c34d4e9ef0ff2e9de72db9d3ab1e5ac02bd248f222ddd312042a8c94339a4` | MATCH |

| Baseline / metadata identity | Locked=current |
|---|---|
| Cutover / historical ledger count | 202609130003 / 449 |
| baseline-manifest.json SHA256 | `8a0f4cbe590eef3b5b8774af92eaaced00ca1b8d1133bde3bfbb9f825c5ac8f6` |
| app-schema-baseline.sql SHA256 | `e5de2f48fa40da53ebcae5353aa4907b1738e15998a304a37b3d0fc555c7bac5` |
| migration-ledger-baseline.json SHA256 | `cf575d233822934d4f1cd51b69c1eb4c8b358cb6b35c814905fdd4555b4f63bf` |
| R4A metadata payload digest | `3f6b85395bba89c87b1478da7a62c94f7f17a25e63a09057f1509e3276152aa0` |

**禁止将历史 baseline SQL 安装到已有 production；禁止重放449条历史 migration。** 仅从当前449之后按000→007执行。任何文件、顺序、count 或hash变化即 `Migration Package: DRIFTED / STOP`；不能repair ledger让包通过。逐项机器证据：[migration-package.json](evidence/teaching-agent-stage-1f-r5a/migration-package.json)。

## 5 Migration Semantic Plan

全部原文具有顶层BEGIN/COMMIT，使用 PostgreSQL transaction-safe DDL，没有 CONCURRENTLY/VACUUM/外部Provider调用；未来runner必须用审过的 transactionBody 提取顶层 body，不能把已带COMMIT的原文直接嵌入外层transaction造成提前提交。**transaction-safe不等于无锁、不等于可重复执行。** 没有顶层 IF EXISTS/IF NOT EXISTS 重放保护，001的CREATE OR REPLACE只覆盖个别函数；函数体中的IF EXISTS不能算migration幂等。

| Migration suffix | Creates / alters / RPC / policies / grants / constraints | Lock / scan / existing-product impact |
|---|---|---|
| 000 | 新建 agent_core_private 和五张 Agent 表，租户/actor/definition/conversation/run/message 外键与延迟环形引用、幂等及预算约束；三条不可变/definition guard trigger；admit、transition、event、usage RPC。扩展现有 ai_token_usage 五列和 run FK、usage 去重索引及三条 restrictive 浏览器写 policy。Agent 表启用 RLS，浏览器无直接表权限；service_role 仅显式 SELECT、definition INSERT 与 RPC EXECUTE。 | ai_token_usage ALTER 需要强表锁；FK 验证和普通唯一索引可能扫描既有 usage 表；新表 FK 引用 tenants/profiles。没有业务 backfill。 |
| 001 | 更新 definition guard 校验 artifact refs/digest；新增 append_agent_run_event_v2 的审计 metadata 白名单；原 transition 移入 private base，新 public wrapper 验证 output/tool/evidence/source/revision/segment 后完成 Run。 | 函数替换/移动有对象锁；函数内 UPDATE 不在安装时运行；没有新表、索引或业务扫描。 |
| 002 | agent_runs 增加 cancel_requested_at 与 public_event_seq；新增 student transport guard、owner status、持久 cancel request、cancel check 和 event sequence RPC。001 wrapper 再移入 private evidence，public transition 外层加取消屏障。 | ALTER Agent 表锁；public_event_seq 非空默认0，递增上限由RPC条件控制（不是新增CHECK）；新安装表应为空。无旧业务表回填。 |
| 003 | 扩展 curriculum_plan_template_items 的 source_type/activity_type 两条 CHECK；source/publication/roster/cancellation 四 trigger；staff 读取 adopted curriculum 的两 policy；新 curriculum_plan_assessments 关联表及 RLS；dispatch_curriculum_plan_exam 与 get_curriculum_execution RPC。 | DROP/ADD CHECK 会验证已有 template items；ALTER/trigger 安装锁既有课程计划表；FK 引用既有 assignment/plan 等。影响非 Agent 教学计划、发布、考试与名单修改，不是纯新增无影响。 |
| 004 | 新增 save_completion_policy_draft、publish_completion_policy_draft、get_completion_refresh_health、retry_failed_completion_refresh；auth.uid + Platform Owner 与 Korean/course 约束，管理完成策略草稿/发布和受限 retry。 | 仅函数 DDL；内部写入、advisory lock、健康聚合和重试均在未来调用时才执行。本次安装不发布策略、不重试任务。 |
| 005 | 新增 caller-bound textbook/module 可读检查及安全 segments 投影；修改六条教材/教学课/脚本 version SELECT policy，删除宽泛 script nodes SELECT policy；新增 owner-executed security_barrier view student_learning_agent_script_nodes，仅暴露安全投影；NOTIFY pgrst reload schema 在 commit 后生效。 | 改变现有非 Agent 教材、脚本读取权限；Feature OFF 不撤销这些变化。policy/view DDL 有元数据锁，运行期增加授权查询。没有教学数据清理或复制。旧 app 对新 RLS 的兼容性必须回归。 |
| 006 | 新增 agent_runs_reconcile_deadline 部分索引与 find_reconcilable_agent_runs_v1、reconcile_agent_run_v1、reconcile_agent_run_batch_v1；service-only ACL；deadline+6s、CAS、终态 no-op，默认50/max100，合同 deadline-terminal-v1。 | 普通索引建在 active Agent runs 上，可能锁写及扫描；全新安装预期空表。仅定义函数，不执行 reconciler、不产生事件。 |
| 007 | 新增 create_teaching_content_skeleton(uuid,timestamptz,text,text[])：Platform Owner、非 provisioned 账号、authoring_lock、lesson updated_at CAS、course/app/profile 和无旧树校验；未来调用原子创建教材/version/chapter/module/teaching lesson。authenticated EXECUTE；显式撤销 PUBLIC/anon/service_role。 | 仅函数 DDL，无新表、profile seed、script/nodes/content 实例；函数内部课程/课行锁与五记录写入不在安装时执行。published Profile 属后续内容前置。 |

安装不调用函数体，因此003/004/007中定义的写能力不会在DDL时创建考试、完成策略或内容。000会改旧usage结构、003会替换旧CHECK/增加trigger、005会改旧RLS并DROP一个policy；应采用**保留已提交 schema 的 forward-only策略**，不能笼统宣称八份全是“只加表、零旧业务影响”。旧大表大小/锁等待时长未在本阶段做业务扫描测量，未来执行前只读 pg_class/relation size/statistics估算并确认无人持长期事务，超时即停止，不自动提高timeout或重试。

## 6 Expected Post-Migration State

前提：窗口开始仍449/latest130003且full ledger hash匹配，没有任何并发migration。000–007逐份成功后数学预期 **457 / latest202609140007**。每步预期count依次450、451、452、453、454、455、456、457；原449条顺序/名称保持，新增ledger statement应保存对应完整原SQL并核对源码hash。若窗口前不是449：STOP/REPLAN，不机械要求457。

从原文推导的新增表：`public.agent_definition_versions`、`agent_conversations`、`agent_runs`、`agent_messages`、`agent_run_events`；另有非Agent前缀关联表`public.curriculum_plan_assessments`。五张Agent表与assessment表均RLS enable；五Agent表无浏览器直接写权限/开放policy。只执行安装时五Agent表应为空，不发布definition，不创建conversation/run/content。新增6张表不代表整库表数必须硬编码，managed平台对象变化仍需独立判断。

最终函数名如下；实际验收必须连同 **完整signature、owner、SECURITY DEFINER/search_path、ACL与body** 比较原migration，不能仅查同名函数存在。001/002迁移后的base/evidence位于私有schema，不应留在public。

| Schema | Final functions |
|---|---|
| agent_core_private | `actor_guard`, `check_budget`, `definition_guard`, `immutable`, `run_json`, `student_transport_guard`, `transition_agent_run_base_v1`, `transition_agent_run_evidence_v1` |
| private | `can_read_published_teaching_module`, `can_read_published_textbook`, `guard_curriculum_exam_cancellation`, `guard_curriculum_exam_roster`, `guard_curriculum_learning_publication`, `guard_curriculum_learning_source`, `staff_has_curriculum_template`, `student_script_segments` |
| public | `admit_agent_run_v1`, `append_agent_run_event_v1`, `append_agent_run_event_v2`, `check_agent_run_cancel_v1`, `create_teaching_content_skeleton`, `dispatch_curriculum_plan_exam`, `find_reconcilable_agent_runs_v1`, `get_completion_refresh_health`, `get_curriculum_execution`, `get_student_agent_run_status_v1`, `publish_completion_policy_draft`, `reconcile_agent_run_batch_v1`, `reconcile_agent_run_v1`, `record_agent_usage_v1`, `request_agent_run_cancel_v1`, `reserve_student_agent_event_sequence_v1`, `retry_failed_completion_refresh`, `save_completion_policy_draft`, `transition_agent_run_v1` |

显式索引：`agent_runs_one_active`、`agent_run_usage_once`、`agent_runs_actor_created`、`agent_messages_conversation_created`、旧`ai_token_usage`上的`agent_usage_call_once`、`agent_runs_reconcile_deadline`；另外逐表PK/UNIQUE产生隐式索引。须核partial predicate、unique、valid状态和列顺序。约束包括五Agent表tenant/actor/definition/conversation/run/message外键、输入message延迟FK、活跃Run唯一、run/model call usage去重、状态/预算/长度检查；003两项CHECK和assessment的PK、assignment UNIQUE及FK删除语义。

七个trigger：Agent的`agent_definition_immutable`、`agent_event_immutable`、`agent_definition_guard`；curriculum的`curriculum_learning_source_guard`、`curriculum_learning_publication_guard`、`curriculum_exam_roster_guard`、`curriculum_exam_cancellation_guard`。核目标表/事件/函数，不只核名称。

RLS/ACL验收：000三条`agent_usage_browser_{insert,update,delete}_boundary`均restrictive；003新增staff read adopted curriculum templates/items；005六条现有policy更新、旧宽泛script nodes policy移除、安全view `public.student_learning_agent_script_nodes`存在（security_barrier=true，postgres owner，authenticated仅SELECT，不含raw config/answerkey）。Agent public RPC为service-only、私有Agent helper不得PUBLIC/anon/authenticated/service直调；003/004业务RPC授权authenticated并在函数内部auth校验，005helper authenticated可执行；**不得把未显式revoke service_role的业务函数写成service绝对无权**，实际defaultACL/继承权限在安装后catalog核验。007显式排除service_role，仅authenticated并经Platform Owner检查。

006对象与合同必须匹配R4F，但只检查catalog与函数定义，不执行生产reconcile。007只提供正式authoring RPC，依赖已有教材表/课程/profile，不创建`hangul-introduction`、Profile或Script/Nodes。完整逐版本对象名：[expected-objects.json](evidence/teaching-agent-stage-1f-r5a/expected-objects.json)。

## 7 Frozen Application Artifact

| 项目 | 实测 |
|---|---|
| Path | `/tmp/uply-r3d-release-candidate/candidate-build.tar.gz` |
| File type / size | regular file、not symlink / 18,760,388 bytes |
| SHA256 | `1e32c6f6b402e7eb486e81dcbbad26ff18ce9a80a177a2463173276253573d28` |
| Build ID | `6IhDHN8Dm1nCewiCEZnV5` |
| Archive | readable，2153 members；无重复/越界/特殊类型member；未解压/复制/移动 |
| .next artifact file count / digest | 1377 / `b088781734cd2191c9027b208da70f04d8931b095afaf8a5bd2efe97a777185b` |
| required-server-files | version1、19个依赖条目均在archive内；distDir .next，非standalone |
| Next | builder installed16.2.10；candidate package声明^16.2.10；known-good installed16.2.10 |
| Frozen source inputs | 1306 files，与R4逐文件map及R4A digest一致 |
| Source digest | `48b8e7b979b0a158635c82e31e9e0f948742e0e5a0f2ca5e5bab553ec458708c` |
| Definition digest（锁定metadata） | `4b6299be0d5fcb33b9bdc10e8c35ac894905cfbf55540522e8628380e2ff3d8c` |

source范围：src/**、public/**、package.json、package-lock.json、next.config.ts、tsconfig.json、postcss.config.mjs。全部输入匹配，不从当前dirty工作区重新构建。definition metadata/source未变；本阶段未执行pin、definition publication或Provider。归档只含.next/public/package.json/next.config.ts，**不含node_modules、lockfile或完整source**；17个非.next文件也匹配frozen inputs。required-server-files中的临时构建appDir已不存在，是构建provenance，不可当成部署路径。

当前known-good dependency lock与冻结输入的lock相同，Next版本相同，但未对整个node_modules做完整bitwise封存。未来部署前必须确认依赖兼容、Node/Next启动方式和全部19项server files；不得以npm update/install或rebuild替换此locked artifact。证据：[artifact-lock.json](evidence/teaching-agent-stage-1f-r5a/artifact-lock.json)。

## 8 Artifact Durability

**Candidate Persistence: TEMPORARY LOCATION / DURABILITY RISK。** `/tmp`不具备持久发布保留承诺，本任务没有移动/复制artifact，也没有创建release。

真正执行前须由用户选择：在批准的persistent release/staging目录封存**同SHA**归档并重新核验；或在窗口即时确认文件仍存在、regular/non-symlink、SHA/Build完全一致，明确接受/tmp删除风险。两个决定都尚未作出；不擅自选一个，不创建新release来替代。缺失/hash错/归档坏/Build错立即STOP，不能临时重建当作原批准物。

## 9 Known-Good Release

当前source：`/home/yangzhen/releases/uply-first-enable-20260910/source`，目录存在、非symlink，source和required-server-files存在。Build ID `LuAZe2VMY32YjOo1WvtrC`，Next16.2.10；PM2 cwd即此目录。launcher `/home/yangzhen/.config/uply-first-enable-20260910/start.mjs` 固定这个source与runtime路径，验证runtime权限后注入process.env，启动Next监听127.0.0.1:3000。

package SHA `dd0c0db8f5881e3d12bd017a4ff40378d80275ef37a8948a466e330eba0ca587`；lockfile SHA `a6d94389cf839487432b5bab35fe9b8481a22ea5abbe4388076359a1085afc48`。完整运行信息与runtime/launcher hash见§3/[known-good-release.json](evidence/teaching-agent-stage-1f-r5a/known-good-release.json)。09-13报告中的历史Build不是当前rollback目标；以当前读取的LuAZe…为准。

## 10 Application Rollback

**Application Rollback Plan: PARTIAL。** 文件回退流程明确，但没有新production部署/回退演练，旧app与005收紧RLS共同运行的完整兼容性尚未单独证明。

未来获批窗口，在替换前封存当前known-good `.next/public/package.json/next.config.ts`、必要依赖/启动元数据与文件hash，保留LuAZe…和相同runtime/launcher；当前运行目录本身不能在被覆盖后仍称可用backup。维护期间停止新的普通产品活动并按原Script Runtime已有drain规则等待，禁止调用Agent reconciler/cancel。只有明确授权的named-app停机/重启可用于目录切换。

若迁移成功而部署或旧课堂回归失败：STOP，Feature保持OFF、三名单EMPTY；在受控停机状态将上述**应用文件**恢复到刚封存的known-good，使用原launcher/runtime启动，首先核OFF/EMPTY，再核Build/health/原课堂。若旧app因已保留005策略无法正常工作，保持维护/HOLD，报告兼容失败并另行审批forward fix；不能为了恢复页面撤销安全policy。

已提交的000–007留在DB；禁止DROP Agent表、down migration、恢复旧dump作为普通app rollback。只有confirmed data corruption事件才考虑独立批准的production restore，并重新评估RPO和丢失窗口。migration失败不自动等于需要全库restore。

## 11 Deployment Mechanism

**Atomic Application Switch: NOT VERIFIED。Migration Execution Mechanism: PARTIAL。**

只推荐一个候选机制：**本机已有 Docker PG17.6 psql，经TLS verify-full/private service+passfile，000→007逐份“SQL body与完整原文ledger INSERT同事务”执行**。09-10 `source/scripts/first-enable/migrate.mjs`的transactionBody/apply以及09-13 `uply-grammar-delivery.mjs`和成功[migrate-result](evidence/textbook-grammar-consistency-20260913/migrate-result.json)提供来源。前者是逐migration事务，后者历史三份为一个batch；本次按要求采用逐份事务，不复制历史batch范围。只读文件hash及绝对路径见[deployment-mechanism.json](evidence/teaching-agent-stage-1f-r5a/deployment-mechanism.json)。

不推荐第二套Supabase CLI/db push或baseline runner。旧CLI的loadPlan固定旧版本、precondition固定旧schema/PM2/Serve状态，不能直接运行；staging rehearse中先SQL commit再单独ledger写的模式也不能代替生产原子记账。R5A不新建apply功能。R5B执行前须审阅限定8份输入的适配/生成SQL及隔离测试，确认没有历史DDL/Serve操作、没有自动retry、没有跳过未知前缀；这是尚未完成的技术项。

未来每份执行模板（说明文字，非本阶段可执行命令）：

1. 全局无并发migration；新只读连接核target/ledger/hash/该步前置objects；备份freshness与OFF/EMPTY有效。
2. 在同一个connection打开transaction，ON_ERROR_STOP，lock_timeout5s、statement_timeout120s（参考历史；延长需重新审查），取得历史migration advisory lock `(4171,100)`，必要authoring lock顺序沿旧runner审查。
3. 在锁内重新断言原449 ledger及已确认前缀，目标版本尚未存在；插入完整原SQL到ledger前确认name/version/hash。执行已审查transactionBody，然后ledger INSERT，最后唯一COMMIT。不要嵌套原顶层BEGIN/COMMIT，不更改迁移文件。
4. 新只读connection核count/latest/新增entry原文SHA、该份objects/ACL、事务结果；receipt签署该步成功后才允许下一份。执行窗口中外部迁移仍会破坏序列，advisory lock只协调同协议操作员，不能当成全局排他保证。

迁移N失败：**STOP，不执行N+1，不repair ledger，不盲retry**。查看新连接ledger、objects、事务状态与原commit回执。明确rollback也须operator复核再决定；若commit outcome UNKNOWN，按R4F精神 STOP → NO BLIND RETRY → NEW READ-ONLY VERIFY → OPERATOR REVIEW，保持原UNKNOWN记录，不倒签。绝不根据退出码臆断NOT COMMITTED，也不自动restore。

未来app发布草案：维护窗口先drain原有产品活动，按明确批准停named app；保持443/4000/8443绑定不变；在独立stage校验精确归档/依赖并封存known-good；app已停止后替换固定source下的归档覆盖项；named app经原launcher启动；第一项核OFF/EMPTY，之后Build/health/regression。旧09-13 promote使用分步rename和固定路径，同时含Serve off/on条件，**不可原样运行**。没有verified symlink/blue-green/零停机reload；fork1且launcher固定路径，需要明确的停机/重启授权与停机时长，不把部分目录rename称全app原子切换。本阶段PM2 start/stop/restart/reload/delete全部0。

## 12 Feature / Allowlist Safety

Foundation安装全过程，包括migration前、逐migration、deploy期间、重启后、verification及rollback，`TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED`必须OFF；`TEACHING_AGENT_ALLOWED_TENANTS`、`TEACHING_AGENT_ALLOWED_COURSES`、`TEACHING_AGENT_ALLOWED_USERS`必须EMPTY。启动后在其他验证前先核这四项，任一不符即STOP，不能发真实Agent请求验证是否安全。

源码：`src/features/teaching-agent/server/transport/transport-config.ts`只接受1/true；`src/features/teaching-agent/server/transport/student-handlers.ts`在鉴权/执行前先gate；`src/features/teaching-agent/server/transport/rollout-policy.ts`三名单deny逻辑以实际文件图为准；`src/features/teaching-agent/server/page-projection/lesson-slots.tsx`关闭时先返回，不创建Selection Pins。运行时由launcher启动时注入，文件OFF证据不能泛化为独立动态请求测试。本阶段首尾runtime hash、PM2 PID/uptime均未变；未来启动必须重新核effective配置。

Foundation Provider requests=0、Agent runs=0、Content writes=0；不运行live/provider smoke、admission POST、persistent cancel或reconcile。provider policy保留BLOCKED / APPROVAL REQUIRED，Data/Policy Approver TBD。不填tenant/user/course/lesson；First Enable inputs均TBD。

## 13 Maintenance Client

Host native psql NOT AVAILABLE；Docker PG17 Client AVAILABLE，实际只运行无网络 `psql --version`得到17.6，镜像ID `sha256:86a2e078779e5bdccda1f6f6c5063aa9779a322d1fface5fb408d051909b230f`，`--pull=never`，没有安装/拉镜像。现有只读catalog连接成功，CA SHA与TLS证据在[maintenance-client.json](evidence/teaching-agent-stage-1f-r5a/maintenance-client.json)。

**Maintenance Client: PARTIAL。** 未来必须确认credential holder（拟执行杨震不等于凭据权限已获批）、target两个safe hash、database identity、PG17版本、TLS verify-full及匹配CA、private service/passfile（目录0700/文件0600，readonly mount、无URI命令行）、expiry、DDL/schema ownership/function owner/grant与ledger写权限。不记录password/URI；过期/权限不足/target变化即STOP。R4G operational acceptance及只读连接成功不能作为production maintenance credential授权。

## 14 Fresh Backup Requirement

Current R4D Recovery Point: **TECHNICALLY VERIFIED**。snapshotStart `2026-09-15T06:31:24.914920+00:00`；本次freshness计算于 `2026-09-15T10:09:07.514305+00:00`，age约217.7分钟，**Go-live Change-Window Freshness: STALE**。

R4D PG17.6隔离恢复26项通过，归档hash `41dfcc96b933b0893df3457d9c9c0c16ba82fdd58cb7d848b4ca7f7719a2aaa4`；这是已验证逻辑DB恢复能力，不等于全Supabase平台所有外部资源恢复。历史备份位于`/home/yangzhen/backups/uply/20260915T063124Z/`；本阶段未新建、删除、恢复或复制它。

真正Stage R5B/change-window授权须单独包括 fresh production recovery point 创建，至少验证archive可读/校验和、snapshot一致性及ledger/schema，按批准runbook快速隔离restore验证或明确接受引用R4D已验证能力（前提版本/对象策略仍适用）。生产**第一条migration开始时**snapshot age≤15min；安装前耗时过长使其过期则STOP/重新获准生成fresh point，或用户明确批准更大RPO exception。安装不可静默延长RPO，遇到长暂停/异常后继续同样需重新检查freshness和授权。旧backup验证不能替代窗口freshness。证据：[backup-freshness.json](evidence/teaching-agent-stage-1f-r5a/backup-freshness.json)。

## 15 Maintenance Window

Production Maintenance Window: **TBD**。window date、start time及timezone、maximum duration、停普通业务/drain安排、rollback截止时间均待用户明确确认。本报告生成时间和R4G接受时间都不是maintenance window。

建议未来窗口覆盖fresh backup/validation、000–007逐份验证、受控app停机切换、非Agent回归和必要app回退；不在本阶段推定时长。005改变旧RLS，维护范围必须覆盖迁移至新app验证之间的兼容风险，不能认为Feature OFF即可正常营业而零影响。

## 16 Operator / Standby Status

| 角色 / 决定 | 当前值 |
|---|---|
| Execution / Primary / Release Operator | 杨震 |
| Backup Creation / Restore Operator | 杨震（执行本窗口仍需新授权；不含production restore） |
| Teaching Content Owner | 杨震；本阶段不创建内容 |
| Independent Backup / Standby | TBD — NOT ASSIGNED |
| Foundation single-operator maintenance exception | NOT DECIDED |
| Data / Policy Approver | TBD — APPROVAL REQUIRED |
| R4G Primary Operator Package / receipt storage | ACCEPTED / READY（历史接受保留） |

独立standby不自动阻止只读技术preflight。真正执行前用户必须指定真实standby，或单独明确接受**仅此Foundation窗口**的单人维护风险。R4G风险acknowledged不等于此例外已接受，Codex不代选/代签。receipt原件仍放受限operations root（0700/0600），最终保留期限/复核人待决定；按R4G规则决定前保留、不自动删除。Foundation不需要生产tenant，也不因此执行reconciler或建立scheduler。

## 17 Post-Install Verification

以下均是**未来获批后的检查计划，NOT EXECUTED IN R5A**。只用catalog/schema/RLS/function definition、非写入health、明确权限下Platform Owner UI读取与隔离synthetic/no-provider检查。

| # | 验证对象 / 方法 | 必须结果 |
|---|---|---|
| 1 | 新只读connection ledger全序列/每条source hash | 条件成立时457/latest140007，旧449不变 |
| 2 | pg_namespace/class/attribute/constraint/index | §6对象、列、外键/unique/check/index predicate完全匹配 |
| 3 | pg_policy/relrowsecurity/ACL/role effective privileges | Agent RLS、usage restrictive policy、005所有边界准确 |
| 4 | pg_proc definitions/signatures/owners/search_path | public RPC和private wrappers准确；PUBLIC/anon禁止范围匹配 |
| 5 | reconciler catalog | 三RPC、index、service ACL、deadline-terminal-v1；不调用RPC |
| 6 | authoring catalog | 003/004对象与007skeleton函数存在；安全view可用；不调用创建/发布函数 |
| 7 | artifact/PM2/launcher | candidate Build6Ih…、approved SHA、uply-first-enable online，固定launcher/runtime |
| 8 | **重启后第一检查** effective config/无Agent UI | Feature OFF；三allowlists EMPTY；不做Agent POST |
| 9 | existing homepage/auth/classroom/textbook/media/admin | §18既有非Agent路径可读，无新错误/权限回归 |
| 10 | Platform Owner 正式UI只打开 | 教材制作、Script Studio正常加载；只看现有被授权页面，不create/save/publish/runtime start |
| 11 | admission/Provider零合同 | 源码与isolated OFF fixture检查；新Agent表只读count=0，批准范围内的安全日志无本次调用；不导出事件内容 |
| 12 | end inventory / receipt | OFF/EMPTY、Agent0/Provider0、Serve/runtime未变、未创建content/Pins；保留安全hash/状态receipt |

**Authoring Availability Gate**只验证UI/route/schema available，不能因为没有生产教材而判RPC安装失败，也不能为测试创建`hangul-introduction`。实际角色guard后的页面可用性须用户有权的Platform Owner session现场检查；重定向登录/403不是PO页面PASS，不读取/复制Cookie/JWT。任何无法观测的runtime项记录UNKNOWN/HOLD，不把console无错当Provider计量全覆盖。

## 18 Existing Product Regression

以现有测试/源码选择最小范围，所有写fixture或驱动Script Runtime的完整e2e只在隔离环境运行，绝不指向production。用户自己的已授权页面读取可以在未来窗口检查，不枚举其他学生，生产页面若自动创建session/progress则改用隔离复现，不声称零写浏览器检查。

| 原有能力 | 未来最小验证与现有依据 |
|---|---|
| Homepage / auth entry | 首页及登录入口GET、现有授权角色导航；`tests/admin-navigation.test.mjs`离线静态检查 |
| Existing classroom / course read | 已授权的既有课堂/教材显示、课程与章节导航；观察005后非Agent读取权限；不得新enrollment或lesson |
| Existing media | 既有授权媒体GET/HEAD及range响应、页面只读资源加载；不启动会保存录音/进度的流程 |
| Existing admin | 既有Platform Owner管理列表正常，错误/权限不扩张 |
| Textbook authoring | `/platform/dashboard/admin/apps/korean/textbooks`，对应`[space]/dashboard/admin/apps/[appSlug]/textbooks/page.tsx`与DigitalTextbookAdminPage；只打开 |
| Teaching scripts / Script Studio | `/platform/dashboard/admin/apps/korean/teaching-scripts`，对应TeachingScriptStudioPage与ManagementSection guard；`tests/learning-agent-script-studio.test.mjs`隔离/静态用例；不点保存/发布/试运行 |
| Script Runtime关键路径 | `tests/smart-textbook-runtime-4a14-browser.test.mjs`的synthetic/fake audio、pause/cancel/late-event等；4a15相关隔离回归。生产仅观察已有只读入口，不新runtime session |
| Agent OFF回归 | `tests/teaching-agent-page-rollout.test.mjs`、`tests/teaching-agent-student-rollout.test.mjs`离线fixtures；OFF无slot/无Pins、empty名单deny |
| 003/004旧教学操作兼容 | `tests/teaching-operations-db.test.mjs`、`tests/completion-policy-management-db.test.mjs`仅隔离DB；生产catalog/只读UI，禁止dispatch/retry RPC smoke |

旧published node读取已改safe view，安全投影缺失/旧app权限失败应视为回归而非临时放开RLS。具体existing classroom/media target只在用户授权窗口现场选本人有权资源，报告不保存真实用户/课程ID。

## 19 Release Definition

Future release identifier：`uply-teaching-agent-foundation-r3d-r4f-R5A-PROPOSED`（**仅提案；未创建production release**）。精确migration SHA表见§4，candidate/Build/source/definition锁见§7，rollback Build见§9。

| Lock | Value |
|---|---|
| Candidate SHA | `1e32c6f6b402e7eb486e81dcbbad26ff18ce9a80a177a2463173276253573d28` |
| Candidate Build / rollback Build | `6IhDHN8Dm1nCewiCEZnV5` / `LuAZe2VMY32YjOo1WvtrC` |
| Operator CLI SHA | `12842a373fd85fdc19cebafef40505387c970711376718c5f164b1ef71d21437` |
| Operator SQL SHA | `b774e2cf72e12dba59d9ba06a4d14cec684b9555c47787dfdff33da1554bf36d` |
| Migration006 SHA | `6014fdee722b967e5264bd827d13f1e45448269f496d8d58c9a1e2ce4528e53a` |
| Operator contract | deadline-terminal-v1 / reconciler-receipt-v1 |
| Runtime / launcher | §3两个原SHA；保持原路径与注入方式 |
| Runtime expected | Feature OFF；三名单EMPTY；Provider0、Agent0、content0 |

[operator-bundle.json](evidence/teaching-agent-stage-1f-r5a/operator-bundle.json)与R4G完全匹配。CLI/SQL封存用于后续运维识别，本次和Foundation verification都不运行生产reconciler。definition digest锁定不授权definition publication；Foundation无tenant输入、不发布definition。

## 20 Authorization Package

新建 [Production Foundation Install Authorization](teaching-agent-production-foundation-install-authorization.md)：**UNSIGNED / NOT AUTHORIZED**。精确绑定target identity、ledger、8migration SHA、archive SHA/Build、operator bundle、rollback版本、OFF/EMPTY/0边界。

未来必须在同一个有边界的授权记录中明确：A 000–007 production migrations；B exact artifact deploy；C named PM2必要维护停机/启动/重启（不能含其他进程或Serve）；D fresh backup creation；E catalog/非Agent/authoring只读verification。需同时填写窗口/最大时长、standby或显式single-operator exception、artifact持久性选择、credential与技术适配验收。只说“继续”不能替代范围不清的授权。

### Future pre-execution checklist（顺序，不在R5A执行写项）

1. 完成未完成的受限runner/隔离验证及回退兼容核验，精确执行输入附到授权记录；任何lock drift先STOP/REPLAN。
2. Explicit authorization signed：A–E、窗口与例外范围明确，签字/record可追溯。
3. Maintenance window active；standby或单人风险明确；原有产品drain/停机安排就绪。
4. Production project/host重新核验；ledger仍449/latest130003/full hash匹配；无并发migration。
5. 按顺序重算8份migration SHA、baseline/release metadata、candidate archive/Build/source、operator CLI/SQL/006；逐项MATCH。
6. artifact持久封存或已接受/tmp风险的即时存在/hash核验；known-good封存/依赖与rollback路径准备。
7. 获批fresh backup创建并archive validation；按批准策略完成快速restore验证或明确引用R4D能力；first migration开始时age≤15m。
8. Feature OFF、三allowlists EMPTY；无Agent admission、无Agent Run、无Provider；approved maintenance credential/TLS/permissions确认。
9. 经批准named app受控停机（需要时）覆盖迁移至deploy的兼容风险，保持Tailscale/runtime不变；不执行Agent drain/reconcile RPC。
10. Migration000 → 新只读verify450/latest000/该份objects/source hash/commit；失败STOP。
11. Migration001 → verify451/latest001/该份objects/source hash/commit；失败STOP。
12. Migration002 → verify452/latest002/该份objects/source hash/commit；失败STOP。
13. Migration003 → verify453/latest003/该份objects/source hash/commit；失败STOP。
14. Migration004 → verify454/latest004/该份objects/source hash/commit；失败STOP。
15. Migration005 → verify455/latest005/该份objects/source hash/commit；失败STOP。
16. Migration006 → verify456/latest006/该份objects/source hash/commit；失败STOP。
17. Migration007 → verify457/latest007/该份objects/source hash/commit；失败STOP。
18. 全ledger/object/RLS/ACL verification，包括旧449未变，Agent数据仍0；不调用写RPC。
19. deploy approved exact archive，按批准named app启动/重启；不修改Serve、runtime或执行dependency安装。
20. **首先** verify Feature OFF，再verify三allowlists EMPTY，之后Build/PM2/health。
21. §18 non-Agent regression；§17 authoring UI availability，不创建内容/课/Pins。
22. 若失败按§10/§11 STOP与app rollback规则；不回退DB、不盲retry。
23. 首尾production safety state对比，Provider0/Agent0/content0，seal private release receipt及repo安全hash摘要。
24. Stage1G仍NOT READY；另行进入Production Content/Pins准备，不自动First Enable。

## 21 Gate Matrix

PASS表示R5A事实或计划成立；不表示未来安装已经执行。PARTIAL工程项与待用户决定项在备注区分。

| Gate | Name | Status | Evidence / limitation |
|---|---|---|---|
| G-R5A-1 | Production Identity Confirmed | PASS | 开始/结束 catalog 与 R4G 比较；project/host hash 一致 |
| G-R5A-2 | Production Ledger Confirmed | PASS | 449/latest130003/完整有序 ledger hash |
| G-R5A-3 | Agent Migrations Not Applied | PASS | Agent 表0、ledger匹配；000–007未应用 |
| G-R5A-4 | Migration Range Exact | PASS | manifest与目录恰好8份、原顺序 |
| G-R5A-5 | Migration Hashes Locked | PASS | 8/8 MATCH |
| G-R5A-6 | Baseline Identity Locked | PASS | cutover、SQL、449 ledger file、manifest digest MATCH |
| G-R5A-7 | Migration Semantic Plan | PASS | §5逐份语义、锁/扫描/旧业务影响 |
| G-R5A-8 | Expected Post-State Defined | PASS | §6与expected-objects.json；未声称已安装 |
| G-R5A-9 | Frozen Artifact Exists | PASS | regular/not symlink，归档可读 |
| G-R5A-10 | Artifact SHA Locked | PASS | archive与.next文件map digest MATCH |
| G-R5A-11 | Candidate Build ID Locked | PASS | 6IhDHN8Dm1nCewiCEZnV5 |
| G-R5A-12 | Candidate Durability Status | PARTIAL | /tmp；持久封存或明确风险接受待决定 |
| G-R5A-13 | Known-good Release Identified | PASS | 当前目录/Build/依赖/launcher可读 |
| G-R5A-14 | Application Rollback Plan | PARTIAL | 文件回滚步骤明确；保留005后的旧app兼容性未单独演练 |
| G-R5A-15 | PM2 Deployment Path Understood | PASS | 固定路径/fork1；atomic switch NOT VERIFIED |
| G-R5A-16 | Feature OFF Contract | PASS | 全过程OFF，启动后先核验 |
| G-R5A-17 | Allowlists EMPTY Contract | PASS | 三名单全过程EMPTY |
| G-R5A-18 | Provider Zero Contract | PASS | 不做Live smoke，不授权Provider |
| G-R5A-19 | Post-Install Verification Plan | PASS | §17目录/ACL/非Agent验证，未执行 |
| G-R5A-20 | Authoring Availability Plan | PASS | 仅Platform Owner UI/route/schema，不创建内容 |
| G-R5A-21 | Fresh Backup Rule | PASS | R4D stale；窗口fresh<=15m或显式exception |
| G-R5A-22 | Maintenance Window Status | PARTIAL | TBD；未编造时间 |
| G-R5A-23 | Standby Decision Status | PARTIAL | TBD；Foundation单人例外NOT DECIDED |
| G-R5A-24 | Maintenance Client Plan | PARTIAL | PG17 client/TLS可用；维护权限/expiry/holder待验证 |
| G-R5A-25 | Migration Execution Mechanism | PARTIAL | 唯一Docker psql方案；000–007适配/隔离核验未完成 |
| G-R5A-26 | Migration Failure Runbook | PASS | STOP/NO BLIND RETRY/新只读连接复核 |
| G-R5A-27 | Deploy Failure Runbook | PASS | 仅app回退，DB保留，兼容失败HOLD |
| G-R5A-28 | Existing Classroom Regression Plan | PASS | §18依据现有测试选取无Provider检查 |
| G-R5A-29 | Release Definition | PASS | §19/foundation-plan.json锁定提案，不创建release |
| G-R5A-30 | R4F Operator Bundle Locked | PASS | CLI/SQL/006三SHA匹配R4G |
| G-R5A-31 | Tailscale Unchanged | PASS | 443/4000/8443相同；9443absent |
| G-R5A-32 | Provider Policy Preserved | PASS | BLOCKED/APPROVAL REQUIRED；Data approver TBD |
| G-R5A-33 | Production Content Untouched | PASS | 本阶段零内容写，不枚举学生 |
| G-R5A-34 | Authorization Package Generated | PASS | UNSIGNED/NOT AUTHORIZED |
| G-R5A-35 | Production Authorization Not Falsified | PASS | migration/deploy NOT GRANTED；签署PENDING |
| G-R5A-36 | Production DB Writes Zero | PASS | 固定READ ONLY/ROLLBACK；本任务0写 |
| G-R5A-37 | Production Migration Not Applied | PASS | 结束仍449/130003/Agent表0 |
| G-R5A-38 | Production Deploy Zero | PASS | 本任务0；未替换文件 |
| G-R5A-39 | Feature OFF | PASS | 开始/结束配置OFF，未调用Agent |
| G-R5A-40 | Allowlists EMPTY | PASS | 开始/结束三名单EMPTY |
| G-R5A-41 | Provider Requests Zero | PASS | 本任务无Provider调用；不声称审计全站其他流量 |

### Go / No-Go

| 项目 | 状态 |
|---|---|
| Foundation Technical Package | PARTIAL（执行适配与兼容验证限制，非因待签字判FAIL） |
| Migration / Artifact / Operator | LOCKED / LOCKED / LOCKED |
| Rollback App / Migration Mechanism / Maintenance Client | PARTIAL / PARTIAL / PARTIAL |
| Fresh Backup | REQUIRED；当前R4D TECHNICALLY VERIFIED / STALE |
| Window / Independent Standby | TBD / TBD |
| Single-Operator Exception | NOT DECIDED |
| Production Authorization | NOT GRANTED |
| Stage1G | NOT READY |

## 22 Remaining Decisions

需用户下一步明确决定的是**Production Foundation Install授权**，不是Provider或First Enable批准。授权前/执行准备还需：限定000–007 runner审阅与隔离验证、保留005的旧app兼容/rollback核验；维护credential holder/权限/expiry；日期/start/timezone/max duration与rollback截止；指定独立standby或仅本窗口单人风险接受；persistent archive封存或/tmp风险接受；fresh backup与RPO、验证方式；具体PM2停机/启动范围与原有产品drain。未填写项保持TBD/NOT DECIDED，未代签。

技术包准备可接受不代表可执行，R4G运维接受也不替代这些授权。锁定物发生任何变化，STOP → REBUILD/REVERIFY，不扩大旧批准。

## 23 Stage1G Blockers

Provider Technical Scope READY FOR REVIEW；Provider Policy BLOCKED / APPROVAL REQUIRED、Data/Policy Approver TBD、retention/training/DPA/cross-border/consent仍未批准。Foundation Provider0不解决这些Gate。

Production content NOT CREATED / NOT VERIFIED；production Pins NOT VERIFIED；single eligible lesson scope NOT VERIFIED；Pilot tenant/internal-test user/course/lesson均TBD。没有访问真实学生名单，也没有核验真实内容，只保留用户确认的当前状态；不得把零内容写说成内容已审核。正式Review/Validation/Publish、StudentPolicy/server Pins、单课冻结/allowlist仍属后续阶段。

R4B Streaming / Origin / Disconnect PASS，Compression/Buffering PARTIAL，保持历史结论；9443没有重开。Foundation不修改Tailscale或假称Compression全部PASS。

Independent standby/最终receipt安排、First Enable change authorization、definition publication、Feature enable、pilot allowlist写入仍未放行。Foundation成功目标为migrations000–007 APPLIED + frozenR3D app + OFF/EMPTY/Agent0/Provider0，而**Stage1G仍NOT READY**，随后才准备production content/Pins。

## 24 Final Recommendation

**CONDITIONAL：接受R5A只读调查与未签署授权包；Production Foundation Technical Package PARTIAL；Production Execution仍NOT GRANTED。** 没有production state drift；migration、artifact和operator locks可保留。执行前关闭受限runner/旧app兼容与维护client确认项，取得明确的Foundation窗口授权及fresh backup后，才可在另一个获批阶段安装。

本阶段已停止在preflight：DB writes0、migration未应用、deploy0、未restart PM2、未新建backup、Feature OFF、allowlists EMPTY、Provider0、未创建production内容；不会自动进入Stage1G。
