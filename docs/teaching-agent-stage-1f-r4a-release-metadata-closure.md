# UPLY Teaching Agent — Stage 1F-R4A Release Metadata Closure

## 1. Executive Summary

**Overall: GO（仅 R4A 两项工程整改）。Stage 1G: NOT READY。**

已通过原生成器重新生成 baseline manifest，修正版本索引缺007；R3D浏览器脚本只将局部变量 `module` 改为 `moduleRow`。active SQL、manifest明细和索引现在都是同序、唯一的八份000–007，每份文件名/版本/name/SHA匹配。

Baseline SQL与449 ledger保持字节不变，cutover仍202609130003；同输入连续生成两次完全一致。新增14项定向测试，合计34项Node回归通过；baseline基础7项通过，3项显式环境skip，另单独执行生成器确定性/输入漂移回归通过。Scoped ESLint零错误零警告，TypeScript通过。

R3D application artifact继续 **LOCKED**，无须重建。R4A release metadata及 **Migration Technical Plan: LOCKED**。**Production Migration Authorization: NOT AUTHORIZED / BLOCKED**，不等于READY TO EXECUTE。生产开始/结束只读449/Agent表0、OFF/EMPTY；本任务生产写入和Live Provider请求均0。

## 2. Inputs

完整阅读R3D与R4报告、当前manifest、生成器/共享库、八份post-cutover SQL、author-browser及相关baseline/migration测试。报告作为历史证据，当前文件与实测优先。输入hash见 [reviewed-inputs.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/reviewed-inputs.json)。

开始保存工作区3,122个已有文件SHA；保留原有dirty改动与两个历史migration删除。原始schema-only快照 `/tmp/uply-r1b-snapshot/schema.dump` 的SHA匹配manifest的 `8f31512aa71bd63aa33f8b5e1acd7f657b27c01981103cecc5d9498178260501`。没有改用较晚R3A快照，未新取生产schema或执行SQL migration。

本阶段只处理用户指定两项缺口，不处理R4列出的生产外部阻断。

## 3. Files Changed

| 文件 | 本阶段变化 |
|---|---|
| [baseline-manifest.json](/home/yangzhen/projects/my-lms-system/supabase/bootstrap/baseline-manifest.json) | 原生成器输出；唯一语义差异为postBaselineMigrationVersions追加007 |
| [author-browser.mjs](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3d/author-browser.mjs) | 第41–42行局部绑定及两个引用重命名，共三个identifier |
| [teaching-agent-release-metadata.test.mjs](/home/yangzhen/projects/my-lms-system/tests/teaching-agent-release-metadata.test.mjs) | 新增独立文件清单/一致性/负例和纯内存浏览器关联查询回归 |
| [teaching-agent-stage-1f-r4a-release-metadata-closure.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r4a-release-metadata-closure.md) | 本报告 |
| docs/evidence/teaching-agent-stage-1f-r4a/ | 新生成、验证、制品、metadata及只读安全证据 |

Generator、所有迁移SQL、baseline SQL/ledger、src/public/package/config、ESLint配置、R3D/R4历史报告及旧证据均未修改。最终逐文件范围核验见 [workspace-scope.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/workspace-scope.json)。

## 4. Original Manifest Defect

开始状态：`postBaselineMigrations.length=8`，`postBaselineMigrationVersions.length=7`，索引缺202609140007；明细八项SHA本来就正确。R4的FAIL历史完整保留。

原manifest SHA：`c2fd640518563bfb293f7601fe709f8f3b0a870a99ac93e8783144765e5eeb8c`。原测试检查了迁移明细和索引自身唯一性，但未断言两个数组相等，因此没有拦住手工更新制品后的内部不一致。

## 5. Manifest Generation Contract

[build-supabase-app-baseline.py](/home/yangzhen/projects/my-lms-system/scripts/build-supabase-app-baseline.py) 的 `post = migrations(root, ledger, decisions)` 是唯一清单来源；`postBaselineMigrations = post`，`postBaselineMigrationVersions = [m['version'] for m in post]`。[supabase_baseline_lib.py](/home/yangzhen/projects/my-lms-system/scripts/supabase_baseline_lib.py) 扫描真实active目录，核重复版本、旧ledger历史、cutover及archived/reissue identity。

生成器逻辑已正确，**未修改generator**。用同一个原始snapshot、449 ledger catalog及原固定 `--generated-at 2026-09-14T04:39:15Z`，输出到 `/tmp/uply-r4a-regenerate/a` 与 `b`。先比较baseline SQL/ledger与仓库原件完全相同，再比较两次三个输出文件完全相同，最后只复制生成的manifest到仓库。若baseline不同，脚本断言会STOP且不替换仓库文件。

新回归额外以独立目录扫描检查三方相等，不从manifest推导预期active版本；不靠手补JSON一行结束。

## 6. Migration Inventory

| Version | Active SQL | SHA256 | 核验 |
|---|---|---|---|
| 202609140000 | [202609140000_agent_core_foundation.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140000_agent_core_foundation.sql) | `7abc5545f6cb926c37a74a890fc6fcdbad4f89a5c35474a4628af67b7e0afa8b` | PASS |
| 202609140001 | [202609140001_agent_runtime_completion_evidence.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140001_agent_runtime_completion_evidence.sql) | `a0ece84b6030f029ff68781e3dcffa73e5d7ea2448c33c750ff76c1098f3456b` | PASS |
| 202609140002 | [202609140002_agent_run_cancel_request.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140002_agent_run_cancel_request.sql) | `a8c0d60432a39f08dd45cea08b7ea0e6565885a8d0a65d15118c1f093dc9fb62` | PASS |
| 202609140003 | [202609140003_teaching_operations_reissue.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140003_teaching_operations_reissue.sql) | `cb2a1e90011f154185f4b5695e3a14d00dce9a60e37063c1b38d2ca854fac794` | PASS |
| 202609140004 | [202609140004_completion_policy_management_reissue.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140004_completion_policy_management_reissue.sql) | `20358b17f0deed997263660f15bb0e4c2551caffa6b950d09fc9d4c5d609573e` | PASS |
| 202609140005 | [202609140005_student_teaching_content_isolation.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140005_student_teaching_content_isolation.sql) | `ec4454eea39f38bb9f8a7313b203cea444b831bc90cc1e7d30b070400d4c7674` | PASS |
| 202609140006 | [202609140006_agent_run_reconciliation.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140006_agent_run_reconciliation.sql) | `6014fdee722b967e5264bd827d13f1e45448269f496d8d58c9a1e2ce4528e53a` | PASS |
| 202609140007 | [202609140007_teaching_content_skeleton.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140007_teaching_content_skeleton.sql) | `9d5c34d4e9ef0ff2e9de72db9d3ab1e5ac02bd248f222ddd312042a8c94339a4` | PASS |

八项active post-cutover均在manifest两个数组中，未遗漏003/004 reissue或007 authoring；全部SQL SHA与R4冻结相同。迁移用途沿用R4 §4，不改变顺序、权限、事务或执行方式。

## 7. Manifest Version Index

```text
202609140000
202609140001
202609140002
202609140003
202609140004
202609140005
202609140006
202609140007
```

`active post-cutover versions == postBaselineMigrationVersions == postBaselineMigrations.map(version)`：长度8、顺序和值完全相同；重复0、缺失0、额外0。007存在；cutover202609130003不在post-baseline数组，449历史ledger不含007。

## 8. Migration Hash Verification

每项验证filename存在、filename等于version_name.sql、version/name对应文件名、真实文件SHA对应明细。八份文件还逐项匹配R4 inventory。

迁移inventory digest保持 `4735e8bb64b2619160eb1ad665e6a12f6a5c282f001a684b306f21d3b261a605`：按版本排序的filename/version/sha256对象数组，键排序紧凑JSON UTF-8再SHA256；name另行核验。[migration-static-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/migration-static-result.json)、[node-regressions.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/node-regressions.json)。

## 9. Baseline Integrity

| 项目 | 结果 |
|---|---|
| Cutover | 202609130003 / runtime_authoring_nonretryable_error，UNCHANGED |
| app-schema-baseline.sql | byte-for-byte UNCHANGED；SHA `e5de2f48fa40da53ebcae5353aa4907b1738e15998a304a37b3d0fc555c7bac5` |
| migration-ledger-baseline.json | byte-for-byte UNCHANGED；449；SHA `cf575d233822934d4f1cd51b69c1eb4c8b358cb6b35c814905fdd4555b4f63bf` |
| 007属于baseline ledger？ | 否，仍为post-baseline第八步 |
| Generator / orphan decisions | UNCHANGED |

比较包含真实文件字节，不只是比较manifest宣称的digest。[generation-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/generation-result.json)。

## 10. Deterministic Generation

同输入连续生成a/b，两次manifest、baseline SQL和ledger均byte identical；原generatedAt沿用，未变更格式或加入新的时钟来源。

新manifest SHA为 `8a0f4cbe590eef3b5b8774af92eaaced00ca1b8d1133bde3bfbb9f825c5ac8f6`。单独运行既有 `BaselineTests.test_deterministic_regeneration_and_source_race_guard`：两次生成都与修正后的仓库三个文件一致；将after ledger故意删一项时，实际generator拒绝 `BASELINE_SOURCE_CHANGED` 且不创建输出目录。[generation-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/generation-result.json)、[generator-regression.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/generator-regression.json)。

## 11. R3D Harness Lint Defect

[author-browser.mjs](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3d/author-browser.mjs) 第41行原局部变量 `module` 命中 `@next/next/no-assign-module-variable`。这是Next ESLint特殊变量名规则，R4已记录1 error；不是数据库或浏览器流程错误。

## 12. Lint Fix

仅将绑定和两处引用改成 `moduleRow`；`ids.amodule`、`module_id`查询键、数据表名均保持原样。没有改Auth、选择器、发布、Selection Pin、Agent、输出或异常处理。没有加入eslint-disable，也没有改ESLint配置。

TypeScript parser定位三个改名identifier，将其还原后**整个源码与开始快照字节相同**；语法无diagnostic，五个import可解析。未直接import执行带副作用的浏览器脚本。[browser-static-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/browser-static-result.json)。

## 13. Validation

| 检查 | 本轮结果 |
|---|---|
| 独立migration validator / SQL静态分句 | PASS，八份SQL；只解析，未执行SQL |
| Baseline unit | 7 PASS / 3显式环境SKIP / 0 FAIL |
| Generator deterministic + input race | 1 PASS，原snapshot实际离线pg_restore输出文本 |
| Node targeted regression | 34 PASS / 0 SKIP / 0 FAIL，含新增14项 |
| Browser syntax / import resolution | PASS；node --check、parser及五个import解析 |
| Scoped ESLint | PASS，0 error / 0 warning，--max-warnings=0 |
| TypeScript | PASS，tsc --noEmit --incremental false |
| Python helper syntax | 9文件AST parse PASS；ESLint不适用于Python |

Lint覆盖R3D创建Action、Entry/Form/Listing、NodeForm/Studio、rollout-policy、全部六个R3D mjs、R4A新增测试和两个相关migration/RLS测试。确切命令及原始输出见 [validation-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/validation-result.json) 和对应单项JSON。

## 14. Release Artifact Integrity

R4明确的source digest scope是 `src/**`、`public/**`、package.json、package-lock.json、next.config.ts、tsconfig.json、postcss.config.mjs，共1,306个文件；**不包含baseline manifest、测试或validation harness**。独立重扫当前路径集合及每文件SHA，与旧集合全等，digest仍 `48b8e7b979b0a158635c82e31e9e0f948742e0e5a0f2ca5e5bab553ec458708c`。

[candidate-build.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3d/candidate-build.py) 明确排除supabase目录。其私有工作副本会复制部分scripts/tests，但没有将它们作为本次产品模块使用；src/public/Next/package配置未引用本次改动文件，tsconfig include没有mjs，最终archive只包含.next/public/package.json/next.config.ts。不能将source digest夸大成所有复制文件的digest。

| 制品 | 当前重新核验 |
|---|---|
| Build ID | `6IhDHN8Dm1nCewiCEZnV5` |
| Archive SHA | `1e32c6f6b402e7eb486e81dcbbad26ff18ce9a80a177a2463173276253573d28` |
| .next非cache文件 | 1,377；逐文件摘要重新计算 |
| Artifact digest | `b088781734cd2191c9027b208da70f04d8931b095afaf8a5bd2efe97a777185b` |
| public/package/config | 17归档文件与当前文件字节匹配 |
| 决策 | Application Artifact LOCKED；无需重建；未重新build、打包或部署 |

直接读取 `/tmp/uply-r3d-release-candidate/candidate-build.tar.gz`，不执行制品。Definition离线重新pin，digest `4b6299be0d5fcb33b9bdc10e8c35ac894905cfbf55540522e8628380e2ff3d8c`，匹配R4；没有Provider网络请求。[release-integrity.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/release-integrity.json)、[definition-manifest.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/definition-manifest.json)。

此LOCKED仅指当前可验证工程制品；/tmp不是长期制品库，未来执行前须继续核同SHA，不能据此取得生产授权。

## 15. Release Metadata Re-freeze

新的 [release-metadata-manifest.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/release-metadata-manifest.json) 冻结八份完整migration、正确版本索引、baseline manifest新SHA、baseline/ledger hash、migration inventory digest、Definition、application source/archive/artifact digest及验证输入hash。

| 元数据项 | 冻结值 |
|---|---|
| Reconciler | deadline-terminal-v1 / 202609140006 |
| RLS migration | 202609140005 |
| Authoring migration | 202609140007 |
| R4A metadataDigest | `3f6b85395bba89c87b1478da7a62c94f7f17a25e63a09057f1509e3276152aa0` |
| Release Metadata | LOCKED |
| Migration Technical Plan | LOCKED |
| Production Migration Authorization | NOT AUTHORIZED / BLOCKED |

metadataDigest算法为payload对象递归键排序、紧凑分隔符、Python默认ASCII转义JSON UTF-8的SHA256；只hash payload，排除自身digest，避免循环定义。完整生成manifest副本见 [baseline-manifest.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/baseline-manifest.json)。

R4旧FAIL证据没有重写。迁移SQL digest可不变，但包含修正manifest及验证输入的新release metadata重新冻结。

## 16. Production Safety

开始/结束实际READ ONLY查询确认完整version/name ledger相等且与449 baseline ledger一致、Agent五表均0。TLS verify-full + default_transaction_read_only +显式BEGIN READ ONLY + statement/lock timeout；只查catalog，不访问学生数据。

配置只读采样 `2026-09-15T03:28:22.327748+00:00` 至 `2026-09-15T03:32:53.430580+00:00`，文件SHA一致。按产品真实键 `TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED` 验证OFF，三个TEACHING_AGENT_ALLOWED_*名单均EMPTY。未读取或声称核验不可见的进程内配置。

Production Writes=0；Production Agent Runs=0；Live Provider Requests=0；Migration NOT APPLIED；deploy/PM2/Tailscale/definition/allowlist/FeatureON操作均0。零写仅指本任务，不宣称其他用户同期无业务操作。Production Candidate=0沿用R4内容证据，本阶段未重跑内容/Pins或创建流程。[production-safety.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/production-safety.json)。

## 17. Tests

新增测试包含：实际manifest/files正例；原缺007；两个数组同时缺版本；索引乱序；两数组同时乱序；重复；虚构额外版本；错误SHA；错误filename；错误name；cutover移动；cutover混入；active文件缺失/重复。所有负例均验证拒绝，不修改真实迁移文件。

浏览器fixture从**当前真实脚本AST**提取module/lesson查询及ids赋值四条语句，在VM中用纯内存query替身执行，验证chapter→module→teaching lesson参数顺序、调用结果和ids输出。配合整文件identifier还原字节相同，证明本次改名没有逻辑差异。没有用真实账号启动浏览器，也不声称本轮重跑完整E2E。

34项Node测试还覆盖原Script Studio、迁移身份和RLS静态合同。Baseline默认3项skip中，确定性项本轮另行明确运行PASS；其余schema双路径DB比较和legacy历史重放未重跑。R3D既有Full Supabase、双路径八步/007回滚历史证据保留；generator和所有SQL不变，按本次风险范围无需大型演练。

## 18. Gate Matrix

| Gate | 名称 | 状态 | 本轮证据 |
|---|---|---|---|
| G-R4A-1 | Active Migration Inventory Exact | PASS | [migration-static-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/migration-static-result.json) |
| G-R4A-2 | Manifest Detail Array Exact | PASS | [node-regressions.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/node-regressions.json) |
| G-R4A-3 | Manifest Version Index Exact | PASS | [node-regressions.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/node-regressions.json) |
| G-R4A-4 | Detail / Version Index Equality | PASS | [node-regressions.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/node-regressions.json) |
| G-R4A-5 | Migration File SHA Exact | PASS | [migration-static-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/migration-static-result.json) |
| G-R4A-6 | No Missing Migration | PASS | [node-regressions.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/node-regressions.json) |
| G-R4A-7 | No Duplicate Migration Version | PASS | [node-regressions.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/node-regressions.json) |
| G-R4A-8 | Cutover Correct | PASS | [node-regressions.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/node-regressions.json) |
| G-R4A-9 | Baseline SQL Unchanged | PASS | [generation-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/generation-result.json) |
| G-R4A-10 | Baseline Ledger Unchanged | PASS | [generation-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/generation-result.json) |
| G-R4A-11 | Manifest Deterministic | PASS | [generation-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/generation-result.json) |
| G-R4A-12 | Generator Regression | PASS | [generator-regression.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/generator-regression.json) |
| G-R4A-13 | R3D Harness Lint Fixed | PASS | [scoped-lint.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/scoped-lint.json) |
| G-R4A-14 | No ESLint Suppression | PASS | [browser-static-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/browser-static-result.json) |
| G-R4A-15 | Author Browser Behavior Regression | PASS | [browser-static-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/browser-static-result.json) |
| G-R4A-16 | Scoped Lint PASS | PASS | [scoped-lint.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/scoped-lint.json) |
| G-R4A-17 | TypeScript PASS | PASS | [typescript.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/typescript.json) |
| G-R4A-18 | Release Artifact Integrity | PASS | [release-integrity.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/release-integrity.json) |
| G-R4A-19 | Release Metadata Re-frozen | PASS | [release-metadata-manifest.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/release-metadata-manifest.json) |
| G-R4A-20 | Production Ledger Unchanged | PASS | [production-safety.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/production-safety.json) |
| G-R4A-21 | Production Writes Zero | PASS | [production-safety.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/production-safety.json) |
| G-R4A-22 | Production Feature OFF | PASS | [production-safety.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/production-safety.json) |
| G-R4A-23 | Live Provider Zero | PASS | [production-safety.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4a/production-safety.json) |

23/23 PASS，仅R4A技术闭环。G-R4A-15同时依赖node-regressions中的fixture结果；21/23零写零请求为本任务操作边界记录，不冒称生产动态Agent验证。

## 19. Remaining Production Blockers

| 阻断 | 状态 |
|---|---|
| Production content / Pins | Candidate0 / BLOCKED |
| Single-lesson scope | BLOCKED；未证明恰好一课或冻结范围 |
| Tailscale approval + verification | APPROVAL REQUIRED，实际验证BLOCKED |
| Provider policy approval | BLOCKED / APPROVAL REQUIRED |
| Operator staffing | NOT ASSIGNED |
| Monitoring ownership | NOT ASSIGNED |
| Backup / recovery | BLOCKED；本阶段没有新恢复点或授权 |
| Production change authorization | NONE / NOT AUTHORIZED |

Reconciler值守和receipt/tenant范围接受也未落实。未代签、未联系他人、未新增身份或变更上述状态。

## 20. Stage 1G Readiness

**NOT READY。** R4A仅移除manifest和lint两项工程阻断；迁移技术输入LOCKED，不等于Production Migration Plan整体READY TO EXECUTE。Operator、backup、窗口和变更批准以及真实内容/网络/Provider前置仍缺失。

## 21. Final Recommendation

接受R4A工程整改结果 **GO**，停止在Release Metadata & Validation Closure。Application Artifact、Release Metadata、Migration Technical Plan均LOCKED；Production Migration NOT APPLIED / NOT AUTHORIZED，Stage1G NOT READY。

保留R3D/R4原报告与证据。后续生产事项必须依据实际内容、组织和运维授权重新评估；本轮不进入Stage1G、不部署、不执行生产迁移、不修改生产内容、Tailscale或Feature Flag。
