# Stage 1F-R7C-B — Canonical Activity Binding & Current-DB Durable Verification

> 最新状态（B1D部署与单次创建完成后）：**B1 COMPLETE / GO**；B2 **BLOCKED / NOT APPROVED**；整体R7C-B **CONDITIONAL**，current-DB durable E2E仍受测试身份阻塞。下文早期NO-GO和等待批准段落均保留为历史；最终回执见文末。

> 历史记录：以下原始 NO-GO / BLOCKED 审计及 Direct PG、per-run identity 提案保留。最新结果见文末 Approved B1 Implementation Result；B1/B2 五节保留批准前决策；旧提案不再作为实施依据，且从未获批或实施。

## 1 Executive Summary

Overall: NO-GO。Execution Status: BLOCKED。只读审计完成；尚未创建 canonical Activity。阻断项：**CURRENT-DB TEST IDENTITY BLOCKER**。本结论不是 R7C 已通过的隔离测试发生失败，而是当前 DB 的合法测试身份合同尚未确认。

## 2 Teaching Agent Mainline

主线保持 UPLY Teaching Agent / AI 韩语教师助手；本阶段不创建独立 Runtime、Activity 或 Progress 系统。

## 3 R7C Input

接受 R7C 的 CONDITIONAL / TEST-ENV VERIFIED 历史结论。R7C 131/131 合并回归仅是历史证据，本次未重跑。R7C 的隔离 prompt UPDATE 授权偏差保留原报告；本次没有此类修改。

## 4 Scope

本次实际范围：源码、schema/权限及目标只读审计，冻结内容验证，新增本阶段文档。未进入任何产品代码或 DB 写入。

## 5 Authorization

R7C 的历史隔离测试批准不覆盖本阶段当前 DB 写入。第11节精确写入批准尚未请求。用户最新指示已允许继续不依赖学生身份的 canonical binding 设计，并要求提出新的正式身份合同；这不授权产品代码、Auth 或业务数据写入。Authorization Deviation: NO。

## 6 Production Preflight

PostgreSQL 17.6；Ledger 457；Latest 202609140007；Build 6IhDHN8Dm1nCewiCEZnV5；PM2 online。唯一 canonical chain、version1 draft、8 nodes，active inconsistent fences=0。Feature OFF / Allowlists EMPTY。详见 preflight.json。

## 7 Canonical Binding Gap

目标 execution node / Activity / private answer 均为0。Activity FK明确指向 digital_textbook_nodes；activity_key及其父节点内唯一约束可表达别名，无需为 alias migration。

## 8 Authoring Implementation

审计方向为 B：最小受保护的正式 authoring action/repository workflow。现有 grammar node helper 绑定 grammar；chapter-practice 创建另一种练习包，不能用于 orientation Activity。当前 catalog 未找到创建该三行对象的通用 RPC。已形成独立的 canonical-only 文件与三行事务设计，见 implementation-plan.json；无需先建立学生身份即可另行批准该内容创建。当前尚未批准或实现；durable execution 仍被身份合同阻断。

### Canonical-only binding plan (proposal)

该计划不需要学生身份，预期仅 INSERT execution node、Activity、secret 各1条，其他业务表、Auth、attempt/progress、冻结内容写入均0。现有 authoring statement guards 只检查/加锁，不能关闭。

新增文件拟为：

- `src/app/[space]/dashboard/admin/digital-textbook/native-activity/page.tsx`
- `src/features/smart-textbook-runtime/server/native-activity-authoring.actions.ts`
- `src/features/smart-textbook-runtime/server/native-activity-authoring.server.ts`
- `src/features/smart-textbook-runtime/server/current-db-transaction.server.ts`

`package.json`、`package-lock.json`拟增加支持真实单连接事务的 PostgreSQL driver；当前工程尚无该直接依赖，版本选择及兼容验证留在批准前审查。测试文件见 implementation-plan.json，隔离测试 bootstrap 的精确写入数量也必须独立列入批准。不要运行默认全库测试命令产生未授权测试写入。

入口为现有 authenticated Platform Owner 会话内的受保护 dev authoring page/Server Action，正常应用授权在每次POST重新执行。单事务内锁定唯一draft父链、验证冻结hash和三行空状态、按最小公开内容创建三行、断言计数后提交。完整既有对象返回 EXISTING；部分对象或未知commit立即停并独立readback。不要新建RPC、migration、第二套内容权威或 Activity 系统。

当前不承诺跨origin认证自动可用：若隔离dev入口无法复用现有正常session，必须停在环境限制，不复制Cookie/JWT、不重新登录、不擅自部署。

### Proposed reusable identity contract

`development-domain-execution/1` **PROPOSED ONLY**，详见 dev-test-execution-identity-proposal.json。

| Concern | Contract proposal |
|---|---|
| Subject | 每个run/scenario的专用非人类测试principal；不使用操作者或真实学生作为作答主体 |
| Existing FK | attempt/progress当前需要auth.users与tenants；不可用任意UUID替代。未来只能经另批的正式Admin provisioning生命周期建立专用无登录principal |
| Identification | server私有run registry + Admin控制的app_metadata标记 +专用测试tenant；邮箱前缀或user_metadata不构成授权 |
| Authority | 正常Owner批准/签发受控测试scope；每次mutation校验development部署、DB身份、subject/tenant、target、期限与write budget；service权限本身不等于授权 |
| Production | production composition不接入issuer；StudentPolicy及published-only规则不变；不创建学生会话、magiclink或impersonation token，不成为fallback |
| Durability | 私有registry仅保存身份与生命周期定位；completion仍来自既有attempt/progress，重启使用同一scenario主体readback |
| Cleanup | 精确登记引用，先子记录后主体；不CASCADE，不删除canonical rows。无法安全删除或需保留audit引用时，保留disabled主体并关闭scope |

Auth principal创建并非单行写入：当前handle_new_user会新增profile，profile审计会新增account_management_audit_logs，Auth metadata同步会更新profile，角色/状态更新可能同步membership。因此本proposal不宣称“Auth INSERT 1、其他0”。正式实现前必须在隔离schema审计完整触发副作用，锁定实际Auth/API/审计/tenant/scenario写入和保留政策并另行批准；当前均为0。

专用principal必须在scope激活前被证实不能登录。若现有正式Auth API无法安全提供所需生命周期，停止并提交最小替代方案，不修改Auth触发器、不发明临时用户、不放松StudentPolicy。

## 9 Execution Node

未创建。后续仅最小 practice parent / public binding anchor，不复制 Node7 冻结正文。

## 10 Activity

未创建。仅规划第一题、single_choice 域及 multiple_choice renderer；第二题继续 DEFERRED。

## 11 Private Answer Boundary

现有 secrets 表 RLS 开启，authenticated SELECT/INSERT 均无权限，server service_role 可读取。未读取或导出任何目标私有答案行。publicNativeActivity 使用白名单。当前 DB runtime 的 DOM/网络泄漏验证尚未执行；不得宣称 E2E PASS。另需审查 attempt.response 内 definitionDigest 的可见性，不能仅凭 hash 声称私有配置不可推断。

## 12 Current DB Durable Attempt

NOT EXECUTED。CURRENT-DB TEST IDENTITY BLOCKER：attempt.student_id -> auth.users.id，tenant_id -> tenants.id。已审计源码和 catalog 未找到可用于当前 DB 的合法 dev/test actor 合同。不选择任意账号，不创建 Auth 用户。

## 13 Current DB Progress

NOT EXECUTED。既有 node_progress 同样引用 auth.users/tenants。R7C 的合成 FK 仅在一次性隔离库有效，不能复制为当前 DB 身份。

## 14 Independent Readback

当前 DB 正式7参数 RPC存在；R7C repository 使用独立 READ ONLY readback。但未绑定目标 Activity/合法actor，COMPLETED / INCOMPLETE / UNKNOWN 行为本次均未执行。

## 15 Idempotency / Lost Response

NOT EXECUTED。后续仍须经 R7C trusted transaction seam，不直接裸RPC、不走 PGRST202 fallback。负向测试只使用 transport/read-port fault injection，不修改 canonical prompt。

## 16 Restart Persistence

NOT EXECUTED；未启动/停止隔离执行服务，更未操作生产 PM2。

## 17 LessonRuntime Current-DB E2E

BLOCKED。现有 Owner audit preview 的 tenantId=null、preview=true，仅返回判分，不写 attempt/progress。正式 learning-session 使用已发布内容，不能给 Draft 绕过 admission。

## 18 Runtime Facts

本次未生成 current-DB completion facts。R7C receipt 仍标 isolated-test-db；不得仅改标签冒充当前DB证据。

## 19 Answer Leakage

本次新 evidence 无原始 UUID、账号凭据、答案值/标记、secret row或private definition digest。未运行的 Manifest/DOM/client/network 检查明确 NOT EXECUTED。

## 20 Frozen Content Protection

独立首尾 READ ONLY 查询核对 R6F baseline：8节点全行hash、版本行hash、学习目标hash一致；canonical父链不变。Teaching Node / Script Version / Objectives writes均0。

## 21 Test Data / Cleanup

未创建 canonical rows、test actor、attempt、progress；无需清理，DELETE=0。后续必须在写入批准中先定义测试数据保留/精确清理政策，不能CASCADE。

## 22 Regression

R7B/R7C 回归未重跑；本次产品源码0改动。不能把历史131/131当作本阶段测试结果。Build/TypeScript/lint未重跑，既有3条Hook问题未修改；新增lint错误引入0。

## 23 Production End-State

execution node=0、Activity=0、private answer=0、target attempts=0、target node progress=0。Script Version1 DRAFT、8 Frozen Nodes unchanged。Publish/Agent/Provider/Pins/Migration/Deploy/PM2/Runtime/Launcher/Tailscale/Auth writes均0。Feature OFF / Allowlists EMPTY。

## 24 Gate Matrix

见下表。BLOCKED代表前置条件未满足、未执行，不代表测试运行后失败。

| Gate | Result |
|---|---|
| G-R7CB-1 R7C Test Durable Contract Accepted | PASS |
| G-R7CB-2 R6F Freeze Verified | PASS |
| G-R7CB-3 Target Binding Empty Before | PASS |
| G-R7CB-4 Exact Write Authorization | BLOCKED |
| G-R7CB-5 No Authorization Deviation | PASS |
| G-R7CB-6 Existing Schema Reused | PARTIAL |
| G-R7CB-7 No Migration | PASS |
| G-R7CB-8 Official/Canonical Authoring Path | BLOCKED |
| G-R7CB-9 Execution Node Created | BLOCKED |
| G-R7CB-10 Activity Created | BLOCKED |
| G-R7CB-11 Private Answer Created | BLOCKED |
| G-R7CB-12 Parent Chain Correct | BLOCKED |
| G-R7CB-13 Duplicate Zero | PASS |
| G-R7CB-14 Public Prompt Safe | BLOCKED |
| G-R7CB-15 Private Answer Server Only | PARTIAL |
| G-R7CB-16 Current DB Wrong Attempt | BLOCKED |
| G-R7CB-17 Current DB Correct Attempt | BLOCKED |
| G-R7CB-18 Existing Progress Updated | BLOCKED |
| G-R7CB-19 INCOMPLETE Readback | BLOCKED |
| G-R7CB-20 COMPLETED Readback | BLOCKED |
| G-R7CB-21 UNKNOWN Readback | BLOCKED |
| G-R7CB-22 Lost Response Safe | BLOCKED |
| G-R7CB-23 No Blind Retry | PASS |
| G-R7CB-24 Idempotency | BLOCKED |
| G-R7CB-25 Restart Persistence | BLOCKED |
| G-R7CB-26 Current DB Runtime Pause | BLOCKED |
| G-R7CB-27 Wrong Holds | BLOCKED |
| G-R7CB-28 Correct Durable Completion Resumes | BLOCKED |
| G-R7CB-29 Cue Dedupe Regression | BLOCKED |
| G-R7CB-30 Seek Regression | BLOCKED |
| G-R7CB-31 Refresh Regression | BLOCKED |
| G-R7CB-32 Stale Generation Regression | BLOCKED |
| G-R7CB-33 Runtime Facts Current DB Evidence | BLOCKED |
| G-R7CB-34 Runtime Facts No Private Answer | BLOCKED |
| G-R7CB-35 Public Leakage Scan | BLOCKED |
| G-R7CB-36 Frozen Nodes Unchanged | PASS |
| G-R7CB-37 Script Version Unchanged | PASS |
| G-R7CB-38 Mock Cue Still Nonpersistent | PASS |
| G-R7CB-39 No Agent Run | PASS |
| G-R7CB-40 No Provider | PASS |
| G-R7CB-41 No Publish | PASS |
| G-R7CB-42 Feature OFF | PASS |
| G-R7CB-43 Allowlists EMPTY | PASS |
| G-R7CB-44 No Legacy Fallback | PASS |
| G-R7CB-45 Build Pass | N/A |
| G-R7CB-46 Tests Pass | N/A |
| G-R7CB-47 New Lint Errors Zero | PASS |
| G-R7CB-48 Evidence Boundary | PASS |

## 25 Remaining Agent Gap

当前 DB canonical authoring、合法 controlled execution actor/scope、durable current-DB E2E 尚未闭合。Lesson Tool / Agent binding 不开始。

## 26 Next Stage

继续当前 R7C-B。canonical-only 三行绑定可独立提交批准，attempt/progress 写入保持0。新的 development-domain-execution/1 合同需单独审阅并锁定身份生命周期写入范围后批准；两者均不代表当前 durable E2E 通过。R7D 未获准进入。

## 27 Final Recommendation

NO-GO / BLOCKED — CURRENT-DB TEST IDENTITY BLOCKER。保留全部冻结内容与现状。用户已确认无已知现成合同。已完成只读复核及 canonical-only 设计、新身份合同 proposal；均未实施。canonical 创建可以另批，durable execution 必须继续等待合法 test scope。

Evidence: [R7C-B evidence](evidence/teaching-agent-stage-1f-r7c-b/)

## Canonical Authoring Path Decision

继续同一个 R7C-B，拆分 B1 与 B2，均不进入 R7D。**推荐 B：Owner authenticated UI → Server Action → 正式 RPC → 单数据库事务。**

| 维度 | A 现有应用事务设施 | B 小型正式 RPC | C 新增 Direct PG |
|---|---|---|---|
| 安全 | 现有 typed RPC 可复用，未找到通用可用的三表事务入口 | DB重复验证真实Owner、active状态、父链、冻结hash；固定search_path与精确ACL | 增加应用直连数据库权限与网络边界 |
| 原子性 | Supabase三次insert不是原子事务；R7C仅有隔离test SQL transport | 一次RPC事务包含全部三行；异常整体rollback | 可实现，但需要新增连接事务设施 |
| 凭据 | 沿用Supabase正常session | 同左，无新增Next数据库密码 | 增加DB连接凭据、TLS/pool管理 |
| 部署 | 缺少适用现成RPC | 一条经批准migration新增function/grants与ledger | 新依赖及应用运行配置 |
| 一致性 | 可复用模式，不能直接复用业务操作 | 匹配已有create_teaching_content_skeleton | 非当前应用正式模式 |
| 测试维护 | R7C seam可供隔离测试 | 真实PG原子性/ACL测试，边界清楚 | 多一套driver/pool/connection管理 |

现有 skeleton RPC 已采用 SECURITY DEFINER、空search_path、auth.uid/Owner检查、拒绝provisioned account、authoring_lock、authenticated EXECUTE且拒绝service_role直接调用。新增RPC复用此模式，不调用旧Learning Agent、不绕过fence。Migration Required: YES；Direct PG Driver: NOT RECOMMENDED；package.json无需修改。

## R7C-B1 Approval Package

**Approval A READY — 尚未批准，尚未执行。**仅涵盖B1正式authoring实现、单条migration安装及canonical三行创建；不涵盖B2身份或attempt/progress。

新增文件精确范围：

- `supabase/migrations/202609170001_teaching_lesson_activity_binding.sql` — One owner-authenticated atomic RPC + explicit grants; no tables/seeds/identity operations
- `src/features/digital-textbook/api/create-native-activity.ts` — Server Action reauthenticates Platform Owner, uses authenticated Supabase RPC, sanitizes result, no retry
- `src/features/digital-textbook/server/native-activity-authoring.server.ts` — server-only target/freeze contract, read-only preflight and receipt validation; private answer stays server-side
- `src/features/digital-textbook/components/create-native-activity-form.tsx` — Minimal confirmation/status form; public question only; UNKNOWN state disables resubmit
- `src/app/[space]/dashboard/admin/apps/[appSlug]/textbooks/native-activity/page.tsx` — Official app-scoped Owner authoring page; no runtime/preview/student admission
- `tests/teaching-agent-r7cb-authoring.test.mjs` — Authorization/public DTO/unknown response/source-boundary tests
- `tests/teaching-agent-r7cb-authoring-db.test.mjs` — Owned isolated DB RPC atomicity/FK/freeze/duplicate/rollback tests
- `tests/fixtures/teaching-agent-r7cb/authoring-fixture.mjs` — Reuse owned R7C PG transport; exact canonical-freeze fixture, no current DB credentials/Auth service

现有产品文件修改：0。继续更新本报告及R7C-B evidence。

| 当前DB预期写入 | 数量 |
|---|---:|
| digital_textbook_nodes INSERT | 1 |
| digital_textbook_activities INSERT | 1 |
| digital_textbook_activity_secrets INSERT | 1 |
| 以上表 UPDATE / DELETE | 0 |
| 其他业务表 | 0 |
| DB内容audit rows | 0，现有表无专门插入audit trigger；生成安全本地receipt 1份 |
| Auth / Frozen Nodes / Script Version / Objectives | 0 |
| Attempts / Progress | 0 |
| Migration | 1：202609170001，新function及ACL；ledger预期457→458 |
| Publish / Agent / Provider / Pins / Deploy / PM2 mutation | 0 |

迁移不seed内容；安装后再通过本人正常Owner session执行正式Action。迁移只允许该精确文件，不运行包含其他pending历史文件的广泛db push。安装前单独锁定最终SQL/diff/hash并做完整隔离验证；若范围变化须补批准。

RPC事务内重查R6F hash、唯一version1 draft、8节点、顺序/类型、父链和目标三表空状态；取得现有authoring锁及源/父行锁，三次INSERT后断言精确计数。已存在完整匹配对象返回EXISTING且0写入；partial/duplicate/hash mismatch拒绝；UNKNOWN停止并用新READ ONLY连接核对。最终receipt不泄露私钥/私有digest/raw UUID，也不把事务内now()伪称精确commit时间。

隔离authoring测试使用现有owned PG transport和明确的本地schema/冻结图fixture，不接当前DB凭据或Auth服务。测试范围详见r7c-b1-approval-package.json；若实施需超出其中bootstrap对象/操作，必须先补批准。B1完成保留canonical行，identity未就绪时不回滚Activity、不运行durable E2E。新UI仅在隔离dev进程运行；若无法复用正常Owner session，停止，不转移Cookie/JWT或擅自部署。

## Development Execution Identity Revision

B2合同仍为development-domain-execution/1，**专用development tenant + 一个稳定非个人execution actor**。human=false/login=disabled/production_allowed=false等metadata是意图标签，不是登录安全证明。

现有Auth SDK有ban_duration；参考仓库隔离镜像对应的 [GoTrue v2.195.0 Admin源码](https://raw.githubusercontent.com/supabase/auth/v2.195.0/internal/api/admin.go) 显示create可在同事务设置ban，并产生user/identity/audit等写入。[password grant](https://raw.githubusercontent.com/supabase/auth/v2.195.0/internal/api/token.go) 与 [verify流程](https://raw.githubusercontent.com/supabase/auth/v2.195.0/internal/api/verify.go) 均有禁用检查。这只是版本参考，尚未证明当前托管Auth版本、配置及完整发行路径一致。

Login Disabled Contract: **BLOCKED，候选控制和验证清单已定义，未验证**。激活scope前必须在经批准的隔离Auth/API环境证明password、magic-link verify、OTP以及refresh/其他发行路径均不能产生会话；当前DB不生成链接或执行登录。检查ban覆盖scope有效期、无有效session/refresh grants、应用profile禁止交互登录；长时ban是有限时间，不能冒充永久不可变禁用。若能力不足，停止B2，保留B1，另提最小替代方案，不改Auth trigger或StudentPolicy。

当前只静态定位了Auth users/identities/audit、profiles及metadata sync/account audit、tenant/membership等副作用。**精确API与行数尚未映射**，本轮未执行隔离provisioning。因此不得申报Auth INSERT1/其他0，更不能申请不完整的当前DB身份批准。

## Stable Actor vs Per-Run Actor Decision

决定：**STABLE REUSABLE**。生命周期 PROVISION → ACTIVATE SCOPE → RUN SCENARIO → READBACK → DISABLE SCOPE → REUSE → RETIRE。仅一次provision，多次scope/run；不依赖个人账号，不创建学生JWT或交互session，production composition不加载issuer。

现有attempt唯一性、max_attempts与completion按tenant+actor+Activity积累，不带scenario隔离。故一个actor/Activity同时只允许一个scenario；重启保持相同scenario和记录。要重复“未完成→完成”测试，必须在run结束后另批精确清理该测试主体对应的attempt/progress并核对空基线；若选择保留completed记录，下次只能验证恢复/只读，不可用新run ID伪造INCOMPLETE。不能为此创建第二套progress或改用registry判定完成。

registry仅保存scenario/actor引用/tenant/target/start/end/expiration/write budget/state；不保存答案、correctness或completion truth。身份在scope外仍禁用登录；retire需引用审计，不CASCADE，不删除canonical行。

## R7C-B2 Approval Package

**Approval B BLOCKED — 现在不请求identity provisioning批准。**稳定actor1、专用tenant1是目标数量，不是完整DB副作用计数。必须先取得单独、明确的隔离Auth/API副作用与禁用登录验证授权，锁定Auth/Profile/Audit/Tenant/Membership/其他trigger每类写入后，再形成可批准的B包。

A与B完全独立：批准A不授权任何身份创建、Auth操作、attempt/progress或current-DB E2E。当前durable执行继续BLOCKED；B1可先实施。现有NO-GO历史保留，R7D/Stage1G仍NOT READY，Feature OFF / Allowlists EMPTY / Agent0 / Provider0。

## Approved B1 Implementation Result

用户已批准 Approval A。按精确范围新增8个文件：Owner Server Action、server-only frozen contract/private answer、最小authoring页面、原子RPC migration及隔离测试。没有引入Direct PG、第二套Activity或Progress系统。上文“尚未批准/未实施”是批准前历史，不再代表B1产品代码状态。Approval B仍未批准。

**B1实现已完成并验证，当前DB应用仍BLOCKED。** 与B2身份问题独立的新阻塞为 `OWNER_AUTHENTICATED_DEV_AUTHORING_UI_UNAVAILABLE`：现有443/3001入口实际为另一应用登录页；4000目标页无法加载；8443为未包含新代码的生产构建。只进行了现有Chrome GET/只读检查，没有登录、转移会话、点击创建或更改服务。按Approval A明确的环境停止条件，不改用管理员冒充，不擅自部署/改代理。

### B1 validation and exact effects

- Authoring unit/isolated PostgreSQL：15/15 PASS，覆盖角色/ACL、冻结校验、partial拒绝、三次INSERT各失败点整体rollback、并发只创建一组、existing mismatch拒绝、公开receipt及未知结果重复保护。
- Next16.2.10 webpack独立构建PASS；TypeScript PASS；新增4个产品TS/TSX文件lint0 errors/0 warnings。正确构建目录为 `/tmp/uply-r7cb-isolated-build`，没有替换生产构建。较早误用旧R7C临时目录的构建不计入证据。
- 新migration `202609170001` 已编写和隔离验证，**当前DB未安装**；ledger仍457/latest202609140007。
- 独立READ ONLY确认execution node0、Activity0、private answer0、新RPC不存在；R6F 8个节点、version1 Draft、objectives hashes全部不变。
- 当前DB business/Auth/attempt/progress writes均0，Publish/Agent/Provider/Pins0，Feature OFF / Allowlists EMPTY，Deploy/PM2/Tailscale/launcher修改0。隔离authoring fixture按批准范围创建后销毁，未执行current-DB durable测试。
- R7B/R7C Runtime全套回归保留历史结论，本B1未重跑；未将authoring测试冒称Runtime或current-DB E2E通过。当前实际浏览器创建、公开network payload及current DB绑定仍未验证。

### Separate remaining blockers

| 子项 | 当前结果 | 下一项条件 |
|---|---|---|
| B1 Canonical Activity Binding | 产品实现/隔离测试READY；current DB0/0/0 | 在正常Owner会话可访问的隔离UPLY开发入口打开新authoring页，然后执行已批准的单migration及单次创建/独立readback；如需新的部署/代理范围必须另批 |
| B2 Development Execution Identity | BLOCKED，未创建身份 | 单独完成不可登录合同及完整Auth副作用审计，随后请求Approval B |

Overall仍NO-GO / Execution BLOCKED。这不是因缺失test actor阻止authoring代码实施；B1停于其自己的浏览器执行环境条件。已获批A保持有效，无需重复批准同一代码/三行范围。本次未进入R7D或Stage1G。

证据：`b1-source-lock.json`、`b1-test-results.json`、`b1-owner-dev-access.json`、`b1-implementation-readback.json`、`build-results.json`、`canonical-write-receipt.json`。

## R7C-B1C Environment Audit

本轮仅只读审计与Approval Package准备。8443确认是canonical UPLY：Tailscale HTTPS8443 →127.0.0.1:3000，PM2 `uply-first-enable` online，Build `6IhDHN8Dm1nCewiCEZnV5`，工作目录 `/home/yangzhen/releases/uply-first-enable-20260910/source`。固定launcher从私有runtime.json加载环境并执行Next start；本轮未导出其值，未改进程/配置。8443 root GET200。没有再次访问443另一应用或4000入口。

8个B1文件全部source-lock MATCH；现有15/15测试、TypeScript、scoped lint和build日志hash仍匹配，git diff --check PASS，敏感literal扫描无命中。注意：已有工作区Build `jSxpyVg5NZMbpHc7Gptpz` **不作为发布候选**，因为包含其他未部署改动。R5C仅部署编译artifact，live src也不是当前Build的完整源快照，不能直接在其上增量重建。

已用R3D baseline + 最终修改/new-file SHA恢复当前Build对应源码；所有文件均找到hash匹配字节来源，补上4个B1应用文件，候选清单共1313文件、无缺失。public目录与live完全一致。候选源码SHA：`6f0017392d5475f5dcad927235f7b9cccf74c9a6891200030c2d02c69fdb25eb`。这是源码集合hash，不是尚未生成的新Build ID或编译artifact hash。批准后从清单构建并封存；不整包部署当前工作区，不回退已部署R3D行为。

现有R3D回滚archive SHA `1e32c6f6b402e7eb486e81dcbbad26ff18ce9a80a177a2463173276253573d28`，1394文件与当前live匹配。旧artifact仅作回滚，不运行第二实例。

## Approval A-Environment Package

**READY / AWAITING APPROVAL**，完整精确范围见 `approval-a-environment.json`。当前用户明确要求实际migration安装、canonical部署和PM2操作另批；此前Approval A不再作为这些环境操作的执行许可。

应用新增仅4个已批准文件：

- `src/features/digital-textbook/api/create-native-activity.ts`
- `src/features/digital-textbook/server/native-activity-authoring.server.ts`
- `src/features/digital-textbook/components/create-native-activity-form.tsx`
- `src/app/[space]/dashboard/admin/apps/[appSlug]/textbooks/native-activity/page.tsx`

另外保持已锁定的1个migration和3个test/fixture文件；没有其它产品修改。迁移仅 `202609170001`，SHA `6ec786c2ff4c6c4a39da297e72d20359746a4225f5ba5028ecce38253947f78c`；当前ledger457/latest202609140007，预期458/latest202609170001。仅function/ACL与ledger1行，不使用db push，不执行其它pending migration。

批准后的业务操作仍为正常Owner UI单次创建execution node1、Activity1、secret1；0 UPDATE/DELETE。Frozen/Script Version/Objectives/Auth/Attempt/Progress/Agent/Provider/Publish/Pins均0，Feature OFF/Allowlists EMPTY。题目公开文案沿用已批准并锁定的“哪个是元音？”，对应冻结Node7第一题；不改为新文案，不连接第二题。

新backup计划：`/home/yangzhen/backups/uply/<fresh-backup-UTC>`，通过现有snapshot备份原语与隔离恢复验证。新部署回执/候选/rollback目录：`/home/yangzhen/operations/uply/teaching-agent/r7cb-b1c/<approval-UTC>`。本轮这些目录和backup均未创建。批准后只切换live `.next`并添加4个应用文件；公共资源、依赖、配置、launcher、Tailscale不变。offline构建不启动第二UPLY实例。仅stop/start已有 `uply-first-enable` 条目。

回滚：停止同一PM2进程，保留失败artifact，恢复pre-switch `.next`，将仅本次4个新增源码移出live，启动同一条目并核验旧Build。新增RPC可保留；不自动DROP/删除ledger，不删除合法canonical行，不做全库restore。任何额外产品依赖/配置变化或破坏性恢复需要另批。

## Migration Install Receipt

NOT EXECUTED — 等待Approval A-Environment。只读复核ledger457，RPC未安装，binding0/0/0。

## Canonical Deployment Receipt

NOT EXECUTED — 新候选Build ID在批准后构建并校验，再激活；本轮PM2/Deploy0。

## Owner UI Validation

PENDING — 批准部署后仅复用现有8443 Owner Chrome会话。正常GET确认角色/app/target后单次创建；UNKNOWN立即停止并独立readback，不登录、不转移会话、不重试。

## Canonical Binding Receipt

NOT EXECUTED。当前execution node0/Activity0/private answer0；冻结8节点/version1 Draft/objectives重新hash VERIFIED。

## B1 Final Closure

B1产品实现READY，A-Environment审批包READY，canonical激活尚未执行，B1尚未COMPLETE。B2仍BLOCKED/NOT APPROVED；current-DB durable E2E仍BLOCKED BY TEST IDENTITY。两项独立；本轮不进入B2、R7D或Stage1G。保留上述历史BLOCKED事实，未将准备工作记作部署成功。

## R7C-B1C Approved Execution Result

用户明确批准A-Environment后，已完成备份、单migration、最小候选构建及canonical8443部署。**Environment Activation PASS；Canonical Binding仍BLOCKED；Overall NO-GO。** 前述“等待批准/尚未安装”是执行前历史，完整保留。

### Fresh backup and migration

Fresh backup：`/home/yangzhen/backups/uply/20260917T061353Z`。26项隔离恢复比较PASS；仅恢复到owned network-none PG17.6，已清理其container/volume，保留备份。维护回执目录：`/home/yangzhen/operations/uply/teaching-agent/r7cb-b1c/20260917T061353Z`。准备脚本第一次因一个已停止PM2条目缺少PID在只读检查时退出，尚未启动备份/执行DB写；修正读取后继续，没有操作该进程。

唯一migration `202609170001` 单次dispatch已CONFIRMED，function/ACL及ledger在同事务提交，ledger457→458/latest202609170001。authenticated EXECUTE允许，anon/service_role拒绝，SECURITY DEFINER/空search_path验证通过；已发送标准PostgREST schema reload通知。未执行db push或其它pending migration；migration后业务绑定仍0/0/0。

### Canonical deployment

新Build：`YEYLRN3hvVg2OY0NJ9NO9`；候选源SHA `6f0017392d5475f5dcad927235f7b9cccf74c9a6891200030c2d02c69fdb25eb`。从R3D精确源码基线加4个B1应用文件构建，Next编译/TypeScript PASS，所有源hash保持。候选archive SHA `f4d9a7d0127b3189fefcb948d6ea6ed46eae6bd39ae409755d781158c2577ec7`。仅stop/start已有 `uply-first-enable`，保留原 `.next`于 `/home/yangzhen/operations/uply/teaching-agent/r7cb-b1c/20260917T061353Z/rollback/previous-next`。没有创建第二实例或修改runtime配置、launcher、Tailscale、其他PM2进程。

root、平台dashboard、韩语app、正式教材制作`/textbooks`、ScriptStudio、新authoring页面均HTTP200。初次健康检查误用`/textbooks/workbench`导致404；已确认新旧Build都没有该route，修正的是检查路径，没有修改产品代码或重新部署。

### Owner UI and exact new blocker

原Owner会话成功进入新authoring页；页面角色平台负责人、app韩语、目标韩文字母入门/第0章/课前导航、version1草稿8小节均可见。创建按钮禁用，显示“目标状态不符，已停止创建。” **未点击创建，logical create attempts0，创建RPC调用0。** 不存在UNKNOWN commit或重试。没有重新登录、转移Cookie/JWT或冒充身份；证据不保存页面个人信息。

Root cause：`readCanonicalBinding()` 用caller Supabase读取 `learning_agent_lessons`。当前表唯一SELECT policy要求`status=published`及published module权限；目标是Draft，所以调用者查询看不到该lesson，返回BLOCKED。独立READ ONLY已确认实际父链、version、8节点及hash完全正确。这是新B1预检实现的合同缺口，隔离authoring测试未覆盖真实Draft读取RLS；不是B2身份问题，不是数据库目标漂移。此前15/15不等于当前DB UI创建PASS。

阻塞代号：**OWNER_DRAFT_LESSON_PREFLIGHT_RLS_MISMATCH**。旧环境阻塞`OWNER_AUTHENTICATED_DEV_AUTHORING_UI_UNAVAILABLE`已RESOLVED。

### Minimal correction proposal — not applied

建议复用现有 `src/features/learning-agent-script-studio/service.ts` 中正式Owner authoring读模式：先`requirePlatformOwner`，只在server-only、固定父链范围内读取Draft lesson；创建操作仍使用原authenticated caller RPC。不得修改RLS、StudentPolicy、secret权限或DB业务内容，不使用admin客户端创建Activity，不生成用户session。需要为真实RLS下的Draft可见性和非Owner拒绝补回归测试。

这会改变已锁定B1源码，必须先修订批准范围与候选hash，再构建/部署；本次未自动改代码、未绕过disabled按钮、未调用写RPC。已安装migration可保留，无需删除ledger或退回旧Build来处理这个预检问题。

### B1 closure status and production boundary

B1：**BLOCKED，未COMPLETE**；B2：BLOCKED / NOT APPROVED；current-DB durable E2E：BLOCKED BY TEST IDENTITY。两者独立。

最终独立READ ONLY确认execution node0/Activity0/private answer0；所有既有业务表fingerprint与migration前一致；R6F 8节点、Script Version1 Draft、Objectives、canonical父链全部UNCHANGED。当前DB业务/Auth/Attempt/Progress/Frozen/ScriptVersion/Objectives写入均0。Publish/Agent/Provider/Pins0，Feature OFF、Allowlists EMPTY。schema migration1、canonical应用部署1、指定PM2 stop/start1；无其它环境变更。没有进入B2、R7D或Stage1G。

关键证据：`b1c-migration-install-receipt.json`、`b1c-candidate-build.json`、`b1c-canonical-deployment-receipt.json`、`b1c-owner-ui-validation.json`、`b1c-draft-read-blocker.json`、`b1c-execution-end-state.json`。

## R7C-B1D Owner Draft Preflight Contract Fix

当前子阶段代码/测试修改已获用户授权，部署尚未授权。**READY FOR DEPLOY APPROVAL**。唯一产品修改为 `src/features/digital-textbook/server/native-activity-authoring.server.ts`；表单、Server Action、CREATE RPC、migration、RLS、StudentPolicy及Auth实现均未修改。上文B1C的blocked历史与已部署Build状态保持。

预检内部先`requirePlatformOwner()`，再按ScriptStudio现有模式创建server-only authoring reader。只对已验证module下的Draft lesson执行受限SELECT；已有绑定核对private row时仅HEAD计数activity_id，不读答案正文/私有digest。其它祖先、script/nodes和公开Activity查询仍使用caller；返回DTO仅EMPTY/BLOCKED/EXISTING。privileged reader不返回给调用者、不调用RPC、不写业务表。`createCanonicalBinding()`函数从原有注释至结尾字节完全不变，继续通过authenticated Owner caller调用已安装RPC。

同时按本轮E/F/G验收补齐预检：从R6F独立核验后的行生成稳定JSON fingerprints，验证祖先/lesson/version/8nodes；预期hash不是浏览器输入。RPC自己的原有PostgreSQL freeze hash及事务authority完全不变。公开node/Activity形状及private row存在性完整才EXISTING；不把私有答案判定下放给display。错误target、hash变化、partial/read error均BLOCKED。

## B1D Real RLS Regression

**31/31 PASS**，包含原15项和新增16项（含父测试）。`OWNER_DRAFT_PREFLIGHT_UNDER_CURRENT_RLS`使用真实隔离PG role/RLS执行生产预检函数的SELECT：ordinary caller（即便Owner）看不到Draft；只有通过Owner校验后的server-only reader能读取并返回EMPTY。不是mock lesson visible。fixture从既有migration装载相同lesson policy和module权限函数；published-textbook叶谓词限定隔离draft/published数据，Auth/session guard为本地测试stub，未创建当前DB身份/会话。

已覆盖匿名/non-owner在privileged reader构造前拒绝；错误target；lesson/script/node hash mismatch；读取失败；真实隔离partial node、Activity缺secret；完整existing；秘密表普通caller拒绝；private presence-only读取与DTO；create仍用caller RPC；policy及migration不变。故障注入修改read-port返回，不UPDATE canonical prompt或Frozen内容。隔离测试无attempt/progress，当前DB写入0。

## B1D Build and Source Lock

最终候选 Build：`f3AMbrTZfbg0_VWwnSE6i`。候选archive SHA：`2e5f143ad34b0c664e866a89a4adaf545fdb4d7fe54b737990a2c6798c540c47`。候选源码SHA：`15b032f346a93327c6692546ad3f9c47c3ba8d5cb9e32e722d9d6a56d6d08d77`。基于当前Build锁定的1313文件源清单，仅替换1个产品文件，没有带入工作区其他改动。Next build/TypeScript PASS；产品文件scoped lint0 errors/0 warnings；git diff --check PASS；client JS无`p_private_answer`、`SUPABASE_SERVICE_ROLE_KEY`、preflight私有常量标记。

首次lint指出保留变量名module，已仅重命名为boundModule，并重新通过31项测试及最终构建。较早Build `6EOgU8Gbv4DjZSZZDYqK9`废弃，不作为本批准候选。源码差异见 `b1d-preflight-fix.patch`；精确hash见 `b1d-source-lock.json`。

## Approval B1D-Deploy Package

**READY / NOT YET APPROVED**。完整包见 `approval-b1d-deploy.json`。Changed Product Files仅上述server-only文件；test范围为原authoring test与fixture、新增preflight harness与真实RLS test。Migration NONE；schema/RLS/StudentPolicy writes0；current ledger458不变。

Current Build `YEYLRN3hvVg2OY0NJ9NO9` → Candidate `f3AMbrTZfbg0_VWwnSE6i`。只切换同一uply-first-enable的`.next`及1个server文件，预留previous `.next`和该文件的回滚副本；其它进程、launcher、runtime配置、Tailscale、依赖和公共资源不变。部署前重新hash；不创建第二实例。

Expected Business Writes Before UI Create0；批准部署并确认原Owner UI正确且按钮启用后，仅一次逻辑创建，预期execution node INSERT1/Activity INSERT1/secret INSERT1，UPDATE0/DELETE0。Frozen/ScriptVersion/Objectives/Auth/Attempt/Progress/Agent/Provider/Publish/Pins均0。UNKNOWN停止、独立readback、不重试。私有答案继续由既有RPC契约写server-only secret，Node7文本及第二题保持不变/DEFERRED。

## B1D Current End-State

本轮未部署、未点击创建。独立READ ONLY确认binding0/0/0，R6F8nodes/version1 Draft/4objectives/父链unchanged；业务fingerprints不变，已安装RPC hash不变，ledger458，线上仍Build `YEYLRN3hvVg2OY0NJ9NO9`、PM2 online。Feature OFF / Allowlists EMPTY，Agent/Provider0，Stage1G NOT READY。B2 NOT APPROVED，未进入R7D。新代码真实Owner页面创建验收等待部署批准，不虚报B1 COMPLETE。

## R7C-B1D Approved Deployment and Canonical Binding Closure

当前结论：**R7C-B1 COMPLETE / GO**；R7C-B整体为 **CONDITIONAL**，只剩独立的B2身份与current-DB durable E2E限制。此前NO-GO、禁用按钮及等待部署批准均为历史事实，保留不改写。`OWNER_DRAFT_LESSON_PREFLIGHT_RLS_MISMATCH`现已 **RESOLVED**。

### B1D-Deploy Authorization and Exact Deployment

用户明确批准B1D-Deploy及全部预检通过后的ONE logical UI create。部署前重验archive/source hash、线上旧Build、R6F完整冻结行、binding0/0/0、ledger458、RPC definition/ACL。核验PASS后仅对uply-first-enable执行一次stop/start，只切换`.next`和`src/features/digital-textbook/server/native-activity-authoring.server.ts`。Current Build现为`f3AMbrTZfbg0_VWwnSE6i`；其它PM2进程、runtime.json、launcher、Tailscale、public、package/dependencies及其它产品源码不变。本子阶段migration/schema writes0，ledger仍458，已安装RPC/RLS/StudentPolicy不变。

旧Build`YEYLRN3hvVg2OY0NJ9NO9`的`.next`保留在`/home/yangzhen/operations/uply/teaching-agent/r7cb-b1d/20260917T071351Z/rollback/previous-next`；原server文件在`/home/yangzhen/operations/uply/teaching-agent/r7cb-b1d/20260917T071351Z/rollback/native-activity-authoring.server.ts`。没有第二实例，无回滚执行。root/dashboard/韩语app/教材制作/ScriptStudio/native-activity六条正式路径HTTP200；原Chrome Owner会话有效。

### Owner UI Validation and One Create

原Owner会话下只读DOM确认：8443、韩文字母入门/第0章/课前导航、第1版草稿、8个冻结小节、preflightPASS、创建按钮ENABLED、无prior attempt记录及私有答案标记。随后只点击一次正式创建按钮；UI于`2026-09-17T07:15:05.616Z`确认。没有直接调用RPC、没有admin业务写、没有重新登录或复制认证数据、没有重试。

独立READ ONLY查询确认execution node1/Activity1/private answer1，三行同一PostgreSQL事务、创建时间`2026-09-17T07:15:05.080489+00:00`。Alias为`hangul-introduction-vowel-recognition`，type为`single_choice`，parent chain精确，duplicate0。公开题干保持已批准安装RPC中的“哪个是元音？”，选项为ㄱ/ㅏ/ㄴ；与冻结作者题意相同，没有为措辞修改RPC或Node7。private answer仅server端，authenticated/anon均无secret表SELECT权限；仅导出private-contract匹配boolean，不导出答案行、答案值或可枚举私有digest。第二题DEFERRED。

再次通过新GET页面确认EXISTING，创建按钮禁用是已完成绑定的正常保护状态，未再次点击。当前live client静态JS扫描327个文件，private-answer/admin-key/preflight-private标记命中0；前后Owner DOM无答案标记。证据不保存认证headers或个人信息。

### Independent Readback and Protected End-State

R6F8节点完整行、Script Version1 Draft完整行、4objectives及6项canonical父链均精确匹配冻结基线。新canonical内容仅批准的3INSERT，UPDATE0/DELETE0；现有无关业务metadata fingerprints不变，schema/function/ACL/RLS fingerprints不变。目标Attempt0/Node Progress0；从本操作开始，Auth/users/identities/sessions/profile/audit/tenant/membership、既有attempt/progress、publish logs的created/updated聚合变化均0。既有历史attempt并非整个数据库0；本次写入0、目标记录0。Agent五表0；Provider/Publish/Pins0，FeatureOFF、AllowlistsEMPTY。

验证脚本曾先修正只读CTE的xmin投影，再修正对“排除canonical target的无关fingerprints”的比较假设；两处仅影响只读验证工具，未产生DB写入或第二次UI请求。修正后独立核验全部PASS。保护证据为行hash、metadata、时间戳聚合及执行trace，未声称执行WAL审计。

### B1 Final Closure and B2 Boundary

**B1 COMPLETE。Canonical binding保留。B2 BLOCKED / NOT APPROVED。Current DB Durable E2E BLOCKED BY TEST IDENTITY。** 本次没有actor/Auth provisioning、Attempt/Progress提交、Runtime、Provider或Agent执行；没有进入R7D或Stage1G。互动视频仍是Teaching Agent Lesson Execution Runtime能力，本次完成的是其canonical Activity事实层。

关键证据：[部署回执](evidence/teaching-agent-stage-1f-r7c-b/b1d-deployment-receipt.json)、[Owner预检](evidence/teaching-agent-stage-1f-r7c-b/b1d-owner-ui-validation.json)、[创建回执](evidence/teaching-agent-stage-1f-r7c-b/b1d-canonical-create-receipt.json)、[独立绑定读回](evidence/teaching-agent-stage-1f-r7c-b/b1d-binding-after.json)、[冻结复核](evidence/teaching-agent-stage-1f-r7c-b/b1d-freeze-after-create.json)、[保护边界](evidence/teaching-agent-stage-1f-r7c-b/b1d-protected-boundaries.json)、[最终状态](evidence/teaching-agent-stage-1f-r7c-b/b1d-execution-end-state.json)。历史gates及end-state已另存before-b1d-deploy副本，当前gates按B1/B2独立标记。

## R7C-B2 Auth Environment Audit

本轮B2合同审核结论：**BLOCKED，未provision当前DB**。B1仍COMPLETE，canonical binding仍1/1/1。当前真实`/auth/v1/health`返回 **GoTrue v2.197.0**；管理API只读配置确认email启用，phone/OAuth/SAML/Web3/passkey/anonymous关闭，email自动确认关闭、OTP8位/3600秒、JWT3600秒、refresh rotation开启/reuse10秒、Auth DB audit关闭。配置证据仅保存布尔值/数值，不保存SMTP、签名密钥、认证header或项目凭据。本地config.toml及旧v2.195.0不是当前环境authority。

复用R5B的owned内部网络、Unix socket PG、隔离Auth测试模式，但未运行其“创建后登录Owner”的旧脚本。拉取同版本v2.197.0镜像，digest为`sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b`。仅恢复已封存备份的schema，零复制用户/业务数据；相关function使用当前DB只读定义，13个相关trigger定义逐项MATCH且enabled。最终隔离数据库UTF8，public app catalog5条仅作初始化参考。初轮SQL_ASCII setup被丢弃并清理后在UTF8重做，不以失败初始化充当验证。

## Stable Execution Actor Contract

`development-domain-execution/1`保持 **1 stable reusable non-human actor + 1 dedicated dev tenant + many scenario IDs**。使用现有auth.users FK，profile为member/student、inactive；membership为student/suspended/not-default；actor绝不是Owner或service-role身份。Admin create必须在同一事务设ban，不能先登录再ban。服务端随机密码不交付/不保存；当前Auth即使省略password也会生成随机密码，因此“无password参数”不是禁登录控制。ban是已验证的控制，metadata只表示用途。[同版本Auth Admin实现](https://raw.githubusercontent.com/supabase/auth/v2.197.0/internal/api/admin.go)。

## Login Disabled Verification

隔离同版本实测：password grant返回400/user_banned；有效magic-link hash及email OTP验证返回403/user_banned；符合旧token格式但不存在的refresh grant返回400/refresh_token_not_found；无Auth发行session的隔离签名bearer访问/user返回403/user_banned；PKCE无有效code返回404；SMS provider关闭。创建时及全部探测后sessions0、refresh_tokens0；未先登录actor。浏览器Origin的Auth API已测，独立Next登录UI未运行；不存在先发行的有效refresh grant，故未假称完成“先登录再ban”的旧session测试。

**关键合同差异：公开Magic Link签发HTTP200；email OTP签发在限流窗口后也HTTP200。有效验证均因ban拒绝，不能获得可用会话，但不能声称“不会签发链接/OTP”。** 初始OTP429只证明限流，补测200已记录。隔离Admin生成挑战仅用于验证，未导出链接/token，当前DB没有执行任何生成操作。参照当前[MagicLink实现](https://raw.githubusercontent.com/supabase/auth/v2.197.0/internal/api/magic_link.go)与[verify实现](https://raw.githubusercontent.com/supabase/auth/v2.197.0/internal/api/verify.go)，此结论来自实际HTTP/DB测试而非仅源码推测。

本次第10节“没有magic link”按严格零签发要求，不能把上述session-denial PASS扩大成整个LOGIN_DISABLED PASS，因此Approval B **BLOCKED**：`BANNED_SESSION_DENIAL_IS_NOT_ZERO_MAGIC_LINK_OR_OTP_ISSUANCE`。最小替代是明确接受正式**initial-ban + 无可用session**生命周期（允许不可用challenge被签发），再锁定provisioning包；若仍要求连challenge都不能签发，必须另行设计并验证受支持的Auth层per-subject签发拒绝合同。应用UI拦截不能封住直接Auth API，不能改普通StudentPolicy、禁用全局email或用metadata伪装安全控制。`876000h`是有限ban，issuer需校验覆盖scope TTL+24h并在到期/解除时fail closed，不宣称永久不可更改。

## Auth Side Effect Map

针对已验证的固定顺序（先Auth初始ban，再profile inactive，再suspended membership），预计净新增如下；UPDATE是实测事件数，不是新增行数：

| Table | INSERT | UPDATE | DELETE |
|---|---:|---:|---:|
| auth.users | 1 | 5 | 0 |
| auth.identities | 1 | 0 | 0 |
| auth.audit_log_entries | 0 | 0 | 0 |
| public.profiles | 1 | 3 | 0 |
| public.account_management_audit_logs | 0 | 0 | 0 |
| public.tenants | 1 | 0 | 0 |
| public.tenant_memberships | 1 | 0 | 0 |
| public.tenant_membership_audit_logs | 1 | 0 | 0 |
| public.learning_grading_comments | 4 | 0 | 0 |
| public.tenant_student_apps | 5 | 0 | 0 |

Auth create本身profile UPDATE2；停用再UPDATE1，共3。account audit0来自当前trigger的`WHEN default_tenant_of(new.id) IS NOT NULL`条件，未禁用审计；后续建立membership后的profile变更会额外审计，不在本包。Auth DB audit当前配置关闭，因此0；托管服务外部访问日志仍可能产生。membership INSERT触发独立membership audit1。tenant INSERT自动seed4条learning_grading_comments、5条tenant_student_apps，不能隐瞒为other0。角色grant、tenant_provisioned_accounts、attempt/progress/session/refresh均0。完整来源和探测见`b2-auth-side-effect-map.json`与`b2-isolated-side-effects.json`。

## Development Tenant Contract

拟建`uply-domain-execution-dev`，精确alias当前0，purpose-tagged actor当前0；未选择任何个人/旧demo账号。现有create_tenant RPC本身可创建单租户，但`src/app/dashboard/admin/tenants/actions.ts`的createTenantAction同时创建可密码登录的tenant_super_admin，因此不得用于本合同。未来需要极小Owner受保护provisioning workflow组合现有RPC/Auth Admin/repository；不能复制旧UI的管理员账户、清理fallback或退化写入。本轮未实现/部署新workflow。

## Execution Scope

scope绑定environment/database identity、稳定actor/tenant、target lesson/activity、freeze/version、scenarioId、expiration、writeBudget及state，默认DISABLED。未来独立server-only controlled integration composition才加载issuer，production Next/StudentPolicy/Agent不加载。不是凭NODE_ENV就有权限，更不签actor JWT或用Owner当学生。每次写前检验身份禁登录状态/TTL/budget/target lease；只调用既有grader与trusted atomic transaction seam。Actor是ID/FK，服务端DB transport的权限不等于actor身份权限。隔离FK链验证PASS，但issuer是设计，尚未实现/测试。

registry可采用私有磁盘durable scope journal记录准入/lease事实，不保存答案、completion、attempt或progress truth；进程重启仍从既有Attempt/Progress重建事实。新scenarioId不能覆盖此前COMPLETED。Provisioning预算Attempt0/Progress0；后续wrong1+correct1只是待另批scenario示例，不自动授权本轮或下轮提交。

## Cleanup / Reuse Policy

优先REUSE，scope结束保持actor ban/profile inactive/membership suspended。若要重新验证INCOMPLETE→COMPLETED，另批actor+tenant+target Activity/version及具体attempt IDs范围，先依赖审计，再按子项/aggregate顺序在正式事务中精确清理。不得CASCADE，不得删canonical Activity或冻结内容。当前schema相关入站FK已审计163条；Auth/tenant存在ON DELETE CASCADE，故不能把Admin deleteUser或tenant删除视为无副作用清理。默认retire保留disabled主体，永久删除必须另批完整影响。

## Approval B Provisioning Package

**BLOCKED / NOT APPROVED**，见`approval-b2-provisioning.json`。未来目标仍Actor1/Tenant1；Auth API精确为单次Admin POST /admin/users，初始ban与创建原子提交。租户RPC、profile停用、membership建立分别有receipt/new readback；任一UNKNOWN停住不重试，不自动删除已确认对象。全部预期写入与副作用已按固定隔离探测列出，但不以它替代Owner provisioning完整workflow验证，也不把“ban可阻止session”改写为“不能签发challenge”。

当前DB Identity/Tenant/Profile/Membership/Attempt/Progress写入均0；B1冻结8nodes/version1 Draft/4objectives、Activity1/1/1保持。Agent/Provider/Publish/Pins0，FeatureOFF、AllowlistsEMPTY；current-DB durable E2E仍BLOCKED UNTIL B2 PROVISIONED，R7D和Stage1G NOT READY。本轮结束等待对合同差异与后续Approval B的明确决定，不创建身份。

B2结束独立只读复核：ledger458、Build f3AMbrTZfbg0_VWwnSE6i、B1绑定1/1/1、冻结8nodes/version1 Draft/4objectives未变；当前DB身份及Attempt/Progress写入0。owned隔离Auth/Mailpit/PG容器、内部网络和volume均已精确清理，临时签名凭据删除；未清理当前DB任何对象。详见`b2-production-end-state.json`、`b2-isolated-cleanup.json`、`b2-workspace-scope.json`。

## B2 Revised Initial-Ban Session-Denial Contract

用户已接受新的安全目标：**NO USABLE AUTH SESSION CAN BE OBTAINED**。此前因要求零 challenge 签发而 BLOCKED 的结论保留为历史；本轮按正式修订的 **INITIAL-BAN SESSION-DENIAL** 合同验收，结果为 **READY FOR B2 PROVISION APPROVAL**。这是 provisioning workflow 的实现与隔离验收，不是当前数据库身份已创建。B1仍COMPLETE，当前canonical Activity为1/1/1。

Challenge issuance **MAY OCCUR**；Magic Link Session Acquisition及OTP Session Acquisition均为 **DENIED WHILE BANNED**。不再使用“Magic Link Disabled”或“OTP Disabled”描述该合同。初始ban与Auth创建同一事务提交，没有先登录再ban，也没有为actor签Student JWT。`876000h`有限；必须满足`ban_until > scope_expiration + 24h`。将来的每次ACTIVATE均须重读ban、零session/refresh、inactive profile及suspended/non-default membership；任何失效均禁止attempt/progress。当前未实现或激活attempt scope。

## B2 Minimal Provisioning Workflow Implementation

仅新增7个server文件，均在`src/features/development-execution/server/`：

- `provisioning-contract.ts`：固定purpose/alias、环境与DB绑定、严格snapshot、有限授权期限及ban horizon检查。
- `provisioning.actions.ts`：无浏览器输入参数，先调用既有`requirePlatformOwner`；无普通租户UI入口。
- `provisioning-composition.server.ts`：默认不安装；只允许显式development installation，校验DB identity及Owner/Admin API origin SHA。生产路由不导入action，不加载scope issuer。
- `provisioning.service.ts`：固定4步写序列，逐步新连接readback，任何UNKNOWN立即停止。
- `supabase-provisioning-adapter.server.ts`：Owner authenticated `create_tenant` RPC、Auth Admin初始ban创建、profile inactive PATCH、student/suspended/non-default membership INSERT。
- `provisioning-readback.server.ts`：新READ ONLY事务核验冻结父链/8nodes/version及既有Activity；只读取受限actor状态和计数，不读取密码、challenge、token、私有答案。
- `provisioning-journal.server.ts`：私有0700目录中的独占、fsync操作记录；分派前落盘，已claim永不自动释放。它只保存provisioning阶段，不是第二套identity/progress或scenario事实库。

Server生成CSPRNG密码，仅在单次Auth Admin调用的内存参数中使用，不返回、不打印、不保存。Tenant先创建；Auth创建独立提交后立即核验ban/session0/refresh0；profile在membership前停用，避免扩大当前account audit副作用。每步都以独立readback为准，submit返回值不承担authority。部分状态不自动补齐；错误/未知提交只分类EMPTY/PARTIAL/COMPLETE/INVALID/UNKNOWN，不重试、不自动删除。新进程看到完整安全主体只返回EXISTING，不再发送API mutation。

没有改Auth trigger、RLS、StudentPolicy、普通登录/租户UI、B1、migration或dependency。没有增加数据库driver；读取接口结构兼容已有trusted SQL transport，由获批development composition显式安装并独立锁定连接identity。DB身份标签不是外部不可信transport的认证凭据。任何未来当前DB执行，仍须先锁定真实连接、Auth API origin、Owner上下文和配置；不能从浏览器提供这些值。

## B2 Workflow Isolated Verification

**39/39** unit/boundary测试通过：Owner gate、anonymous/non-owner拒绝、错误环境/DB/API endpoint/过期拒绝、重复/partial停止、ban horizon不足、session/refresh非零、Owner/admin身份拒绝、membership不安全拒绝、各阶段commit/no-commit UNKNOWN、readback失败、无盲重试、跨进程journal fence及并发claim。还对当前安装的Supabase SDK实际执行502 transport fault测试，4类mutation均只dispatch一次。

真实隔离服务使用GoTrue **v2.197.0**、PostgREST **v16.1**、PG **17.6**及当前完整schema/相关13个trigger，定义与enabled状态逐项MATCH。新action/service/SDK adapter实际发送且仅发送：`POST create_tenant`、`POST Auth Admin users`、`PATCH profiles`、`POST tenant_memberships`。Owner RPC使用隔离operator fixture，应用Owner guard以允许/拒绝测试验证；没有使用任何真实Owner/学生作为actor。

隔离库只复制schema和5条公开app参考行，另有1个隔离operator control；它们明确排除在Actor1/Tenant1预算之外。没有复制真实用户或冻结内容行。因此仅在隔离Auth workflow中替换`canonicalValid`为受控fixture attestation；实际SQL在该空内容库正确返回false。在当前DB另用新READ ONLY连接执行同一SQL，确认真实freeze/canonicalValid为true、actor0/tenant0。该分离验证不冒充当前DB provisioning E2E。

写入探针的事务分组确认Auth INSERT1/UPDATE5、identity INSERT1、profile INSERT1/UPDATE2在同一个创建事务中，提交后的主体已ban。随后单独profile inactive UPDATE1及membership INSERT1。各表事件预算完全MATCH，见下表。隔离服务新进程只读恢复EXISTING，API mutation0。没有进入Runtime attempt/progress。

有效magic-link hash验证403/user_banned，有效email OTP验证403/user_banned，password400/user_banned；refresh不存在有效grant，返回400/refresh_token_not_found。session0、refresh0。公开magic-link签发200可接受；本轮紧接的OTP issuance429只记限流，OTP安全结论来自有效OTP验证被拒绝，历史窗口后签发200仍保留。没有用随机/无效challenge冒充有效OTP安全测试。未发行actor JWT，未执行登录后ban。浏览器Origin Auth API已测，独立Next登录UI未启动。

## B2 Exact Side-Effect Budget

| Table | INSERT | UPDATE | DELETE |
|---|---:|---:|---:|
| auth.users | 1 | 5 | 0 |
| auth.identities | 1 | 0 | 0 |
| public.profiles | 1 | 3 | 0 |
| public.tenants | 1 | 0 | 0 |
| public.tenant_memberships | 1 | 0 | 0 |
| public.tenant_membership_audit_logs | 1 | 0 | 0 |
| public.learning_grading_comments | 4 | 0 | 0 |
| public.tenant_student_apps | 5 | 0 | 0 |
| auth.audit_log_entries | 0 | 0 | 0 |
| public.account_management_audit_logs | 0 | 0 | 0 |
| sessions / refresh_tokens / permission grants / provisioned accounts | 0 | 0 | 0 |
| attempts / node progress / activity-page progress | 0 | 0 | 0 |

共15个新增行、8个UPDATE事件。Auth DB audit0仅针对当前hosted配置，外部访问日志仍可能存在；account audit0依赖既定profile-before-membership顺序及当前trigger条件，没有关闭audit。隔离challenge测试自身可能产生额外Auth token-field变化，它们单独记录，不属于未来当前DBprovision预算；当前DB不执行challenge issuance。若配置/trigger改变或预期预算不能维持，STOP并重新生成批准包。

## B2 Build and Production Exclusion

TypeScript PASS，7个新文件scoped lint 0 errors/0 warnings，diff检查PASS。使用已封存B1D源码加7文件在独立目录构建；初次build发现对未部署R7C文件的纯类型依赖，收窄为等价只读transport结构后重建PASS。没有扩大产品范围或复制Runtime。候选测试Build为`cWgvIjdoChxT4NjdbwIJW`，**未部署**；当前8443仍为`f3AMbrTZfbg0_VWwnSE6i`。构建后的route/action manifest未暴露development provisioning endpoint，production issuer不加载。

## Approval B — Revised Provisioning Package

**READY — AWAITING USER APPROVAL**。完整逐表范围见[Approval B](evidence/teaching-agent-stage-1f-r7c-b/approval-b2-provisioning.json)。计划1 stable reusable actor +1 dedicated development tenant；Security INITIAL-BAN/NO USABLE SESSION，Challenge MAY OCCUR，Password/Magic Link/OTP session及refresh grant拒绝，provision后session0/refresh0。旧BLOCKED包已保存为`.before-initial-ban-workflow.json`，不改写历史事实。

用户下一次批准前，当前DB身份/tenant/profile/membership写入均0。未来仅可在获批、有效Owner上下文的受控development composition执行上述精确流程；需重新核对Auth config/trigger、environment/DB/API绑定、R6F和alias不存在、私有journal及不超过30分钟的授权期限。该包不允许部署生产路由、创建第二UPLY实例、激活attempt scope、运行durable E2E或进入R7D。入口/上下文若不满足，必须在写入前停止，不可转移Owner Cookie/JWT或伪造会话。

B1保持COMPLETE，Frozen Nodes/Script Version/Objectives/Canonical Activity全部UNCHANGED。Current DB Durable E2E仍 **BLOCKED UNTIL APPROVAL B + PROVISION**；之后attempt/progress场景仍须精确批准。Agent/Provider/Publish/Pins0，FeatureOFF，AllowlistsEMPTY，R7D/Stage1G NOT READY。

## Approval B Granted — Post-Reboot Fresh Preflight

用户已明确批准 **Approval B — Development Execution Identity Provisioning**，精确预算15 INSERT、8 UPDATE、0 DELETE。该授权现记录为 **GRANTED**，不再标记等待用户批准。此轮执行结果为 **BLOCKED BEFORE MUTATION**，没有派发任何provisioning操作，没有创建journal claim，没有重试或补偿删除。旧READY批准包已归档为`approval-b2-provisioning.before-explicit-approval.json`。

2026-09-17T08:45:41Z开始的fresh preflight锁定最长30分钟窗口，结论如下：

| Check | Result |
|---|---|
| Canonical Build / PM2 | f3AMbrTZfbg0_VWwnSE6i / online |
| PostgreSQL / Ledger / Latest | 17.6 / 458 / 202609170001 |
| 7个workflow源码hash | MATCH |
| Environment / DB identity / Auth API origin | MATCH，连接TLS verify-full |
| R6F冻结父链、8nodes、version1 Draft、objectives | MATCH |
| B1 canonical binding | 1 / 1 / 1，UNCHANGED |
| Auth version/config/providers | v2.197.0，MATCH |
| 当前13个trigger定义及function hash/enabled | MATCH |
| development actor / tenant | 0 / 0 |
| 既有私有operations/config目录中的provision journal claim | 0；本轮未创建 |
| Feature / Allowlists | OFF / EMPTY |
| Existing Chrome CDP | AVAILABLE；未读取Cookie/JWT，未执行登录 |
| 正式Owner provisioning guard | NOT INVOKED，缺少受控调用入口 |

## B2 Execution Entry Blocker

**OWNER_AUTHENTICATED_DEVELOPMENT_PROVISIONING_ENTRYPOINT_UNAVAILABLE**。

当前canonical Build的route/action manifest没有B2 provisioning action。新workflow代码仅在workspace及隔离测试中实现，`installDevelopmentProvisioning`默认未安装；没有当前环境的受控Owner invocation/composition。既有`requirePlatformOwner`依赖Next请求与正常登录session，不能在CLI里用mock、选取某个Owner行或service-role替代。隔离测试中的operator fixture也不能用于当前DB。

上一轮READY结论证明了服务合同与隔离Auth/API副作用，但没有将“当前环境尚无正式Owner调用入口”列成阻断；这是上一轮执行准备判断的遗漏，并非本轮数据库漂移，也不是用户未批准写入。Approval B已有效授予，此处不请求重复批准同一预算。

用户本轮禁止部署production provisioning route、第二个UPLY实例及改动普通登录/租户UI，因此不能用新服务、转移Cookie/JWT、直接service-role RPC或CLI模拟guard来完成创建。最小后续修复是单独审阅一个**仅canonical development启用、复用原Owner会话和正式guard、production composition不加载**的调用/安装合同；若需要当前build变更，须单独批准该部署范围。此轮不实施、不部署该入口，也不启动新的UPLY实例。

当前DB Actor0/Tenant0，B2 **NOT PROVISIONED**。所有批准预算表的本轮mutation dispatch均0；Attempt/Progress/Agent/Provider/Publish/Pins0，execution scope DISABLED，FeatureOFF、AllowlistsEMPTY。B1仍COMPLETE，冻结内容和canonical Activity未变。Current DB Durable E2E仍BLOCKED，不能签署READY FOR SEPARATE SCENARIO APPROVAL。未进入B3、R7D或Stage1G。

证据：[fresh preflight](evidence/teaching-agent-stage-1f-r7c-b/b2-approved-fresh-preflight.json)、[授权及零写执行状态](evidence/teaching-agent-stage-1f-r7c-b/b2-approved-execution-status.json)。当前状态由READ ONLY快照与未派发mutation的执行轨迹支持，不声称完成当前DB Auth创建或WAL事件审计。

## R7C-B2A — Development Provisioning Entrypoint Enablement

当前结论：**READY FOR B2A DEPLOY APPROVAL**。缺少Owner调用入口的问题已在候选代码中解决，尚未部署；线上仍为`f3AMbrTZfbg0_VWwnSE6i`。Approval B身份预算继续有效，不重复申请Actor1/Tenant1及15 INSERT/8 UPDATE/0 DELETE。B1 COMPLETE不变，B2仍未创建当前DB身份。

新增内部页面`/platform/dashboard/admin/development-execution`，仅显示固定合同、canonical development环境、稳定actor1、专用tenant1、INITIAL-BAN/NO USABLE SESSION、15/8/0预算、attempt/progress0、scope DISABLED及“创建开发执行身份”按钮。无身份、角色、密码、email、环境、URL或预算编辑控件；没有添加任何普通学生、租户或public导航链接。页面复用既有Button，按钮具备pending/disabled状态和可访问的status反馈。

### B2A File Scope and Existing Service Reuse

本轮修改2个文件：

- `src/features/development-execution/server/provisioning-composition.server.ts`：提取显式request-scoped composition工厂，保留原有安装合同，不依赖进程全局enable或自动续期。
- `src/features/development-execution/server/provisioning.actions.ts`：第一步仍是`requirePlatformOwner()`；任何浏览器参数均拒绝，随后调用固定入口服务一次。

本轮新增4个文件：

- `src/features/development-execution/server/provisioning-entrypoint.server.ts`
- `src/features/development-execution/server/provisioning-transport.server.ts`
- `src/features/development-execution/components/provisioning-form.tsx`
- `src/app/[space]/dashboard/admin/development-execution/page.tsx`

既有`provisioning-contract`、`provisioning.service`、`provisioning-journal`、`provisioning-readback`、`supabase-provisioning-adapter`五个核心文件hash完全不变。没有复制四步provisioning逻辑，没有改Auth/RLS/StudentPolicy、普通tenant/login UI、B1或数据库schema。部署需包含当前线上尚未部署的B2服务文件，因此**部署精确列表为11个文件**，与“本轮修改2/新增4”分别记录在批准包。

### B2A Owner and Development Boundary

页面和Server Action先验证正常Platform Owner。页面仅接受`space=platform`；action无业务输入，拒绝额外target/IDs/config参数。后续server-only loader从固定私有路径读取严格schema的Approval B activation记录，校验：固定environment、项目/DB identity、Auth API origin SHA、预算SHA、runtime.json SHA、现有libpq service SHA、canonical真实working directory以及当前Build ID。时间窗必须`issuedAt <= now < expiresAt`且总长不超过30分钟，没有滑动续期。

之后通过实际READ ONLY transport核验R6F及B1、actor/tenant状态、ban/session/refresh/profile/membership、journal存在性。EMPTY且journal clear才READY；partial/unsafe或claim存在阻止派发；安全COMPLETE只返回EXISTING。service仍独占创建journal，负责四步写入及独立readback。重复POST即使发生并发，只能有一个claim产生写序列。UNKNOWN停止且不重试，浏览器本地也在第一次点击前保存提交标记，防止刷新重提。

当前架构使用运行时fail-closed门禁：route和action会被编译，但没有私有dev配置、不是固定canonical目录/build/DB或授权过期时，GET显示BLOCKED、POST拒绝，不执行任何business write。普通production navigation不链接此页；production composition不安装issuer。本阶段不实现attempt scope issuer。

### B2A Concrete Read Transport and Private Activation

入口复用已存在的私有libpq service与Docker/psql只读模式，没有新增PostgreSQL driver。服务只执行固定READ ONLY SQL；Docker参数固定、`--pull=never`、service目录只读挂载、TLS verify-full、`default_transaction_read_only=on`、超时及输出大小受限。没有CLI模拟Owner；该transport只读取状态，Tenant写仍来自Owner authenticated RPC，Auth写仍来自原server-only Admin adapter。

已在当前DB运行**真实新transport + 原readback SQL**：canonicalValid true，R6F完整冻结hash MATCH，B1为1/1/1，actor0、tenant0，DB写入0。此次调用不触发Owner/action/provisioning。

部署批准包必须同时包含以下私有配置，避免再次出现只部署函数却没有安装合同的缺口：

- `/home/yangzhen/.config/uply-first-enable-20260910/development-execution/`，0700。
- 其中`approval-b.json`，0600；固定schema与candidate Build，时间戳仅在获批部署激活时填写，最长30分钟。
- 其中`journal/`，0700，预检必须无旧claim；部署阶段不创建claim。

本轮仅生成repo内的模板，以上current环境目录/文件均未创建。不会修改runtime.json、launcher、Tailscale、普通Auth配置或Teaching Agent Feature开关。私有provisioning activation不代表Agent启用；Feature继续OFF、AllowlistsEMPTY。

### B2A Verification and Build

原B2 **39/39** 回归、新增入口 **35/35**，共 **74/74 PASS**；TypeScript PASS，所有相关文件scoped lint 0 errors/0 warnings，diff检查PASS。新增覆盖Owner/non-owner/anonymous、错误environment/DB/Auth origin/build/runtime、授权过期/超长/未来签发、额外浏览器参数、partial、existing COMPLETE、journal、并发重复、UNKNOWN无重试、scope DISABLED与无秘密DTO。

现有Chrome中新建静态隔离React组件harness，**7/7 PASS**：READY按钮、重复点击一次dispatch、UNKNOWN保持禁用、刷新保留提交标记、BLOCKED/EXISTING禁用、连接丢失不重试、无输入与秘密输出。只替换测试action，没有启动第二UPLY实例，没有调用当前DB mutation。真实Owner会话访问新route/点击验证仍留到获批部署之后，不把组件测试冒充线上provisioning。

候选源码从封存的B1C candidate-source加已锁定B1D server文件恢复，再加入精确11个B2文件；线上source目录并不等同于其已部署artifact的完整编译源码，因此没有直接拿旧目录重建或夹带其他workspace修改。所有基线hash及B1 server hash匹配。最终Next构建PASS：

- Current Build：`f3AMbrTZfbg0_VWwnSE6i`
- Candidate Build：`vZokoJqpKDRZxnpQcQpah`
- Archive：`/tmp/uply-r7cb-b2a-candidate/candidate-build.tar.gz`
- Archive SHA256：`8e024240a714efe88a60d5a5e83a06d128cbfca7baf96c5f4da6d958a815da4c`

route/action manifest确认新入口存在。client静态包无本入口server key、私有DB路径、ban配置等泄漏。扫描曾命中Supabase通用SDK的`/admin/users`字面量；当前旧build也包含该SDK方法字符串，它不包含Admin token，已与真正秘密标记分开判断。没有对编译时生成的action ID、JWT或任何凭据做公开导出。

### Approval B2A-Deploy

**READY — AWAITING USER APPROVAL**，见[精确部署批准包](evidence/teaching-agent-stage-1f-r7c-b/approval-b2a-deploy.json)。目标只为`uply-first-enable`。Migration NONE、DB Schema0、RLS/StudentPolicy/installed RPC不变、ledger458；provision之前DB业务写0。

批准范围须覆盖candidate `.next`、精确11个文件、上述私有activation文件和空journal目录、同一PM2 process stop/start。包内已指定独立operations/rollback路径：保留previous `.next`、既有文件与配置及存在性manifest；回滚时只恢复这些精确对象，原本不存在的新增文件按manifest移除，不删除journal claim或任何已确认的DB身份/租户。无第二实例，无public/package/dependency/launcher/Tailscale改动。

部署后先用原8443 Owner会话做只读页面预检，全部PASS且按钮ENABLED，才可以使用已批准的Approval B执行ONE logical provisioning attempt。UNKNOWN立即停止并新连接readback；成功后scope仍DISABLED。任何attempt/progress/B3场景仍需另批。本轮没有部署，没有provision，Current DB Identity/Tenant/Profile/Membership/Attempt/Progress写入0；Agent/Provider/Publish/Pins0，FeatureOFF、AllowlistsEMPTY，R7D/Stage1G NOT READY。


## R7C-B2A Approved Canonical Deployment — Executed

本次最新结论：**GO；B2A Deploy PASS；B2 Provisioning COMPLETE**。此前入口缺失、等待部署批准和未创建身份的记录保留为历史事实。主线仍为UPLY Teaching Agent，本轮只建立其Lesson Runtime开发测试主体；没有开始durable E2E。

用户明确授予Approval B2A-Deploy，并确认Approval B的Actor1/Tenant1及15 INSERT / 8 UPDATE / 0 DELETE继续有效。重新核验archive SHA256 `8e024240a714efe88a60d5a5e83a06d128cbfca7baf96c5f4da6d958a815da4c`、候选Build `vZokoJqpKDRZxnpQcQpah` 与11个source hash全部一致。Fresh preflight确认PG17.6、ledger458/latest202609170001、Auth2.197.0配置/providers/触发器parity、R6F冻结及B1绑定1/1/1、actor0/tenant0、journal clear。第一次部署脚本因只读预检超过内部10分钟有效期在任何mutation前停止；刷新只读预检后继续，没有provisioning重试。

仅stop/start `uply-first-enable`，切换批准的`.next`及11个产品文件；其它source、runtime.json、launcher、Tailscale、public和package/dependencies完全未变。没有migration/schema/RLS/StudentPolicy/Auth trigger修改，没有第二个UPLY实例。线上Build现为 `vZokoJqpKDRZxnpQcQpah`，PM2 online。

精确rollback保留在 `/home/yangzhen/operations/uply/teaching-agent/r7cb-b2a/20260917T100034Z/rollback`，包括previous-next、source及presence.json。原private activation目录不存在，这一absence已记录。应用rollback不允许删除tenant/actor/profile/membership或journal claim。

私有目录0700、approval-b.json0600、journal目录0700已建立。授权窗口 `2026-09-17T10:31:41.491316+00:00` 至 `2026-09-17T11:01:41.491316+00:00`，总长30分钟；没有续期。部署时journal为空，claim只由后续原service创建。此配置是provisioning授权，execution scope仍DISABLED，过期GET/POST fail closed。

## B2 Owner Entrypoint and One Logical Provisioning Attempt

使用现有Chrome内正常Owner session访问canonical :8443 `/platform/dashboard/admin/development-execution`，HTTP200，Owner guard通过，预检PASS，预算15/8/0、scope DISABLED显示正确，按钮ENABLED。未重新登录、读取或复制Cookie/JWT、使用magic link、模拟Owner或手工调用Auth Admin/RPC。

点击前新的READ ONLY连接再次验证EMPTY状态、R6F/B1不变、Approval有效、journal clear。只执行**一次UI点击/一次logical provisioning attempt**。界面返回身份状态已确认，独立数据库读回分类 **COMPLETE**。journal记录单一CLAIMED，随后TENANT/ACTOR/PROFILE/MEMBERSHIP各DISPATCHED一次，最终CREATED/COMPLETE/scope DISABLED。没有UNKNOWN、重试、删除或补偿写入。

## B2 Current-DB Provisioning Receipt and Safety

专用development tenant1、稳定non-human actor1已创建。Actor最初创建调用带ban；ban horizon大于授权结束后24小时，non-human与production_allowed=false，非Owner/tenant admin/production provisioned account。profile为student/member/inactive；membership为student/suspended/non-default，parent tenant exact。

新READ ONLY连接确认actor sessions0、refresh_tokens0、email identity1。没有在当前DB执行password/magic-link/OTP登录探测；这些负向路径来自已锁定隔离验证，加上本次当前DB initial-ban/horizon及无session/refresh证据。正式表述保持：**Challenge issuance MAY OCCUR；session acquisition DENIED WHILE BANNED**。

| Table | INSERT | UPDATE | DELETE |
|---|---:|---:|---:|
| auth.users | 1 | 5 | 0 |
| auth.identities | 1 | 0 | 0 |
| public.profiles | 1 | 3 | 0 |
| public.tenants | 1 | 0 | 0 |
| public.tenant_memberships | 1 | 0 | 0 |
| public.tenant_membership_audit_logs | 1 | 0 | 0 |
| public.learning_grading_comments | 4 | 0 | 0 |
| public.tenant_student_apps | 5 | 0 | 0 |
| Total | **15** | **8** | **0** |

预算MATCH。证据为操作前后独立net row counts、全部public/auth表的pg_stat_all_tables事件增量与单次durable journal轨迹；不是WAL/per-request审计。操作窗口内只有上述8张表事件计数发生变化。auth.audit_log_entries、account_management_audit_logs、tenant_provisioned_accounts、sessions、refresh_tokens、attempt与两类progress表增量均0。public.user_permission_grants在当前schema不存在，因此无该表写入。

访问Owner页面期间、provisioning之前，全库auth.refresh_tokens净增1；该变化单独记录，不能冒充测试actor grant或计入其provisioning预算。此时actor仍不存在。没有读取任何token值；provisioning窗口中refresh增量0，创建后actor自身refresh0/session0。

## B2 Final Closure and B3 Boundary

B1 COMPLETE；canonical execution node/Activity/secret仍1/1/1，冻结8 nodes、version1 DRAFT、4 objectives及父链hash不变。RPC hash `460027e2168e9a7713d1f837ad91a70e561a82d5cfbfa3814d00dba97f3599c8` 不变，ledger458；Auth config/providers/触发器再次核验一致。Agent五表0、Provider0、Publish0、Pins0、Feature OFF、Allowlists EMPTY。Attempt0、Progress0、Execution Scope DISABLED。

**B2 COMPLETE。Current DB Durable E2E READY FOR B3 APPROVAL。** 这仅表示开发执行身份基础已建立，不代表durable Runtime E2E已通过。下一步必须另行批准R7C-B3精确scenario/write预算；本轮未准备或执行任何wrong/correct attempt、progress、cue/restart/runtime测试。R7D和Stage1G仍NOT READY。

证据：

- [Fresh preflight](evidence/teaching-agent-stage-1f-r7c-b/b2a-deploy-fresh-preflight.json)
- [Deployment receipt](evidence/teaching-agent-stage-1f-r7c-b/b2a-deployment-receipt.json)
- [Owner UI preflight](evidence/teaching-agent-stage-1f-r7c-b/b2a-owner-ui-preflight.json)
- [Immediate independent preflight](evidence/teaching-agent-stage-1f-r7c-b/b2a-immediate-pre-provision.json)
- [UI single attempt result](evidence/teaching-agent-stage-1f-r7c-b/b2a-ui-provision-result.json)
- [Independent readback](evidence/teaching-agent-stage-1f-r7c-b/b2a-provision-independent-readback.json)
- [Budget receipt](evidence/teaching-agent-stage-1f-r7c-b/b2a-budget-receipt.json)
- [Execution end-state](evidence/teaching-agent-stage-1f-r7c-b/b2a-execution-end-state.json)
- [Gate matrix](evidence/teaching-agent-stage-1f-r7c-b/b2a-execution-gates.json)


## R7C-B3A — Current DB Durable Scenario Contract and Approval Package

**本轮完成场景合同、预算和隔离验证；未执行current-DB attempt/progress。** B1/B2 COMPLETE保持，主线仍为Teaching Agent。B3场景批准包可供审核，但当前执行就绪仍取决于独立implementation/deploy前置门禁；本节不宣称current-DB E2E已验证。

### Formal Path and Current Baseline

重新读取existing grader、native Activity binding、durable repository/completion、7/8参数RPC、progress triggers、history/progress projection、NativeMediaController、StepController、LessonRuntime及既有测试harness。READ ONLY当前DB确认目标single_choice Activity1、secret1、execution node1；max_attempts3、counts_toward_completion=true，B2 actor作用域attempt0/node progress0/page progress0，session0/refresh0。R6F完整冻结父链/version/nodes哈希MATCH。Actor仍banned，profile inactive，membership suspended/non-default。

选用R7C既有trusted repository → exact seven-parameter record_smart_textbook_attempt；不得裸调用RPC。Repository先取得与RPC相同advisory lock，再查request envelope并检查定义锁定，最后同一事务调用既有RPC。传统submitActivityInDomain带PGRST202 fallback，不用于新canonical B3；只复用其现有grader。7参数RPC存在且service_role-only，此角色是server DB连接能力，绝不是actor身份或Student JWT。

### Exact Scenario and Write Budget

A基线只读 → B受控scope → C一次错误提交 → D独立INCOMPLETE readback → E一次正确提交 → F独立COMPLETED readback → G仅受控子进程重启/readback → H关闭scope。

| 表 | Wrong INSERT/UPDATE/DELETE | Correct INSERT/UPDATE/DELETE |
|---|---|---|
| digital_textbook_attempts | 1 / 0 / 0 | 1 / 0 / 0 |
| digital_textbook_node_progress | 1 / 0 / 0 | 0 / 1 / 0 |
| digital_textbook_activity_page_progress | 0 / 0 / 0 | 0 / 0 / 0 |
| course_ebook_progress / other aggregates | 0 / 0 / 0 | 0 / 0 / 0 |
| audit / Auth / tenant / profile / membership / content | 0 / 0 / 0 | 0 / 0 / 0 |

总预算 **3 INSERT / 1 UPDATE / 0 DELETE**。最终attempt2，attempt_number1/2；node progress1行completed/100%、mastery_score100、attempt_count2；page progress0，其他aggregate新增0。

当前有两个node-progress触发器：set_updated_at只设置同一NEW行，不额外产生SQL UPDATE；sync_smart_textbook_chapter_completion可能触及course_ebook_progress。目标chapter_test_id=NULL、章节execution node1，所以该trigger在没有published chapter_test join时直接返回，聚合写入0。这些条件必须随schema/RPC/trigger hashes每次fresh preflight重新确认，变化即STOP，不能沿用预算。

新隔离测试加载**当前DB实际7参数RPC函数定义和两个真实node triggers**，以max_attempts3的INSERT seed建立隔离内容；未UPDATE canonical或测试Activity来做负向验证。测试专用audit trigger计量wrong两INSERT、correct一INSERT一UPDATE，合计4个被观测row event；audit instrumentation只存在network-none隔离容器，绝不安装current DB。实际max3允许两次；禁止提高次数或清理绕过。

### Scope Design and Safety Gates

scope为DESIGNED，测试目录中的executable reference通过30项门禁检查；不是已经安装的production/current-DB安全执行器。建议固定scenario r7cb-b3-wrong-correct-recovery-1、TTL最多15分钟，绑定existing actor/tenant、environment/DB、lesson/Activity/version、R6F/B1、snapshot、write budget。只存准入metadata和两次dispatch reservation；任何completion/progress事实仍从repository读取。

Owner授权和固定private development composition才能activate；不可仅靠NODE_ENV。每次mutation在server gateway与同一trusted DB transaction内重新检查scope时间、generation、actor ban horizon>expiry+24h、actor sessions0/refresh0、inactive profile、suspended/non-default student membership、expected durable baseline和budget。scope过期、身份不安全、binding变化或UNKNOWN立即fail closed，保留claim并停止新提交。Production composition不加载issuer，不绕过StudentPolicy，也不授予actor登录能力。

Actor session/refresh始终按actor读取；全库Owner正常会话变化不能当作actor副作用。默认保留attempt/progress，未来清理必须独立精确批准，禁止CASCADE或删除B1/B2/frozen对象。

### Idempotency, UNKNOWN and Restart

同request、同payload忽略generation的repository重放不再调RPC；冲突payload拒绝；新stale-generation提交在gateway拒绝，旧callback由Runtime lease忽略。单scenario只允许两次新logical submission。并发重复验证在隔离环境完成；不额外授权current-DB并发写探测。

current-DB候选故障是在第二次正确提交COMMIT后抑制响应，只做新连接readback，不重提；正确事实已落库才允许恢复。读失败故障只覆盖read port，UNKNOWN保持暂停。no-commit故障已隔离验证，current-DB该变体DEFERRED，避免扩大两次提交预算；不修改prompt/secret。

重启对象是记录PID的受控B3 execution child/composition，不是UPLY PM2、服务器或数据库。用相同actor/tenant/scenario/snapshot重建，mutation admission关闭，只readback，不能重放答案。新增隔离测试真实结束/启动服务子进程后仍COMPLETED，attempt仍2。视频position只是observation，layout不是progress authority。

### Runtime / Private Boundary Validation

现有LessonRuntime、multiple_choice renderer、single media owner及Activity submission/readback端口继续复用。隔离验证wrong holds、correct authoritative readback resumes；user pause尊重，seek/dedupe/refresh/stale/autoplay/media error回归PASS。未使用第二套Runtime/Activity/Progress/Video Question系统。

Private answer只由server grader从secret读取。新增scenario测试不硬编码答案，server-private helper从已有secret选择输入；scope/journal/approval DTO不保存答案。Manifest、DOM、HTTP public DTO、client bundle依赖、facts、safe receipt、progress记录和console扫描的隔离验证PASS。raw repository definition/attempt response及private definitionDigest不能出server。当前DB浏览器/网络验收须在B3获批执行时重做，不能签为本轮已PASS。

本轮共 **117/117 PASS**：R7B/R7C核心回归64，浏览器回归17，当前RPC/trigger预算及restart6，scope reference30。首次新增预算测试过早断言异步CUE_PENDING已转AWAITING_ACTIVITY，现改成订阅状态条件等待后PASS；未改产品代码或用固定sleep证明正确性。

### Implementation / Deployment Prerequisites — Not Hidden by Scenario Approval

现有activity-completion/2 storage仍硬编码isolated-test-db；scope issuer、当前DB受控transaction transport/composition尚未安装。还需强化单Activity目标下correct attempt与node completed/100的相互一致性检查，现有代码只检查progress存在/attempt_count。必须完成这些最小server实现并验证，才能构建B3A-Deploy批准包。禁止直接将隔离receipt改名冒充current-DB证据。

[approval-b3a-deploy.json](evidence/teaching-agent-stage-1f-r7c-b/approval-b3a-deploy.json)列出拟修改3个existing runtime server/contract文件和4个development-only server文件，**没有candidate build、没有部署批准、没有产品源码写入**。场景预算批准不覆盖产品部署。待实现后锁定精确process/artifact/source哈希再请求部署批准，不能用现有readonly Docker transport或任意SQL脚本绕过repository来执行。

### B3A Recommendation

[Approval B3场景合同/预算](evidence/teaching-agent-stage-1f-r7c-b/approval-b3-current-db-e2e.json) **READY FOR USER REVIEW**；current executionReady=false，以上前置门禁未完成前禁止执行。Current DB attempt/progress0，scope DISABLED，Actor/Tenant/B1/R6F未修改，Agent/Provider/Publish/Pins0，Feature OFF，Allowlists EMPTY。R7D/Stage1G NOT READY。本轮在合同与批准包处停止。


## R7C-B3A Interruption Recovery and Implementation Closure

本节追加中断恢复后的实现事实；保留前文 B3A 仅设计、B1/B2 曾 BLOCKED 的历史。本阶段主线仍为 UPLY Teaching Agent。B1/B2 COMPLETE；本轮只实现和隔离验证执行基础设施，没有部署、没有激活 scope、没有 current-DB attempt/progress。

### Interruption Recovery

恢复审计检查了完整 git status、diff --stat、diff --check、落盘源码、package/lock、npm cache/log 配置及开发进程。中断前的 scope/journal/guard 与 repository 修改已保留，未另造一套实现。初始 pg 未完整安装。后续网络中断留下 lucide-react 声明文件缺失及 SWC 二进制不完整，分别导致 TypeScript 缺声明和构建 Bus error。最终用本次命令的 `/tmp/uply-b3a-npm-cache`、`/tmp/uply-b3a-npm-logs` 执行 workspace-only `npm ci --ignore-scripts` 恢复 lockfile 精确版本；没有 sudo、全局 npm 配置或权限放宽。

最终 pg=8.23.0，@types/pg=8.23.1；新增15个lock entries，既有 package entries 变化0。线上独立 node_modules 未改动。最终无部分安装，源码 diff check PASS。新的只读连接确认 actor-scoped attempts/node progress/page progress 全0、session0/refresh0、scope文件不存在；网络中断没有造成当前DB业务mutation。完整落盘清单见 b3a-interruption-recovery.json / b3a-workspace-scope.json。

### Canonical Runtime Reuse and Transaction Implementation

复用现有 LessonRuntime、single_choice domain、multiple_choice renderer、Node5/Node7第一题的公开投影、server-only secret、grader、trusted repository、7参数RPC、attempt/node_progress和事实读口。B3只新增受控准入与同连接 transport，不新建Runtime、Activity、Progress或completion authority。

node-postgres 每个repository transaction使用一个Client；显式BEGIN、advisory lock、definition/snapshot校验、同连接7参数RPC、postcondition、COMMIT。只有确认COMMIT才返回；连接错误/超时为UNKNOWN，保留journal claim、关闭mutation、不重试。[node-postgres transaction contract](https://node-postgres.com/features/transactions)；TLS通过固定服务文件和CA验证，[node-postgres SSL](https://node-postgres.com/features/ssl)。DB凭据只在server私有配置中读取，不进入Client、journal、receipt或日志。

CURRENT_DEVELOPMENT_DB discriminant由固定canonical环境/DB配置的真实transport提供；隔离测试receipt仍为isolated-test-db，未改名冒充当前DB证据。readback使用新的连接，progress.updated_at/attempt sequence/durable digest是状态证据，不将sourceRevision冒充student revision。

### Scope, Budget and Safety

scope固定scenario `r7cb-b3-wrong-correct-recovery-1`，TTL<=15分钟，绑定environment、DB、现有actor/tenant、lesson/activity/version/freeze/B1 snapshot、generation和预算。generation起点修正为现有StepController的0。正常Platform Owner是操作授权者，development actor仅是domain执行主体，不获得JWT、不经学生admission、不改StudentPolicy。

私有scenario.json与两个dispatch文件采用exclusive create/fsync；claim包含request hash/slot/generation，不能存答案或完成事实。重复、并发、stale及第三次dispatch均fail closed；UNKNOWN不释放claim。每次写前读取actor-scoped安全事实，并在repository事务内锁定actor/profile/membership，核验ban horizon、session0/refresh0、inactive/suspended/non-default、freeze与当前目标、max3、counts_toward_completion、无chapter_test聚合、精确attempt/progress基线和postcondition。

唯一批准的未来场景仍为wrong一次、correct一次；预算3 INSERT/1 UPDATE/0 DELETE。完成一致性要求第一条incorrect且未完成；第二条correct且progress completed/100/mastery100/attempt_count2。第二次COMMIT确认后故意抑制响应并关闭scope，Runtime只能通过独立readback恢复。current-DB no-commit变体仍DEFERRED，不扩大预算。

### Owned Child, Recovery and UI

内部Owner页面 `/platform/dashboard/admin/development-execution/runtime` 复用LessonRuntime，没有加入学生/租户导航。页面和server action在非canonical环境或缺少独立execution approval时关闭准入；构建包含route不代表production开放。部署本身不会创建 execution-approval.json，也不会激活scope。

父进程仅通过受控IPC创建 `.next/server/b3/child.cjs`；child不是第二套Runtime，只有现有repository/completion ports。重启只针对记录的owned child，先关闭mutation再退出/重启；不操作PM2、数据库或服务器。父进程丢失连接时child关闭scope并退出。浏览器刷新后提供显式“恢复已有场景（仅只读）”，不自动重新激活；waiting hint是presentation observation，完成状态只认durable readback。

### Verification and Evidence Boundary

B3A新增29/29 PASS，R7B/R7C/B3原回归117/117 PASS，合计146/146。新增验证涵盖真实pg与7参数RPC、数据库内安全守卫、两次预算/第三次拒绝、Owner与浏览器参数拒绝、wrong hold、第二次COMMIT响应丢弃后readback恢复、只读composition重建、实际隔离服务child退出/启动、scope持久关闭与秘密隔离。现有17项浏览器回归覆盖cue/seek/refresh/stale/user-pause/autoplay/media错误及DOM/network/facts边界。

真实pg测试使用owned临时PostgreSQL容器（host只暴露loopback测试端口），无当前DB配置；其他durable回归使用既有network-none隔离机制。测试容器已精确停止删除。构建后的真实B3 child在未获执行配置时拒绝启动并正常退出，未读取或修改当前DB。

当前DB的Runtime UI作答、真实CURRENT_DEVELOPMENT_DB receipt、当前DB的child完成恢复仍**未执行**，不能标为当前DB E2E PASS。B3A证明基础设施和隔离合同，不证明当前学生published E2E。

TypeScript PASS；Next build PASS；B3A修改文件lint PASS。完整35文件范围中有前阶段已有3条Hook错误及2条警告，相关复用文件hash未变，新增lint错误0。diff check、source hash lock、private bundle marker扫描PASS。R6F完整baseline由既有只读SQL复核MATCH，B1 1/1/1 unchanged，actor/tenant unchanged，ledger458、7参数RPC hash unchanged。

### Approval B3A-Deploy Package

Current Build: `vZokoJqpKDRZxnpQcQpah`。Candidate Build: `KaSWaVYOIk7ZjWGpvVWIf`。

Archive SHA256: `5d0b773125450bca5372085c142b2b524907f962ddc73837183615ffeb764c9e`。

候选封存在workspace `build/r7cb-b3a-candidate/`，不依赖/tmp保留。完整source/hash、依赖包integrity、archive/dependency/source tar SHA见 [Approval B3A-Deploy](evidence/teaching-agent-stage-1f-r7c-b/approval-b3a-deploy.json)。

本轮修改的3份既有产品文件：

- `src/features/smart-textbook-runtime/core/execution-contracts.ts`
- `src/features/smart-textbook-runtime/server/durable-activity-completion.server.ts`
- `src/features/smart-textbook-runtime/server/durable-activity-repository.server.ts`

本轮新增的11份产品文件：

- `src/app/[space]/dashboard/admin/development-execution/runtime/media/route.ts`
- `src/app/[space]/dashboard/admin/development-execution/runtime/page.tsx`
- `src/features/development-execution/components/execution-console.tsx`
- `src/features/development-execution/server/execution-child.server.ts`
- `src/features/development-execution/server/execution-composition.server.ts`
- `src/features/development-execution/server/execution-guard.server.ts`
- `src/features/development-execution/server/execution-journal.server.ts`
- `src/features/development-execution/server/execution-manager.server.ts`
- `src/features/development-execution/server/execution-scope.server.ts`
- `src/features/development-execution/server/execution-transport.server.ts`
- `src/features/development-execution/server/execution.actions.ts`

另需首次部署19份已有R7B/R7C Runtime文件，均与此前stage hash完全相符（未重写）：

- `src/lib/smart-textbook-runtime-v1/contracts.ts`
- `src/lib/smart-textbook-runtime-v1/registry.ts`
- `src/lib/smart-textbook-runtime-v1/validator.ts`
- `src/features/smart-textbook-runtime/core/block-registry.ts`
- `src/features/smart-textbook-runtime/core/services.ts`
- `src/features/smart-textbook-runtime/core/target-registry.ts`
- `src/features/smart-textbook-runtime/components/runtime-context.tsx`
- `src/features/smart-textbook-runtime/components/runtime-root.tsx`
- `src/features/smart-textbook-runtime/components/block-renderer.tsx`
- `src/features/smart-textbook-runtime/components/region-renderer.tsx`
- `src/features/smart-textbook-runtime/components/choice-block.tsx`
- `src/features/smart-textbook-runtime/components/template-renderer.tsx`
- `src/features/smart-textbook-runtime/components/runtime.css`
- `src/lib/smart-textbook-runtime-v1/execution.ts`
- `src/features/smart-textbook-runtime/server/native-execution-projection.server.ts`
- `src/features/smart-textbook-runtime/core/native-media-controller.ts`
- `src/features/smart-textbook-runtime/core/runtime-facts.ts`
- `src/features/smart-textbook-runtime/components/video-block.tsx`
- `src/features/smart-textbook-runtime/server/native-activity-binding.server.ts`

另外仅package.json/package-lock.json增加pg8.23.0/@types/pg8.23.1及15个锁定dependency entries，既有依赖变化0。合计35文件。候选只从锁定base、已部署B1/B2源码和这些明确文件组装，未同步工作区其它内容。

拟部署PM2 target仅uply-first-enable；迁移NONE、schema/RLS/StudentPolicy/Auth/runtime.json/launcher/Tailscale/public均不变。部署时先保留previous.next、35路径的存在/缺失与hash/mode manifest、15新增依赖目录状态。只切换批准产物及精确文件；不在live执行广泛npm install。失败时仅按manifest恢复这些路径与previous.next；不删除DB行、actor/tenant、canonical Activity或scenario journal。

**B3A部署尚未批准；B3 current-DB执行也尚未批准。** 两者独立。部署批准不包含执行scope激活、不包含wrong/correct、不包含任何attempt/progress写入。后续current-DB场景须另行批准有效<=15分钟的执行激活配置，并重新核验RPC/trigger hashes、冻结/actor安全与0基线。

本轮状态：READY FOR B3A DEPLOY APPROVAL。Interruption Recovery PASS；Worktree Recovered PASS；Current DB Attempt/Progress Writes0；Scope DISABLED；Agent0/Provider0/Publish0/Pins0；Feature OFF、Allowlists EMPTY；R7D/Stage1G NOT READY。停在部署批准前。


## R7C-B3A Approved Deployment Receipt

Approval B3A-Deploy 已由用户明确批准，本节记录部署事实；不覆盖B3 current-DB scenario或scope激活。部署前重新核对三个archive SHA、35份source hash、15个dependency directories、既有lock entries、ledger458、7参数RPC及node-progress trigger hashes、完整冻结baseline、B1/B2及actor-scoped0基线，全部MATCH。

预检额外比较发现live源码树与实际build输入存在123处历史差异。未立即切换PM2，先核对B2A构建脚本的输入来源：B1C sealed source manifest + B1D override + B2A source hashes，共1324个旧build输入。新candidate与该**实际旧build来源**恰好只有批准的35文件变化，范围外变化0；其中122份src的落盘状态与B2A部署前boundary记录完全相同，另一个是旧build采用的tsconfig输入。因此这是既有source/artifact不同步，并非本candidate带入范围外变化。没有扩展35文件范围，也没有重新构建或修补已批准candidate。详见 b3a-deploy-nonscope-source-drift.json 的历史与resolution。

三个批准产物均保持原hash：

- build：`5d0b773125450bca5372085c142b2b524907f962ddc73837183615ffeb764c9e`
- dependencies：`3c2b871724cc349414031f1471e05504f0b969596d8d07f25e162e6704012ae9`
- source：`c76868ac77b5fec44c0d8a072396a2aea2174af79f03664b26068594b0914ae7`

回滚材料已保存于 `/home/yangzhen/operations/uply/teaching-agent/r7cb-b3a/20260917T130647Z/rollback`：previous.next、35路径的existed/absent/mode/hash及存在文件、15依赖目录状态、private B3状态、完整presence manifest。15目录部署前全部ABSENT；仅解包批准145个依赖文件，pg8.23.0 / @types/pg8.23.1，未在live运行任何依赖安装器。

仅stop/start `uply-first-enable`。当前Build **KaSWaVYOIk7ZjWGpvVWIf**，PM2 online，root HTTP200。35文件hash与15目录内容部署后再次MATCH，source tree变化仅批准33份src（另外2份package文件）。runtime.json、launcher、Tailscale和public内容hash保持不变。迁移/Schema/RLS/StudentPolicy/Auth/RPC均未修改，ledger仍458。

### Owner Route and Inactive Execution Verification

使用原有正常Platform Owner Chrome session访问8443 `/platform/dashboard/admin/development-execution/runtime`，无重登录、Cookie/JWT复制、magic link或impersonation。Owner页面含新Build marker，显示“当前未获执行批准，范围关闭。”；“激活批准的执行范围”按钮DISABLED，video/Activity未挂载。“恢复已有场景（仅只读）”按钮未点击，所有UI mutation动作0。匿名GET返回Next streamed login redirect，Runtime UI不出现；不能将streaming HTTP200误判为授权成功。

部署后的Client静态文件和页面公开输出没有server私有标记或DB密码字面值命中，未保存任何认证秘密。compiled server child未含PGRST202/old responder fallback标记。页面console error/warning0。B3 child仅安装，未启动；private B3目录仍ABSENT，未创建execution-approval.json、scenario.json或dispatch journal，scope DISABLED。

新的独立只读DB连接确认B1 canonical1/1/1、R6F freeze MATCH、B2 actor/tenant exact且仍banned/inactive/suspended/non-default、actor session0/refresh0、attempt0/node_progress0/page_progress0；7参数RPC和node-progress triggers仍MATCH。没有用全库Owner refresh数量推断actor安全。

B3A Deploy **PASS / GO**。Execution infrastructure INSTALLED，scope issuer INSTALLED BUT INACTIVE。Current DB execution **AWAITING SEPARATE APPROVAL**，本次部署授权不授予execution activation。Agent0/Provider0/Publish0/Pins0，Feature OFF、Allowlists EMPTY，B1/B2 COMPLETE；R7D/Stage1G NOT READY。部署成功后停止，未运行wrong/correct、lost response、restart或Runtime current-DB场景。


## R7C-B3 Approved Current-DB Execution — 2026-09-17

本节追加真实执行结果，保留此前未授权、BLOCKED和部署历史。用户已明确批准唯一场景 `r7cb-b3-wrong-correct-recovery-1` 的执行激活；主线仍为 UPLY Teaching Agent。没有部署新代码、修改PM2、运行Agent或进入R7D。

### Fresh Preflight and Activation

新独立只读连接确认：Build `KaSWaVYOIk7ZjWGpvVWIf`、35个source hashes、ledger458、既有7参数RPC和node-progress trigger definitions全部MATCH。B1 binding1/1/1，R6F冻结内容MATCH；Activity max_attempts3、counts_toward_completion=true、chapter_test_id=NULL。既有B2 actor/tenant身份匹配，actor banned、profile inactive、membership student/suspended/non-default、actor sessions0/refresh0，ban覆盖批准到期后24小时以上。attempt/node_progress/activity_page_progress空基线均0；B3目录及旧claim不存在。

使用部署代码既定私有路径和schema创建一次execution-approval.json，issuedAt `2026-09-17T13:26:48.576967Z`，expiresAt `2026-09-17T13:41:48.576967Z`，TTL恰好900秒；没有续期。使用原正常Platform Owner Chrome会话点击一次“激活批准的执行范围”，正式Owner action发放绑定scope，generation0；没有CLI模拟Owner或直接SQL/RPC提交。LessonRuntime挂载，初始READY。执行期间未改变产品源码。

### Wrong → Independent Readback → Correct

点击现有视频播放控件后，视频在约5.08秒跨越cue、暂停并由既有MultipleChoice renderer显示题目。只提交一次错误选择。正式grader/trusted repository/同连接事务/advisory lock/definition验证/7参数RPC/后置检查完成COMMIT。

`13:37:44.048635Z`：attempt1 incorrect、score0；新node_progress为in_progress、completion0、mastery0、attempt_count1。新的独立READ ONLY连接在 `13:37:51.790727Z` 确认全部事实，Runtime在 `13:38:12.952Z` 仍为AWAITING_ACTIVITY、video.paused=true。此核验完成后才允许继续正确提交。

只提交一次正确选择。`13:39:16.725880Z`：attempt2 correct、score100；同一progress更新为completed、completion_percent100、mastery_score100、attempt_count2。随后部署代码按批准合同抑制成功响应，浏览器对应POST收到500；没有第二次correct提交，没有自动retry。紧随的独立readback返回真实 `activity-completion/2` / `CURRENT_DEVELOPMENT_DB` / COMPLETED receipt，attemptSequence2，观察时间 `13:39:17.127Z`。外部新只读DB连接再次确认，Runtime在 `13:39:30.152Z` 为PLAYING、paused=false、视频位置约17.97秒。position仅为观察，不构成progress authority。

### Controlled Child Restart and Recovery

正确COMMIT后既有服务已经写入disabled marker并关闭mutation admission。Owner仅点击一次“重启受控进程并只读恢复”。action返回ready=true；host只读进程核验显示新的owned child PID665807于 `13:39:41Z` 启动，父Next PID503047仍为 `13:06:50Z` 启动，UPLY PM2、服务器和数据库均未重启。

重启后的新独立DB连接仍确认attempts2、单行completed progress、page progress0，progress xmin未再变化。Runtime重建后为RESUME_READY、位置0、题目未重新挂载；只读检查现有NativeMediaController状态确认COMPLETED及新 `CURRENT_DEVELOPMENT_DB` evidence（observedAt `13:41:23.271Z`），不是旧内存completion。保持安全等待用户播放，没有把重建当作新作答。

证据边界：旧child PID未成功采集，sandbox `/proc`未显示host进程；没有伪造before PID。DevTools将重启restore请求列为HTTP200，但事后请求body不可获取并显示ERR_ABORTED；没有补造该body。重启成功由action ready、新child启动时间、现有controller的新durable evidence及独立DB readback交叉证明。

### Exact Write Budget and Retention

| Phase | attempts | node_progress | Other business tables |
| --- | --- | --- | --- |
| Wrong | INSERT1 | INSERT1 | 0 |
| Correct | INSERT1 | UPDATE1 | 0 |
| Total | INSERT2 | INSERT1 / UPDATE1 | 0 |

总计 **3 INSERT / 1 UPDATE / 0 DELETE EXACT**。attempt numbers1/2，无重复；最终progress1行completed100%，mastery100、attempt_count2，activity_page_progress0。扫描全部207张public/auth普通表，两个提交事务的可见MVCC写入仅出现上述attempts与node_progress。错误阶段被更新前的progress由立即只读核验保留；DELETE为0依据锁定RPC/trigger及无DELETE调用，未声称安装了数据库审计trigger。

冻结脚本、Script Version、Objectives、canonical Activity/private answer、Auth、tenant/profile/membership、其它progress/aggregate、Publish、Agent、Provider、Pins写入均0。没有使用全库refresh数量代替actor证据。保留attempts/progress、两条独占dispatch claim、scenario和receipt；未cleanup，未释放claim。

### Runtime Regression and Public/Private Boundary

本轮执行82项不连接当前DB的既有fixture回归，82/82 PASS，覆盖cue dedupe、前后seek、刷新等待/完成、stale generation、user pause、autoplay、media error、single media owner、UNKNOWN/no retry、第三次dispatch拒绝、scope及Owner guard、facts与公开投影。此前锁定B3A的146项测试证据继续保留。故障回归属于fixture证据，未把它们冒充额外current-DB场景；本次current-DB浏览器确实验证play/cue/pause/reveal、wrong hold、correct readback resume、child restart/completed restore。

真实网络Manifest/receipt、DOM、现有controller evidence、progress、private approval/journal及client静态产物扫描未发现canonical private answer、server secret配置或凭据泄漏。全量静态扫描有一个已有Script Studio字段名翻译表的answer_key字符串，不含本题私钥且不被B3页面加载；明确记录为无关authoring字段名，而非忽略真实答案命中。console只有批准的response suppression所致500。没有保存Cookie/JWT、认证header或答题request body。正式Lesson Tool/Agent registry仍未绑定；facts正式投影由fixture回归覆盖，当前页面证据直接读取现有controller的durable state。

现有预览UI仍显示“不计入正式进度”的通用文案；本次是受控development domain执行，实际durable写入已独立验证。未将其表述为published Student admission E2E，亦未为修文案越权更改已部署代码。

### B3 Final Closure

**Overall GO；B1 COMPLETE；B2 COMPLETE；B3 COMPLETE；Current DB Durable E2E PASS。**

Owner点击关闭范围后，持久disabled marker存在；批准窗已自然到期，无续期。scope DISABLED、mutation admission OFF；最终只读核验保持attempts2/progress1 completed/actor sessions0/refresh0、freeze MATCH、B1 binding1/1/1。运行时可重建真实durable facts，丢失成功响应不引发再次提交。

Agent0、Provider0、Publish0、Pins0；Feature OFF、Allowlists EMPTY；R7D/Stage1G NOT READY。没有开始Lesson Tool或Agent阶段。后续重跑空基线场景需要另行精确cleanup批准，本次不清理。

主要证据：`b3-execution-fresh-preflight.json`、`b3-execution-authorization.json`、各phase-readback、`b3-execution-completion-receipts.json`、`b3-execution-runtime-observations.json`、`b3-execution-restart.json`、`b3-execution-transaction-write-audit.json`、`b3-execution-write-budget.json`、`b3-execution-private-boundary.json`、`b3-execution-regression.json`、`b3-execution-shutdown.json`、`b3-execution-gates.json`。


## R7D-A Read-Only Lesson Tool Integration Audit

B1/B2/B3完成事实保持不变。本轮只读审计及合同设计结论：**READY FOR R7D IMPLEMENTATION**。已找到正式Lesson Tool/Core registry/Domain Ports，但目前只支持published verified selection和last_saved位置，尚无durable Activity Tool接线。新独立current-DB读取仍确认2 attempts、completed100/mastery100/count2、actor session0/refresh0、freeze MATCH、scope DISABLED；没有重跑B3或修改其证据。

现有工具合成测试55 PASS、1 SKIP、0 FAIL。新Tool current-DB acceptance尚未执行，不能由数据库独立审计替代。拟复用现有ToolRegistration/Core executor及durable readRows authority，新增受限只读facts projection与授权binding；不修改StudentPolicy，不伪造inactive development actor的Student session。

详见[专门审计报告](teaching-agent-stage-1f-r7d-a-lesson-tool-durable-facts-audit.md)及 `docs/evidence/teaching-agent-stage-1f-r7d-a/`。本轮产品源码修改0、DB写0、部署0、Agent0、Provider0。没有候选build，Deploy Approval本轮NOT REQUIRED；Feature OFF、Allowlists EMPTY、Stage1G NOT READY。停在合同/实施计划完成处。
