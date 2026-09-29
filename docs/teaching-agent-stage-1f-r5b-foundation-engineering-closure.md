# UPLY Teaching Agent — Stage 1F-R5B Foundation Engineering Closure

## 1. Executive Summary

**Overall: GO（工程闭环）。Production Foundation Technical Package: READY。Migration Execution Mechanism: READY。Application Strategy: FORWARD-ONLY READY。Maintenance Client: READY。Production Authorization: NOT GRANTED。Stage 1G: NOT READY。**

按用户明确确认的开发阶段策略，旧应用与post-005/post-007兼容性为 **NOT REQUIRED BY USER**；杨震单人开发维护风险已明确接受。这不构成production migration/deploy授权，也不放宽DB备份、迁移完整性和恢复边界。

000–007已用新runner在R4D恢复克隆中完成449→457，逐份CONFIRMED及readonly verify PASS。最终代码再次在独立fresh clone演练通过；原449条（含SQL）不变，新增8条version/name/完整SQL一致。新R3D在post-007数据库上启动并通过指定页面检查。生产首尾状态完全匹配，DB writes0、migration NOT APPLIED、deploy0、PM2/runtime/Tailscale不变。

## 2. Scope and explicit development decisions

本阶段允许新runner/测试、隔离恢复与迁移、同SHA artifact持久封存及只读production capability audit。未执行production DDL/DML、backup创建、restore、deploy、PM2 stop/restart/reload、Feature ON、allowlist写入、production Agent/content/Pins、Provider、Tailscale变更。

用户确认当前无真实外部用户、无正式学生Pilot；不要求zero-downtime、blue-green或旧app回退兼容。记录见[development-decisions.json](evidence/teaching-agent-stage-1f-r5b/development-decisions.json)。Independent Standby **DEFERRED UNTIL REAL PILOT / EXTERNAL USER ROLLOUT**；本开发Foundation例外 **ACCEPTED BY 杨震**。维护窗口TBD不影响技术READY，但实际执行前仍必须指定。

R5A/R4G/R4F/R4D及migration/baseline/product源码保留。仅新增R5B脚本、报告/evidence并更新未签署[authorization package](teaching-agent-production-foundation-install-authorization.md)。原dirty workspace不清理。所有0计数指本任务行动，不把无关整站活动当成本阶段审计范围。

## 3. Production start/end and maintenance identity

| Item | Start / end |
|---|---|
| Observation UTC | 2026-09-15T10:21:32.776352+00:00 / 2026-09-15T10:57:14.488196+00:00 |
| PostgreSQL | 17.6 / 17.6 |
| Project identity SHA | `cad8258f794d075042a59e5df2217f60173e29fbe15a2bf4b3324360d79df673` |
| Host identity SHA | `33fa58605f9a47d2e80d4304fbd939405198c3be83a78743d878dd1d665041b5` |
| Ledger / latest | 449 / 202609130003，首尾一致 |
| Full ordered version/name ledger SHA | `d864066c601dd9b7e60144773f34eb456f035cbae9dec114a716048fa5151981` |
| Agent migrations / Agent tables | 000–007 NOT APPLIED / 0 |
| Feature / all three allowlists | OFF / EMPTY |
| PM2 | uply-first-enable online；PID/uptime/restart counter/cwd/launcher metadata MATCH |
| Runtime SHA | `7a4b31b099fb968dd1105f8fbc67b946ae3fa79c30873998f8864ef1578878c8` |
| Launcher SHA | `30c81ade417866170cb3c3b3dd1cf9477cb033c9c3c0be363674c0f92eed0039` |
| Tailscale canonical SHA | `b33a37027b06f50f17d82a983f9c89ff342ca1fc94d58d0908c4e6bbeb83d256` |
| Tailscale bindings | 443/4000/8443保持；9443 absent；Funnel关闭 |

生产使用reviewed固定READ ONLY/ROLLBACK catalog query，未读取真实学生名单/内容。仅既有凭据的临时私有连接文件，完成即清理；无新production credential。证据：[preflight](evidence/teaching-agent-stage-1f-r5b/production-preflight.json)、[end-state](evidence/teaching-agent-stage-1f-r5b/production-end-state.json)。

Maintenance Credential Capability **SUFFICIENT**；Expiry **VALID at observation**。session/effective role postgres，数据库CREATE、三schema CREATE、12个既有目标表owner authority、可作为postgres owner、必要角色存在、ledger INSERT均通过只读catalog核验。这些owner/schema权限支持本包所需DDL、CREATE/ALTER FUNCTION、RLS/POLICY、VIEW及GRANT/REVOKE；没有执行DDL来测试权限。有效登录及rolvaliduntil未过期/无期限不保证未来未轮换，窗口前必须重核。客户端TLS verify-full成功；server backend TLS catalog不能代替全链路TLS证明。

Host native psql NOT AVAILABLE；已有Docker PG17.6 client AVAILABLE、未安装工具/拉新镜像。Node测试为26.5.0，PM2记录的node_version及exec_interpreter与测试Node相同；sandbox中host /proc PID不可直接观察，因此不把不可见误写成runtime drift。[maintenance-capability](evidence/teaching-agent-stage-1f-r5b/maintenance-capability.json)、[node-compatibility](evidence/teaching-agent-stage-1f-r5b/node-compatibility.json)。

## 4. Migration package and runner

| Version | Filename（supabase/migrations/） | SHA256（current=R5A locked） | Result |
|---|---|---|---|
| 202609140000 | `202609140000_agent_core_foundation.sql` | `7abc5545f6cb926c37a74a890fc6fcdbad4f89a5c35474a4628af67b7e0afa8b` | MATCH |
| 202609140001 | `202609140001_agent_runtime_completion_evidence.sql` | `a0ece84b6030f029ff68781e3dcffa73e5d7ea2448c33c750ff76c1098f3456b` | MATCH |
| 202609140002 | `202609140002_agent_run_cancel_request.sql` | `a8c0d60432a39f08dd45cea08b7ea0e6565885a8d0a65d15118c1f093dc9fb62` | MATCH |
| 202609140003 | `202609140003_teaching_operations_reissue.sql` | `cb2a1e90011f154185f4b5695e3a14d00dce9a60e37063c1b38d2ca854fac794` | MATCH |
| 202609140004 | `202609140004_completion_policy_management_reissue.sql` | `20358b17f0deed997263660f15bb0e4c2551caffa6b950d09fc9d4c5d609573e` | MATCH |
| 202609140005 | `202609140005_student_teaching_content_isolation.sql` | `ec4454eea39f38bb9f8a7313b203cea444b831bc90cc1e7d30b070400d4c7674` | MATCH |
| 202609140006 | `202609140006_agent_run_reconciliation.sql` | `6014fdee722b967e5264bd827d13f1e45448269f496d8d58c9a1e2ce4528e53a` | MATCH |
| 202609140007 | `202609140007_teaching_content_skeleton.sql` | `9d5c34d4e9ef0ff2e9de72db9d3ab1e5ac02bd248f222ddd312042a8c94339a4` | MATCH |

[runner.py](../scripts/teaching-agent-r5b/runner.py)只加载[locked-package.json](../scripts/teaching-agent-r5b/locked-package.json)的8个显式文件；扫描目录仅用于拒绝extra/missing，不用于选择执行SQL。与R5A逐项比较；不执行baseline、历史449或未知migration，无skip/force/repair/resume/automatic retry。

每份：BEGIN → lock_timeout5s / statement_timeout120s → advisory `(4171,100)` + ledger SHARE ROW EXCLUSIVE锁 → 在锁内核旧449完整SQL digest与精确新增前缀、确认target不存在 → 原migration transaction body → ledger INSERT(version,name,ARRAY[完整原SQL]) → 单一COMMIT → nonce ACK。transaction lexer保留function body/字符串/注释，移除仅顶层BEGIN/COMMIT，拒绝嵌套事务/psql metacommand。**DDL与ledger同事务**。

CONFIRMED必须同时有成功退出、COMMIT tag和唯一匹配nonce ACK；再用新只读连接核ledger与原SQL完整性，PASS后才下一份。未dispatch为NOT_COMMITTED；dispatch后timeout/disconnect/bad ACK为UNKNOWN，STOP/NO RETRY/NO NEXT；后续只读发现rollback或commit都不改写原UNKNOWN receipt。receipt独占创建、0600、file+directory fsync。457再次启动拒绝000，不跳过已应用版本。

[maintenance_transport.py](../scripts/teaching-agent-r5b/maintenance_transport.py)提供未来生产同一engine的Docker/libpq传输入口。`apply-authorized`缺少显式授权会在连接前拒绝。它检查私有签署记录、target/runner/transport/package/runtime locks、window、OFF/EMPTY/Provider0/Agent0、CA verify-full、connection文件不变、sealed fresh backup年龄；并非当前获准调用。R5B仅测试拒绝条件及内存授权校验，未运行其production connection/write路径；实际事务机制已由相同engine在真实PG17演练，生产权限由独立只读audit确认。

最终runner SHA：`755c8d823bfe10d82514382a090cff162003f4c8661767ef1d8ba7990446f8b9`；maintenance transport SHA：`ab77d1981dfe27c127c78320a1159059f8d6a3f81d0fa95d916ef5877d2be83f`。全部脚本锁定摘要：[engineering-locks.json](evidence/teaching-agent-stage-1f-r5b/engineering-locks.json)。

## 5. R4D restore and 449 → 457 rehearsal

输入`/home/yangzhen/backups/uply/20260915T063124Z/`，database.dump SHA `41dfcc96b933b0893df3457d9c9c0c16ba82fdd58cb7d848b4ca7f7719a2aaa4`；manifest SHA `b947bf1ac84634ce45ad5c6dd668bbc6b6651c714914ce433e5cec01bf2f2150`及全部79个sealed文件与SHA256SUMS均匹配，备份未改。没有创建新的production backup。

每个恢复克隆是唯一ID/label的network-none PG17.6 container、唯一volume、固定Unix socket和database marker；无published DB port、无production credentials。恢复R4D角色/schema/extensions/data/ACL后重置postgres NOSUPERUSER，26项catalog/count/column/role/ledger完整性检查通过，再允许runner执行。临时restore所需superuser仅用于隔离恢复兼容，八份迁移实际以恢复后的postgres NOSUPERUSER执行。

| Migration | Isolated ledger | Commit | New read-only post verification |
|---|---|---|---|
| 202609140000 | 449 → 450 | CONFIRMED | PASS |
| 202609140001 | 450 → 451 | CONFIRMED | PASS |
| 202609140002 | 451 → 452 | CONFIRMED | PASS |
| 202609140003 | 452 → 453 | CONFIRMED | PASS |
| 202609140004 | 453 → 454 | CONFIRMED | PASS |
| 202609140005 | 454 → 455 | CONFIRMED | PASS |
| 202609140006 | 455 → 456 | CONFIRMED | PASS |
| 202609140007 | 456 → 457 | CONFIRMED | PASS |

最终ledger457/latest202609140007；旧449条完整记录（version/name/statements）的数据库JSONB digest `cfdade473cb06c8169399c2b99686dec7e3d466965ad9d0d3fd8ea26b5899b03`保持。这个digest与production version/name数组hash输入不同，不能混淆。新8条完整SQL逐字匹配locked files。第一次成功克隆用于candidate；另一个克隆只做expected failure；最终再用fresh restore核验最终runner/receipt版本，均无baseline重放、无ledger repair、无失败迁移自动重试。

证据：[restore-verification](evidence/teaching-agent-stage-1f-r5b/restore-verification.json)、[migration-rehearsal-final](evidence/teaching-agent-stage-1f-r5b/migration-rehearsal-final.json)、[rerun-protection](evidence/teaching-agent-stage-1f-r5b/rerun-protection.json)。

## 6. Post-migration integrity and permissions

[post-migration-integrity.json](evidence/teaching-agent-stage-1f-r5b/post-migration-integrity.json)全部检查PASS：

- 5张Agent表及curriculum_plan_assessments，精确新列顺序；usage新增5列；cancel/public_event_seq bigint非空默认0。
- 6张表约束数分别7/5/10/8/3/6、全部validated；两个输入/message延迟FK保留。6个显式索引valid且unique属性正确，7个trigger启用。
- 35个最终function的正文逐项匹配源码（含移到private的base/evidence），owner/security-definer/config完全匹配；006 batch额外lock_timeout2s也校验。
- Agent RLS enable、anon/authenticated无直接表读写；service table权限受限。12个Agent相关RPC仅service执行，private Agent helper不可由browser/service直接执行。
- usage三条restrictive boundary；staff两条adopted curriculum policy；raw script-node宽泛policy移除；safe view security_barrier/postgres owner、authenticated SELECT、无raw configuration/answer key。
- reconciler RPC/索引/ACL与锁定正文存在，未调用生产或隔离Agent reconciler；skeleton RPC authenticated允许、anon/service禁止，未调用创建内容。
- 全部5张Agent表行数 **0**。38个既有教材/脚本/课程/教学计划/usage表count与R4D一致；UI只读，无教学内容写动作。这是count+操作边界核验，不声称逐行内容hash审计。

## 7. Negative tests and transaction proof

17项unit/protocol tests PASS：wrong ledger/hash/order、missing/extra migration、already applied、timeout、connection lost、bad ACK、missing COMMIT tag、no-dispatch、post-read failure、SQL lexer、mutated plan、production无授权拒绝与内存window/lock授权校验。所有失败停止、无自动retry、无下一份dispatch。

独立negative clone真实测试：在ledger INSERT上安装仅该克隆存在的拒绝trigger，使用**未修改000正文**运行新engine。DDL之后ledger INSERT失败，原receipt UNKNOWN，立即STOP；新只读连接确认ledger449、agent_core_private/agent_runs不存在、旧usage未增加run_id，证明DDL+ledger一起rollback。只dispatch一次migration，未执行001，未重跑000。

真实Docker psql的readonly pg_sleep超时、连接自终止、坏commit ACK同样分类UNKNOWN。后续只读验证不倒签receipt。negative clone随后销毁。[negative-runner-tests](evidence/teaching-agent-stage-1f-r5b/negative-runner-tests.json)、[live-negative-tests](evidence/teaching-agent-stage-1f-r5b/live-negative-tests.json)。

## 8. Persistent frozen artifact and deployment shape

| Item | Verified |
|---|---|
| Persistent candidate | `/home/yangzhen/artifacts/uply-teaching-agent-foundation-r3d/candidate-build.tar.gz` |
| SHA256 | `1e32c6f6b402e7eb486e81dcbbad26ff18ce9a80a177a2463173276253573d28` |
| Build ID | 6IhDHN8Dm1nCewiCEZnV5 |
| File size / type | 18760388 bytes / regular、not symlink |
| Durability | PERSISTENT；0700目录、0600archive/seal；file+directory fsync |
| Original source | `/tmp/uply-r3d-release-candidate/candidate-build.tar.gz`保留、同SHA |
| Existing releases | 未覆盖、未删除；LuAZe…仍作为历史开发artifact保留 |
| Deployment shape | .next/public/package.json/next.config.ts +既有兼容node_modules |
| required-server-files | 19/19存在；1394个归档文件运行后hash未改变 |
| Next / Node | 16.2.10 / 26.5.0 |
| Frozen source | 1306 inputs未变，digest `48b8e7b979b0a158635c82e31e9e0f948742e0e5a0f2ca5e5bab553ec458708c` |

初选releases父目录组可写，helper在复制前拒绝；未改该目录权限。改用用户home下独立私有artifact目录并通过sandbox授权封存；没有覆盖现有release。过程source lstat/SHA → exclusive copy → fsync → destination SHA →全tar可读/安全member → Build ID核验。持久封存不是deploy。

没有npm install/update、没有重新build、没有修改归档或product source。测试只在临时目录解压并链接当前已验证依赖。[persistent-artifact](evidence/teaching-agent-stage-1f-r5b/persistent-artifact.json)、[deployment-shape](evidence/teaching-agent-stage-1f-r5b/deployment-shape.json)。

## 9. New R3D candidate on post-007

真实隔离GoTrue/PostgREST通过Unix socket连接成功post-007克隆，服务仅在internal Docker network；Next/gateway仅localhost临时监听，无Tailscale。创建一个**隔离synthetic Auth user**并将其隔离profile设为Platform Owner；未更改production Auth或读取真实学生名单。

冻结build内NEXT_PUBLIC Supabase地址按Next机制已内联，因此使用外部test preload/gateway将**原build Supabase origin**转到真实隔离Auth/PostgREST，并替换为临时测试key；其他server socket/fetch和browser外连拒绝。archive/source字节未改。此证据证明候选与post-007 schema及UI读取兼容，不声称测试了真实production网络或Provider。

| Route | HTTP | Auth/navigation result | Expected UI text |
|---|---|---|---|
| homepage | 200 | 按源码跳转/login | PASS |
| auth-entry | 200 | 无login重定向 | PASS |
| platform-dashboard | 200 | 无login重定向 | PASS |
| textbook-authoring | 200 | 无login重定向 | PASS |
| script-studio | 200 | 无login重定向 | PASS |

教材制作路径`/platform/dashboard/admin/apps/korean/textbooks`；Script Studio路径`/platform/dashboard/admin/apps/korean/teaching-scripts`。浏览器没有error，未点击Save/Publish或创建lesson/script/nodes。仅验证页面加载和读取，不声称完整authoring工作流再次演练。

Feature OFF、三名单EMPTY；真实“课文讲解”region未出现；另发**一个仅本地隔离candidate的OFF transport probe**，返回404/RUN_NOT_FOUND，未admit Run。Agent rows0，Provider requests0，外部实际请求0；生产Agent请求0。不是用Live Provider做smoke。[candidate-validation](evidence/teaching-agent-stage-1f-r5b/candidate-validation.json)、[content-preservation](evidence/teaching-agent-stage-1f-r5b/content-preservation.json)。

## 10. Forward-only operations and remaining execution conditions

**FORWARD FIX FIRST。Old App Compatibility: NOT REQUIRED BY USER / N/A。** 不测试LuAZe…与005/007兼容，不把它作为FAIL/PARTIAL。未来新app失败时保持Feature OFF、allowlistsEMPTY，优先修新app并经明确批准build新candidate；新candidate/hash变化须重新锁定/验证，不能冒充本归档。已提交000–007默认保留；不DROP Agent表、不手写down migration。仅confirmed database corruption才考虑R4D已验证的restore流程，并另行批准具体recovery point/RPO；不自动恢复旧dump。

单人开发Foundation维护由杨震执行，用户例外已接受；真正外部用户/Pilot前重新确认standby。无zero-downtime/blue-green承诺。当前fixed-path launcher与PM2仍未改；未来必要维护stop/start/restart属于单独授权范围，不自动沿用旧部署脚本中Tailscale操作。

当前R4D backup TECHNICALLY VERIFIED，但已STALE FOR <=15m RPO；真正执行窗口必须新fresh backup并archive validation，第一条migration前age<=15min（任何更大例外必须明确批准）。本阶段没有创建fresh production backup。Window TBD是执行待定项，不降低本次技术READY。

Provider Policy **DEFERRED UNTIL LIVE AI / REAL USER TESTING**，含义是Foundation零Provider阶段不将其作为技术阻断；既有政策仍未批准，Data/Policy Approver未补签。Production content/Pins **DEFERRED UNTIL FOUNDATION INSTALLED**。Stage1G始终NOT READY，Feature/allowlists/definition publication/真实AI测试均未放行。

## 11. Cleanup, verification limits and workspace

三套isolated DB container/volume、两套Auth/PostgREST service及internal network、全部临时private目录/credentials已删除；保留persistent R3D、原/tmp archive、R4D backup、known-good历史release、R5B安全evidence及共享node_modules。拥有的candidate tool session已显式中断关闭，children在finally收尾；sandbox /proc不可见不作为单独的进程停止证明。[cleanup.json](evidence/teaching-agent-stage-1f-r5b/cleanup.json)。

期间修正的是test harness：恢复wrapper缺少旧prefix reference；函数config oracle遗漏006 lock_timeout及007 SET TO语法；首页固定跳转/login的预期。随后readonly验收或全新克隆复验通过；没有修migration、repair ledger或用重试掩盖真实migration失败。保留[harness-corrections.json](evidence/teaching-agent-stage-1f-r5b/harness-corrections.json)说明。

`git diff --check`、新增文件no-index格式、JSON/脚本语法、已知secret值与凭据模式扫描以及原workspace hash差异核验见[workspace-scope.json](evidence/teaching-agent-stage-1f-r5b/workspace-scope.json)。不把catalog权限证明扩写为已执行production DDL，也不把只读页面检查扩写成全面产品回归。

## 12. Gate Matrix

| Gate | Item | Status | Evidence / scope |
|---|---|---|---|
| G-R5B-1 | Migration package locked | PASS | 8 exact filenames/order/hashes; R5A MATCH |
| G-R5B-2 | Persistent artifact | PASS | exclusive copy/fsync/SHA/tar/Build ID; /tmp retained |
| G-R5B-3 | Runner exact range | PASS | fixed eight; missing/extra/order/hash/re-run rejected |
| G-R5B-4 | Atomic DDL+ledger | PASS | same transaction; real ledger-trigger failure rolls back000 DDL |
| G-R5B-5 | Commit contract | PASS | CONFIRMED/NOT_COMMITTED/UNKNOWN; no retry/no next after uncertainty |
| G-R5B-6 | R4D baseline restore | PASS | sealed dump; PG17.6;26 restored categories; original449 full prefix |
| G-R5B-7 | 000 PASS | PASS | CONFIRMED + fresh readonly verify450 |
| G-R5B-8 | 001 PASS | PASS | CONFIRMED + fresh readonly verify451 |
| G-R5B-9 | 002 PASS | PASS | CONFIRMED + fresh readonly verify452 |
| G-R5B-10 | 003 PASS | PASS | CONFIRMED + fresh readonly verify453 |
| G-R5B-11 | 004 PASS | PASS | CONFIRMED + fresh readonly verify454 |
| G-R5B-12 | 005 PASS | PASS | CONFIRMED + fresh readonly verify455 |
| G-R5B-13 | 006 PASS | PASS | CONFIRMED + fresh readonly verify456 |
| G-R5B-14 | 007 PASS | PASS | CONFIRMED + fresh readonly verify457 |
| G-R5B-15 | Final ledger457 | PASS | latest140007; old449 including SQL unchanged; new8 SQL exact |
| G-R5B-16 | Expected objects | PASS | 35 function bodies/config/owner; columns/constraints/indexes/triggers |
| G-R5B-17 | RLS/ACL | PASS | Agent browser denial; service RPC; safe view; skeleton/reconciler ACL |
| G-R5B-18 | Negative tests | PASS | 17 protocol/unit cases + actual rollback/timeout/disconnect/bad ACK |
| G-R5B-19 | Re-run protection | PASS | 457 rejects000, zero migration dispatches |
| G-R5B-20 | R3D candidate post-007 | PASS | real isolated Auth/PostgREST;5 route checks; OFF rejection |
| G-R5B-21 | Deployment shape | PASS | 1394 archive members unchanged after serving;19 required files; Next16.2.10 |
| G-R5B-22 | Maintenance target | PASS | project/host MATCH; readonly TLS verify-full |
| G-R5B-23 | Maintenance privileges | PASS | SUFFICIENT by DB/schema/owner/grant/ledger privilege catalog |
| G-R5B-24 | Credential validity | PASS | VALID at observation; future window must recheck |
| G-R5B-25 | Single-operator dev exception | PASS | ACCEPTED BY 杨震; standby deferred to real rollout |
| G-R5B-26 | Cleanup | PASS | 3 clones/volumes +2 services/internal network/private credentials removed; candidate session closed |
| G-R5B-27 | Production unchanged | PASS | start/end449/130003, Agent tables0, OFF/EMPTY, PM2/runtime/Serve MATCH |
| G-R5B-28 | Old-app compatibility | N/A | USER ACCEPTED FORWARD-ONLY DEVELOPMENT STRATEGY |

## 13. Final Decision

**GO — Development Forward-Only Foundation Engineering Closure。** Technical Package READY；Migration Runner/Mechanism READY；457 integrity PASS；Persistent Artifact READY；New R3D Candidate Post-007 PASS；Maintenance Credential SUFFICIENT/VALID；Production UNCHANGED。

授权包仍 **UNSIGNED / NOT AUTHORIZED**。下一步需要 **EXPLICIT DEVELOPMENT FOUNDATION INSTALL AUTHORIZATION**，包括精确版本/hash、窗口、fresh backup、迁移、候选部署、必要PM2维护与验证。当前未授予production migration/deploy权限，不自动进入安装或Stage1G。
