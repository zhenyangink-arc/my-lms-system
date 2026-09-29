# UPLY Teaching Agent — Build Stage 1F Production Readiness

## 1. Executive Summary

**Overall: NO-GO。Production Feature Flag: OFF。Production Migration: NOT APPLIED。**

验证日期：2026-09-14（Asia/Seoul）。本次只执行 readiness 验证及形成报告，业务代码变更 0，未部署、未重启生产、未修改 Tailscale、未调用 live Provider、未读取真实学生会话/成绩/progress，也未向生产教学域或 Agent Infrastructure 写入数据。

已确认的阻断：

- 目标库就是当前线上 Supabase；开发 `.env.local` 指向相同项目。**NO SAFE STAGING ENVIRONMENT**：没有被确认可销毁、只有合成身份、且具有真实 Auth/PostgREST 的独立 Supabase staging。自行建立的 schema-only PostgreSQL 不等于 Supabase staging。
- 目标 migration ledger 的 `202609130001` 已代表 `textbook_grammar_authoring`；本地 Agent 0B 文件使用同一版本。目标没有 Agent 表。不能将 ledger 中的已应用状态解释成 Agent 0B 已应用，不能直接 `db push`。
- 正式应用 production build 编译成功后，在 TypeScript 阶段失败。全项目复核为 397 个错误，全部位于既有 `docs/evidence`；Agent 定向 strict TS / lint 通过。这是本次明确复现的既存部署阻断。
- 当前韩语一级教材关联课时使用 `prerequisite_passed`。现有 Student Policy 必须拒绝；按策略静态推导，可支持课时 **0/1**。没有可以直接纳入本次真实课程 pilot 的已验证内容。
- 实际 Tailscale 入口只做了安全 GET（404）；HTTPS 流/取消实验证据来自独立 loopback TLS proxy，不能替代实际生产代理 Gate。
- Pins 投影和 POST Runtime 分别使用 12 秒、45 秒预算，完整 Explain 链路统一 ≤45 秒未获证明；server tenant/course/user rollout allowlist 尚未实现。

有价值的正向证据：既有测试 328 PASS / 1 SKIP；目标当前完整 schema 的空库恢复与三份 Agent SQL 应用成功（托管角色复制仍有差异）；323 个已生成 client chunks 的边界扫描通过；合成数据库的教学域 23 表前后指纹一致；按 runId 能定位模型阶段、工具、evidence/output gate、usage 和 terminal reason。以上均不抵消未通过的生产 Gate。

## 2. Inputs & Baseline

开始前已完整阅读以下九份文档，历史设计不替代当前源码和目标环境：

1. `docs/assistant-current-state-audit.md`
2. `docs/teaching-agent-architecture-v1.md`
3. `docs/teaching-agent-stage-0a-verification.md`
4. `docs/teaching-agent-stage-0b-foundation.md`
5. `docs/teaching-agent-stage-1a-student-domain.md`
6. `docs/teaching-agent-stage-1b-tools-skills.md`
7. `docs/teaching-agent-stage-1c-runtime.md`
8. `docs/teaching-agent-stage-1d-transport.md`
9. `docs/teaching-agent-stage-1e-student-ui.md`

事实优先级：真实目标环境 > 1E > 1D > 1C > 1A/1B > Architecture v1。遵循根 AGENTS.md，检查安装版本的 Next 本地 self-hosting / distDir / compress 文档。未安装依赖。

工作区 HEAD：`b1672390ae96357a2143358235cc10edeff8d488`。开始时工作区已存在两个课堂接入文件、Growth Toolbox、Script Studio 的修改，以及 Agent 源码、三份 migration、测试、历史文档等未跟踪文件。**这些都属于本次开始前的工作，不算 1F 新增。** 保存 2,592 个 tracked / nonignored 源码与文档文件的 SHA-256 基线；明确排除 `.next*` 生成目录。

方法：源代码/真实启动器/PM2/Tailscale 元数据交叉检查；生产只读 catalog 与非个人课程结构统计；schema-only 快照在全新无网络 PostgreSQL 中恢复；已有测试重跑；额外合成性能、TLS、runId 查询 smoke；独立目录正式构建、bundle/secret 检查。没有使用 SQL bridge 冒充目标 JWT/PostgREST/RLS，也没有采样真实学生。

## 3. Files Changed

本阶段项目内唯一新增文件：

- [docs/teaching-agent-stage-1f-production-readiness.md][report]：本报告。

业务文件、原有文档、三份 migration、依赖、锁文件、`.env`、生产启动配置均未修改。调查脚本、只读连接临时文件、构建和测试产物只存 `/tmp/uply-stage1f-*`。临时 pgpass 在每次只读命令后删除；课程正文只在私有临时输入中用于本地聚合，聚合完成后删除，不进入报告。测试自带的历史 `/tmp/uply-stage1d-*` / `stage1e-*` 结果路径本次被测试重写。

完整 schema archive 与连接元数据保留在私有 `/tmp` 证据目录，不提交到项目；不含业务行，仍按受限运维资料处理。最后复核既有文件哈希及 `git diff --check`；结果见 §31。

## 4. Target Environment Inventory

| 环境 | 本次证据 | 结论 / 可执行范围 |
|---|---|---|
| Development 配置 | `.env.local` 的 Supabase endpoint 与生产 runtime 配置相同 | 是开发应用配置，**不是独立开发数据库**；禁止合成 seed |
| Production | PM2 `uply-first-enable` online；release `/home/yangzhen/releases/uply-first-enable-20260910/source`；实际 launcher 读取受限 `runtime.json` 并启动 Next 127.0.0.1:3000 | 当前服务仍运行旧 release；本工作区未发布 |
| Hosted Supabase target | launcher 校验的 project ref 与本地 linked ref、pooler 目标一致；只读 SQL 连接成功 | PostgreSQL 17.6，生产项目身份已确认；报告不列凭证 |
| 本地 UPLY Supabase | 存在 `my-lms-system` Docker stack，含 Auth、PostgREST、Kong | 数据归属/是否可销毁未确认，未读业务行、未写入、未拿它当 disposable staging |
| 本机另一项目 Supabase | 存在 `koflow` stack | 与本任务无关，未使用 |
| 本次 disposable PostgreSQL | 新建带 stage label 的 tmpfs-only、`--network none`、无 published port 容器 | 当前 schema-only snapshot 的兼容性验证；无 Auth/PostgREST/JWT 服务，不是完整 Supabase |
| 本次临时 Next/TLS | 新建 `/tmp` app，精确产品 routes 替换 trusted test composition，仅 loopback | 无生产用户/Provider 权限；不发布 debug bypass |

运行进程 `/proc/.../environ` 本次不可读取；开关 OFF 的证据是实际 launcher/config 与未被替换的旧 release，未宣称读取到了进程内热更新状态。

生产已配置 `DEEPSEEK_API_KEY`（SET）；`TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED` 未处于精确启用值。仅报告变量名称/状态，不输出值。

## 5. Target Supabase Verification

**Target identified PASS；Target integration PARTIAL。** 通过与实际线上 launcher 的目标核对及真实 SQL catalog 查询识别环境，并非凭 URL 的名字猜测。

只读会话使用既有可信 CA、`sslmode=verify-full`、受限临时 pgpass、`default_transaction_read_only=on`、显式 `BEGIN READ ONLY`、statement/lock timeout。查询自身返回 `transaction_read_only=on`。`pg_stat_ssl` 在 pooler 下反映的是数据库一侧的连接，返回 false；不能据此把客户端校验证书的 TLS 路径写成未加密，也不能声称 pooler 后段已获 TLS 证明。

| Executed | 结果 |
|---|---|
| 当前 catalog：表、列、policies、相关函数、extensions、migration ledger | PASS（只读） |
| 当前 `pg_dump --schema-only --format=custom` | PASS，无业务 data dump |
| roles-only、`--no-role-passwords` | 已取得不含密码的角色定义；恢复差异见 §8 |
| 韩语课程/教材/脚本结构聚合 | PASS，不读学生表中的业务行 |

| Not Executed | Reason |
|---|---|
| synthetic Auth 用户创建及登录 | 没有已确认安全的完整 Supabase staging |
| 目标 student JWT/Cookie → PostgREST → Student Policy 全链路 | 不使用生产学生或向生产 seed |
| 目标正/负 RLS 行访问矩阵 | 同上；catalog 不是授权行为验证 |
| 生产 Agent Run、migration、定义发布 | 未授权，且版本冲突/构建/内容 Gate 未通过 |

## 6. JWT / PostgREST / RLS

**G-F2～G-F5 BLOCKED。** 已有真实 Supabase JS + SQL-backed bridge 测试继续通过，但 bridge 不是真实 PostgREST；fixture RLS 不是目标 legacy policies。

真实 composition 证据：[production.ts][production] 调用 [getAuthContext][auth]，后者使用 `supabase.auth.getUser()`；要求 active 身份、active tenant、tenant role student。Teaching repository 由 `auth.supabase` 构造。只有 Agent persistence/run store 使用 server-only admin client。没有把前端 role/tenantId 当作 authority，没有 teaching admin fallback。

必须补齐的安全 staging 矩阵：

| 场景 | 应有结果 | 本次目标行为验证 |
|---|---|---|
| A1 的有效 enrollment、published、独立可证明解锁内容 | 允许读片段 | BLOCKED |
| A1 的本人 active teaching session | 允许读受限 last_saved 投影 | BLOCKED |
| A2、B1、wrong student、wrong tenant、其他学生 session | 拒绝 | BLOCKED；对应隔离单测通过 |
| expired / inactive / no enrollment | 拒绝 | BLOCKED；对应隔离单测通过 |
| teacher / tenant admin / platform owner token | Student API 拒绝 | BLOCKED；策略/transport 单测通过 |
| invalid session、draft script、unpublished、stale version | 拒绝/安全 stale | BLOCKED；隔离单测通过 |

目标真实 policy 元数据值得关注：`learning_agent_lessons` 和 `learning_agent_script_versions` 的 authenticated SELECT 仅判断 `status='published'`；nodes 的 SELECT 只要求所属 version published。它们本身没有 tenant/enrollment 条件。`learning_agent_sessions` policy 有 `student_id=auth.uid()` 和 tenant member 条件。**不能声称数据库已经独立实施整个 Student MVP 资源规则。**

新 Agent 的 [StudentTeachingReadRepository][repository] 会重新校验 profile、membership、tenant、catalog 祖先、Korean app、enrollment、教材版本、chapter unlock、profile、script 和 node，所以这里不是“已证实新 Agent 越权”的结论。旧 PostgREST 直接可见性及真实 policy 叠加效果必须在安全环境测试；未做攻击性访问、未放宽 RLS、未绕过新 Policy。

## 7. Migration Compatibility

真实文件及依赖顺序：

| 顺序 | Migration | 内容 / 依赖 |
|---|---|---|
| 1 | [202609130001_agent_core_foundation.sql][m0] | 5 个 Agent 表、private helpers、admission/CAS/event/usage RPC；依赖 profiles、tenants、membership、ai_token_usage |
| 2 | [202609140001_agent_runtime_completion_evidence.sql][m1] | 扩展 definition/evidence/output/completion，不可早于 0B |
| 3 | [202609140002_agent_run_cancel_request.sql][m2] | cancel 持久状态、public event sequence、status/cancel RPC；依赖前两份 |

**SQL payload 在当前 schema 空副本应用通过；发布 migration identity FAIL。**

目标 ledger 实际记录：

| Version | Target name |
|---|---|
| 202609130001 | textbook_grammar_authoring |
| 202609130002 | textbook_grammar_practice_binding |
| 202609130003 | runtime_authoring_nonretryable_error |

目标 Agent 表数量为 0，本地却将 `202609130001` 用于 Agent core。相同 version 不能代表两种不同 migration。必须在单独获准的发布修复中解决唯一 migration identity、目标既有历史与本地目录 reconciliation，再重新生成可审阅 apply plan；**不得修改旧 SQL 来伪装已应用，不得修写 production ledger 跳过检查**。本阶段未改旧 migration。

已检查：当前目标不存在 Agent table 名称；完整 schema 副本应用没有 table/function/index/policy/column 冲突和类型/外键创建错误。5 个 Agent 表启用 RLS；所查 8 个 public Agent RPC 为 SECURITY DEFINER、空 search_path、authenticated 不可执行、service_role 可执行；Agent private schema 不对浏览器开放。新 usage 三条 restrictive policy 与旧 SELECT policy 共存。完整 public policy 比较：277 → 280，原 277 条均未变化，仅新增三条 Agent usage 写边界。

动态函数行为在已有隔离测试覆盖；目标 catalog clone 尚未通过真实 user JWT 或完整托管 role graph 的行为测试。不能将空库 DDL 成功写成目标全部权限兼容 PASS。

## 8. Migration Staging Verification

本次没有再次只拿最小 synthetic schema 充当目标 dry-run。实际执行了：

1. 从当前生产目标只读导出完整 schema-only archive，无 auth/users、sessions、messages、progress 数据。
2. 在全新无网络 tmpfs PostgreSQL 17 容器中恢复。public 基线表 174 张。
3. 顺序应用三份原始 Agent migration，SQL exit 均为 0；public 表变为 179 张。
4. 查询 Agent RLS、RPC execute grants、SECURITY DEFINER/search_path、triggers 与 usage policies。
5. 比较全部既有 public policies 无变更；auth users、teaching sessions、Agent runs 均为 0。

恢复限制必须保留：首次 roles restore 在试图把 initdb bootstrap postgres 改为非 superuser 时失败，随后的 schema 恢复也失败，该次结果不计成功。第二个全新容器仅跳过 bootstrap postgres 的 CREATE/ALTER；roles restore 仍在托管 `GRANTED BY supabase_admin` 的 membership grant 处失败。该容器的**完整 schema archive 恢复 exit 0**，三份 Agent SQL 全部成功，但 hosted role membership graph 没有完整复刻。

因此 **G-F7 PARTIAL**：已在 disposable current-schema copy 应用，不是完整 Supabase staging apply PASS。未宣称旧应用对真实业务行无影响。没有在生产执行任何上述恢复/DDL；本次自建容器验证完毕后仅清理自身容器。

## 9. Production Migration Plan

**NOT EXECUTED；Production Migration: NOT APPLIED。** 以下是下一次明确授权后才可执行的计划，当前停在 preflight blocker。

1. 先解决 §7 migration identity；核对目标所有 versions/names 与 reviewed source checksum，任何同 version 不同内容立即停止。不得直接执行全目录 push。
2. 确认可销毁 full Supabase staging；重放当前 schema、完整角色/权限与三份 SQL，并通过 JWT/PostgREST 正负矩阵和旧应用 smoke。
3. 记录当前生产 release、config 状态（仅变量名/状态）、PM2/Tailscale 路径；global flag OFF。取得符合现有运维要求的恢复点及 schema/roles 元数据，验证恢复能力。**本次 schema-only 文件不是生产数据备份。**
4. 在授权窗口应用新的、已消除 identity 冲突的 0B 发布步骤，确认 5 表、FK、indexes、RLS、不可变 triggers、usage columns 与 restrictive policies。其后才允许继续。
5. 应用 1C，确认 extended event RPC、definition artifacts、completion/evidence/output guard；不允许缺 evidence 的 completed。
6. 应用 1D，确认 cancel、status、sequence RPC、service-only grants、cross-owner denial。
7. 三份迁移不自动发布 tenant 的 Agent definition。按 [pinStudentRuntimeDefinition][definition] 的精确 manifest/artifact digest，通过受限服务端运维路径审核发布指定 tenant 定义；必须有合法 actor/membership。当前没有通用发布脚本，本阶段不新增、不执行此写入。
8. 核对旧课堂 schema/policies、既有 ai_token_usage 行兼容与课堂 smoke；应用 routes 仍 OFF。任何 SQL/grant/guard 异常，停止下一步并保持 OFF。

不要把 `SET ROLE service_role` 单独调用成功当成浏览器资源授权成功。运行回滚采用 §25 的前向安全方案；不自动 DROP TABLE。

## 10. HTTPS Proxy Verification

实际 Tailscale `serve status --json` 显示 UPLY 的 HTTPS `:8443` → `http://127.0.0.1:3000`。另两个转发入口属于现存其它用途，均未修改。

| Executed | 结果及限度 |
|---|---|
| 真实生产 HTTPS 无 Cookie 安全 GET `/api/teaching-agent/runs` | 404，TTFB 21.048 ms；只证明当前入口可达，旧 release 的 404 不能证明新 route gate 正确运行 |
| 既有 actual Next Node direct transport test | PASS，真实 HTTP，测试 composition，非 live Provider |
| 新增私有 loopback TLS proxy → `next start` | 临时 fixture 正式 build exit 0；原产品 routes + trusted synthetic composition；下面逐帧/取消/Origin 实测 |

| Not Executed | Reason |
|---|---|
| 真实 Tailscale → 新 Agent NDJSON POST/status/cancel | 生产运行旧 release且 flag OFF；没有安全 synthetic route；任务禁止改 Tailscale/发布后门/部署 |
| 实际生产浏览器 Cookie auth 与流结合 | 无安全测试身份/完整 staging |

**Production-like Proxy: PARTIAL。** 临时 TLS proxy 没有 Tailscale 的确切 buffering/header/disconnect 实现，不能冒充最终生产入口验证。

## 11. Origin / Host / Scheme

[student-handlers.ts][handlers] 的 expected origin 为 `request.url.protocol + '//' + Host`，不会使用 forwarded-host 作为 CSRF authority；Origin 缺失/null、不匹配或 `Sec-Fetch-Site: cross-site` 被拒绝。

临时 TLS proxy 保留外部 Host，并明确设置 `x-forwarded-proto=https`：合法 HTTPS POST 返回 200；伪造跨源 Origin 返回 403。这证明安装版本 Next 在**该明确的 header 行为下**与现有验证兼容，不是 Tailscale 自动具备同样行为的证据。

实际 Tailscale 转发后的 request.url scheme/Host 行为没有在新 route 上采样。G-F9 PARTIAL；后续必须在安全且等价的最终入口验证 same-origin 成功与 cross-origin 拒绝。没有采信任意 forwarded-host，也没有新增 auth bypass。

## 12. Streaming / Buffering

生产 Next 配置没有关闭默认 compression；先前 direct test 的临时配置为 `compress:false`。本次新增的临时 **production-mode** Next fixture 使用默认 compression、客户端声明 `Accept-Encoding: gzip`，传输结果如下：

| Frame | HTTPS 开始请求后的到达时间 |
|---|---:|
| run.started | 26 ms |
| run.status | 204 ms |
| tool.status started | 385 ms |
| tool.status succeeded | 566 ms |
| answer.final | 751 ms |
| run.completed | 751 ms |

响应 `Content-Type: application/x-ndjson; charset=utf-8`；`Content-Encoding` 未设置；`Cache-Control: no-store`；`X-Accel-Buffering: no`；HTTP/1 chunked。该小型合成响应在实验路径没有整段缓冲。没有通过等待完整响应绕过 streaming。

既有 Next direct 本次观测（从收到 Response 开始计时，**不同于上表 request TTFB 口径**）：3 / 178 / 359 / 540 / 794 / 794 ms。

实际 Tailscale、较大输出、客户端 Accept-Encoding 组合仍未测；不能断言实际代理所有 NDJSON 均不压缩或永不缓冲。G-F8/G-F11 保持 PARTIAL，现有证据不支持为假想问题修改生产 compression。

## 13. Disconnect / Cancel

| 路径 | 本次证据 |
|---|---|
| Node direct HTTP cancel | PASS，724 ms 收敛至 cancelled |
| SQL bridge + 隔离 PostgreSQL cross-instance cancel | PASS，529 ms；23 教学域表指纹不变 |
| 私有 TLS proxy 的 cancel endpoint | POST 200，流以 run.cancelled 结束；store 为 synthetic composition |
| 私有 TLS proxy client disconnect | 销毁客户端连接，400 ms 后 GET status 为 cancelled；测试 runtime 检查 abort/cancel |
| 实际 Tailscale disconnect / persistent cancel | NOT EXECUTED，PARTIAL |

[handlers][handlers] 将 request.signal / ReadableStream cancel 传入 runtime abort，并尝试持久化 cancel；[run-store][store] 有 owner-bound RPC；本地 abort registry 只负责同实例快速停止，跨实例依赖持久取消检查。[Runtime][runtime] 以 POST receivedAt 锚定 45 秒 execution deadline，下一检查点拒绝继续。

不能承诺浏览器断连立即停止 Provider 计费，也不能把 TLS fixture 的内存 cancel 当作代理到真实 Agent 表的证明。deadline 后允许 bounded stop-only usage/terminal cleanup；不得再执行教学读取/模型/工具业务工作。生产 OFF 后 GET/cancel routes 也 gate 到 404，因此关停不是“依赖浏览器之后再调用 cancel”；必须按运维 drain/deadline/过期状态流程检查在途 Run。未在生产执行 drain。

## 14. Real Course Pin Coverage

真实生产课程内容元数据与只读聚合，未使用学生身份、未读聊天或进度。区分 catalog lesson、teaching lesson/module 和 locale pin，避免把不同粒度都叫 lesson。

| 指标 | 本次结果 |
|---|---:|
| 已发布 Korean app 课程（外围 inventory） | 5 |
| 这些课程中的 catalog lessons（外围 inventory） | 19，均 published |
| 本次韩语一级目标课程 / catalog lesson / published textbook | 1 / 1 / 1 |
| 教材当前 published version 下 chapters | 17，均 published |
| 教材 modules / published teaching lessons | 132 / 132 |
| published script versions / nodes | 1 / 8 |
| 没有 published script 的 teaching lessons | 131 / 132（99.24%） |
| node × locale 的 authored segments | 18 |
| 包含韩语且 ≤2000 字符的 locale segments | 10 |
| 非韩语过滤 / 过长过滤 | 8 / 0 |
| 按每章页面输入，module/lesson/version/node/pin 数量 cap 截断 | 均为 0，比例 0% |
| 当前策略可支持的目标 catalog lessons | **0 / 1（静态策略推断）** |
| 当前规则下可发给学生的 Pins | **0（静态策略推断）** |
| 超时 / 读取失败 | 内容只读聚合命令均成功；真实 student projection 未执行，超时率 Unknown |

范围来源：页面 [page-content.tsx][page] 调 `loadSmartDigitalTextbook` 指定 chapter，并把该章 modules 交给 [lesson-slots][slots]，不是将全部 132 modules 一次塞入 cap。章 0 有 4 modules，其它每章 8；唯一 published script 在章 1，8 nodes，按两种 UI locale 计可选 10 个 pin 单位。10 **不是去重后的 10 个韩语句子**；同一源语言可供两个 locale 引用。

主要阻断是目标 catalog lesson 的 `unlock_mode=prerequisite_passed`，在 [independentlyUnlocked][access] 提前被拒绝。章 1 catalog chapter 为 `prerequisite_completed`，其它章 2～16 为 `prerequisite_passed`；只有章 0 为 immediate，但也受所属 lesson 拒绝且没有 published script。没有读取真实 completion 来试图放行。

课程统计成功 ≠ user-scoped projection 成功；0 Pins 是代码与公开内容状态组合的明确静态推断，不是伪造的 student 端实测。当前不能以降低 unlock/版本/enrollment 标准换覆盖率。

## 15. Selection Projection Performance

真实代码：候选 module 最多 16、published teaching lessons 16、versions 32、nodes 32；随后每个 node × 两个 locale 重做完整 Student Policy。结果最多 128 pins，segment index 最多检查 2000，单条展示 ≤2000 字符。12 秒 signal 从 slots loader 开始，失败/超时返回 undefined；已取得的部分 pins 也不会在 catch 后保留。

页面在返回 SmartTextbookShell 前 **await** 该可选 loader，因此 flag ON 的首屏最多会承受这段额外等待。OFF 在任何候选查询前返回。

根据真实目标唯一 script 的 8-node 结构构建合成 shape smoke，使用实际 projection/repository/Supabase SDK，但底层为内存 HTTP bridge、合成文本与身份。N=2；无目标网络 RTT，**不是生产 latency，也不是 p95**：

| Shape | Sample | Projection ms | SDK SELECT 数 | Pins | Timeout |
|---|---|---:|---:|---:|---|
| 独立解锁的合成 8 nodes | cold-ish | 62.69 | 288 | 32 | 无 |
| 同 shape | warm | 36.06 | 288 | 32 | 无 |
| 使用目标 lesson 锁规则的合成 8 nodes | cold-ish | 5.31 | 64 | 0 | 无 |
| 同拒绝 shape | warm | 5.27 | 64 | 0 | 无 |

上表 32 合成 pins 不冒充真实课程的 10 个内容候选；测试只匹配 node 规模，不复制教材。查询数不含 slots loader 的前置 3 个候选查询；category 祖先深度、catalog chapter 分支会改变每次 policy 查询数。可见重复串行授权读取是重要性能风险，但不能把内存耗时或简单乘法当成生产百分位。

目标 student projection 的 cold/warm、实际 RTT、首屏等待、读取失败率均 BLOCKED。G-F13 PARTIAL；没有为了性能减掉授权检查。

## 16. Full Agent Runtime Performance

现行计时边界：

| 阶段 | 预算 / 观测 |
|---|---|
| 页面 Pins selection projection | 独立 12 秒 signal，不在 POST receivedAt 内 |
| POST body + transport auth | metadata 在 handler 开始生成；body/auth 各有限等待；耗时计入随后 runtime 的 receivedAt+45 秒 |
| selection verify、admission、context、planning、tool、corrective、final、正常 persistence | 共用同一 45 秒 absolute deadline；不是每次 ModelCall 45 秒 |
| 取消/失败后的 usage、failure trace、terminal CAS | 允许各自最多 2 秒 stop-only cleanup；不能声称所有 I/O 在第 45 秒瞬间停止 |
| 浏览器/最终代理、页面加载、replay/status 辅助收尾 | 不等于完整统一 deadline 已被产品端测得 |

额外合成 smoke，均无 live request：正常实际 Student Runtime + 真 Tool 实现 + 内存 persistence，用 2 次 mock model calls，53 ms completed；慢 Provider fixture 的 fetch 永不完成，**receivedAt 未前移、真实等待** 45,016 ms 后 failed/run.failed，1 次 model call。该 16 ms 是本机 timer/调度/收尾观测，不能将其写成严格端到端 ≤45,000 ms PASS。

已有回归另覆盖 slow auth、Provider stream、final persistence、cancel/evidence 无后续成功、deadline fencing。Stage 1C 的历史 live 约 14～15 秒不作为本次生产 p95/稳定性证据；本次 live N=0。

**G-F15 PARTIAL，full-path ≤45s 尚未证明。** 当前结构的 12 秒 projection + 最多 45 秒 POST execution 本身不共享一个 45 秒时钟，还未计入 stop-only cleanup。需要明确验收计时起点并在安全 staging 测全链；本次不更改预算或功能。

## 17. Provider / Data Minimization

保持原定义：`student-ai-teacher@1.0.0`；`explain-pinned-korean-segment@1.0.0`；两项已定义 Tool `get_current_lesson_context@1.0.0` / `get_current_teaching_state@1.0.0`，不新增。产品页面只发 verified_selection，未绑定 teaching session；State 能力不是 UI 视觉 current。

Provider：DeepSeek；model `deepseek-v4-flash`；thinking disabled；server adapter 固定 `https://api.deepseek.com/chat/completions`。生产配置 `DEEPSEEK_API_KEY = SET`；存在配置不代表本 release 已运行新 Agent。未接 Qwen、未改变 model/persona 权限。

[Prompt assembler][prompt] planning 只送 opaque selection refs、revision、locale/sourceLocale 与固定问题，不预先塞入原句和历史；模型选择 Lesson Tool 后才得到权威句子。系统 instructions/Skill procedure 在 server 组装。[Lesson Port][lessonport] 输出受限 lesson/module title、最多 6 个目标、原句与 source/version metadata；排除 nodeConfiguration、answerKeys、privateMetadata、整教材和 adjacent explanation。原始 identity/tenant DB IDs、姓名、其它学生、完整进度不进入模型投影。身份相关哈希/ref 仍是可关联 metadata，不声称匿名化法律结论。

**本阶段 Live Provider Runs 0；External Provider Requests 0；External Tokens 0；费用未发生本阶段 live 调用，不给精确货币估价。** 合成 adapter calls 不计 live。正常/未知 usage 测试详见 §18。

项目已审阅资料没有可据以放行真实学生数据的确定 Provider retention/data residency/组织跨境批准记录；Architecture v1 的条款是建议。**POLICY DECISION REQUIRED**，由责任方确认，不能自行作法律结论。

## 18. Observability / Usage

**可用的 runtime trace 基础已验证；生产运营就绪 PARTIAL。** 数据路径为 [SupabaseAgentRepositories][persistence] → agent_runs / agent_run_events / ai_token_usage；[traceDetailsSchema][trace] 字段白名单拒绝任意正文，记录 digests、refs、版本、阶段、safe code。无通用 prompt/tool result/chain-of-thought dump。

新增隔离 PostgreSQL 验证：真实 Student Runtime、Tools、Core RPC，通过 runId 做仅 metadata 的 SQL 检索。这个 SQL bridge 不用于宣称目标 RLS PASS。

| 合成 Run | Model stages | Model calls | ai_token_usage 行 | unknown usage events | 定位结果 |
|---|---|---:|---:|---:|---|
| completed | planning → final | 2 | 2 | 0 | definition、skill、tool.requested/completed、evidence.checked、output.checked、completed |
| corrective-missing-usage | planning → corrective → final | 3 | 0 | 3 | 三次 ModelCall 分别可关联；unknown 未伪造 0 token usage 行 |
| invalid-output | planning → final | 2 | 2 | 0 | failed；terminal_reason=SKILL_OUTPUT_INVALID；output.checked + run.failure |

三次运行前后 23 教学域表指纹一致。正常 runId 可以连接 agent、profile version、definition manifest/model、Skill、ModelCall IDs、ToolCall IDs、usage、terminal reason；失败也能定位到 output gate。cancel/timeout 等由既有回归覆盖。

可供未来受限 operator 使用的查询形状（只读、参数化、无 messages/教材正文；当前生产没有 Agent 表，**未在生产执行**）：

```sql
-- $1 绑定已授权运维范围内的 runId；operator 仍需遵守 tenant 访问授权。
SELECT r.id, r.status, r.agent_code, r.profile_version, r.skill_ref,
       r.created_at, r.deadline_at, r.ended_at, r.terminal_reason,
       d.manifest->'model' AS model
FROM public.agent_runs r
JOIN public.agent_definition_versions d ON d.id = r.definition_id
WHERE r.id = $1;

SELECT seq, kind, model_call_id, tool_call_id, created_at, metadata
FROM public.agent_run_events WHERE run_id = $1 ORDER BY seq;

SELECT model_call_id, provider, model, usage_status, input_tokens,
       output_tokens, total_tokens, duration_ms
FROM public.ai_token_usage WHERE run_id = $1 ORDER BY created_at;
```

这些列/关系在本次恢复 schema 中存在，等价的 runId aggregate 查询已对三次合成 SQL Run 执行。应通过 model_call_id 将 model.started 的 planning/corrective/final 与 model.usage 关联，不能只数 ai_token_usage（unknown 不在其中补零）。没有正式 pricing version，不伪造美元成本。

限制：生产尚未应用表/定义，没有实际 operator 访问演练、告警接收人或生产 trace 样本。pre-admission/auth/body 拒绝尚未建立 Run，不能按一个不存在的 runId 查询；当前路径也没有完整全站分布式 tracing。正常消息持久化与 runtime metadata 日志是两种数据用途，不能声称 Agent 全部存储无文本。

## 19. Production Build

**G-F19 FAIL。** 在 `/tmp` 私有目录复制本次源码快照、复用现有 node_modules，保持 next.config / tsconfig 不变，使用生产 runtime 配置构建但 flag OFF；未部署，未覆盖线上 `.next`。

正式命令（与 package build 的 Next 子命令一致）：

```text
node node_modules/next/dist/bin/next build --webpack
```

未运行 npm `prebuild` 的全测试入口（其中有其它应用/本地 DB 测试）；本阶段要求的安全回归已逐项显式执行。没有设置 ignoreBuildErrors，没有排除 docs/evidence 来制造绿灯。

结果：compile success 35.8s；TypeScript 阶段 exit 1，首错：

```text
docs/evidence/authoring-preview-consistency-20260913/baseline/
src/features/digital-textbook/workbench/chapter-workbench.tsx:6
Cannot find module './actions' or its corresponding type declarations.
```

额外 `tsc --noEmit --incremental false` 复核：397 errors，全部 `docs/evidence/`，其它 error 0。定向 strict TS 覆盖 Agent Core、Teaching Agent、三 routes 和实际 page import graph：PASS。未顺手修档案快照/397 错误，也没有改 tsconfig。当前 build 不产生可交付的完成 release。

独立 TLS transport **fixture** production build exit 0，只证明该 fixture 可构建；不替代完整应用 build。

## 20. Client Bundle / Secret Boundary

完整应用 build 在类型检查前已输出 323 个 client JS chunks 与 3 个 Agent route server artifacts。对实际输出检查：没有命中 StudentTeachingPolicy、SupabaseStudentTeachingReadRepository、Runtime factory、private prompt procedure、Agent privileged RPC、DEEPSEEK_API_KEY / SUPABASE_SERVICE_ROLE_KEY 等 server implementation 标记。

同时扫描新增 Agent 源码/routes、三 migration、报告及完整已生成 `.next` 输出：实际私密凭证值（仅在内存比较，不输出）和常见 private key / secret key 模式。

- Credential scan：**PASS**。
- Secret pattern scan：**PASS**。
- Compiled client boundary scan：**PASS**。
- G-F20：**PARTIAL**，因为完整应用 build 未完成，尚无可发布 artifact 的最终 hash / browser 验证；标识符未出现也不单独等于形式化泄露证明。

Next 编译成功提供了 server-only import boundary 的额外证据。未把 TypeScript-only `RunAuthority` 的字符串缺失当作充分证明。扫描不打印任何匹配内容或环境变量值。最终报告写入后重复同一 secret scan。

## 21. Security Regression

本次执行清单（所有测试使用各自安全 fixture，无生产写）：

| 测试组 | 结果 |
|---|---|
| Core foundation/database + Stage 1A Domain + 1B Tools/Skills + 1C Runtime/live gate + 1D transport + 1E UI | 269 PASS，1 live SKIP（270 tests） |
| 1D transport isolated database | 1 PASS |
| actual Next HTTP transport | 1 PASS |
| 1E actual Next + Chromium | 1 PASS |
| classroom 四组 | 56 PASS |
| **自动测试总计** | **328 PASS / 1 SKIP / 0 FAIL** |
| targeted strict TS / scoped ESLint | PASS / PASS |
| git diff --check | PASS |
| full TS / full app production build | 397 既存 errors / FAIL，见 §19 |

覆盖 cross-user、cross-tenant、stale/revoked enrollment、invalid selection、cancel、idempotency、replay、Origin、status ownership、completion evidence、output gate、private metadata 和教学零写。G-F22 在上述隔离回归范围 PASS；目标 RLS、生产 proxy 保留独立 BLOCKED/PARTIAL，不混入测试总数。

本次额外 smoke（不混入 328 的自动 test count）：schema clone 三迁移、loopback TLS production-mode fixture、N=2 projection shape、normal/45秒慢 runtime、3 次 runId SQL 查询、production HTTPS GET、bundle/secret scans。它们不是新增生产入口，也没有把假 Provider 标为 live。

## 22. Classroom Regression

sidebar、teaching-video、teaching-blackboard、runtime presentation：56 PASS。1E browser test 在实际 Next / Chromium 通过 A/B pins、键盘/焦点、cancel、failure retry、stale 清理、route cleanup、375px mobile、横屏、reduced motion、真实 dark tokens、Korean locale、partial badge、focus trap，pageErrors=[]。

Feature OFF 的 browser fixture 发起 Agent 请求 0；source 中 OFF loader 在候选查询前退出，既有课堂集成回归通过。ON fixture 的选择解释不写 Script Runtime、video、blackboard、Director、progress/task event；数据库 zero-write 检查与之独立验证。没有旧 learning-agent/respond fallback。

**G-F23 PARTIAL（release 范围）**：局部课堂与 browser regression PASS；没有完整安全 staging 的 ON classroom + Auth/RLS，也没有成功的全应用 production build 用于验证 CSS/tree-shaking 后的 mobile Panel。不能把开发 fixture 截图说成生产构建截图。当前执行 browser 为 Chromium；本次测试基础没有补齐 Safari/Firefox，不新增大型矩阵、不宣称它们通过。

## 23. Feature Rollout Strategy

当前 [transport-config][config] 只有 global server env flag，没有绑定 Student Agent 的 tenant/course/user rollout allowlist。现有 tenant app enrollment 和 curriculum unlock 是业务授权，不是灰度人群选择；不能把已经订阅 Korean app 的所有学生当成 internal pilot。

本阶段仅形成最小 rollout policy，未实现 Feature Service：未来 admission 与 page projection 都必须满足 **global ON ∩ 指定 tenant ∩ 指定 course ∩（首轮指定 internal user）∩ 原有 Student Policy**。allowlist 来源必须是受限服务端配置、默认空集拒绝；不得信任请求携带的 role/organizationId/user。GET/cancel 保持 owner boundary，并与 kill-switch 在途关停策略协调，不能由隐藏 UI 代替 backend admission gate。

| Wave | Entry criteria | Stop conditions | Rollback |
|---|---|---|---|
| 0 Internal/synthetic | 安全 full Supabase staging；唯一 migration identity；真实 Auth/PostgREST/RLS 与最终 HTTPS代理通过；成功应用 build；synthetic 独立解锁内容 | 任一 security/evidence/zero-write/migration 异常，或流无法逐帧 | OFF；停止 admission；保留证据 |
| 1 指定测试账号、单 tenant、单 course | Wave0通过；server allowlist已实现并负向验证；课程实际有pins且解锁可独立证明；operator/rollback演练 | 非allowlist请求被接纳、wrong-owner、未知数据外发、不可定位失败 | OFF；drain；回退已知release，保留Agent数据 |
| 2 小规模真实学生 | 明确用户授权、Provider政策责任方批准、Wave1样本复核和监控值守 | §26 任一停止条件 | 同上，暂停扩大人群 |
| 3 扩大范围 | 前一波稳定样本足以支持决策；逐课程coverage核验 | 权限/内容/性能退化，新增租户未验证 | 收紧allowlist或全局OFF，回到已验证范围 |

当前没有一条真实 course 可以从本报告直接选入 Wave1；这不是要求新增 unlock 支持。本阶段 G-F25 PARTIAL：policy 已明确，enforcement 尚缺；不能用单一 global ON 开放全体学生。

## 24. Kill Switch

global flag 精确仅 `1` / `true` 启用，其它值 fail closed。[handlers][handlers] 在 auth/DB/Provider 前 gate，OFF 的 POST/GET/cancel 均 404；[slots][slots] OFF 不投影 UI。进程内 gate 和 browser OFF regression PASS。

**生产立即性 PARTIAL。** launcher 启动时将 runtime.json 注入 process.env，改配置文件并不会热更新已运行 Node 进程。当前没有跨 worker 动态 kill channel；真正生效依赖受控进程配置生效/替换，且本阶段禁止 restart/reload，所以没有做生产 kill 演练。

未来操作必须验证所有 serving workers 已 OFF，再以安全 GET/route检查及零新admission证明，而不是只改文件。已有 Run 依赖 persistent cancel、next checkpoint、absolute deadline、fenced stop-only cleanup 收敛。进程被杀时 terminal metadata 未必即时落库；禁止把卡住的 running 状态直接改 completed，需检查 lease/deadline/事件。

OFF 后 cancel endpoint 也 OFF，应在有授权且安全的 drain 流程中处理已知 Run，不能依赖用户后续按钮。生产关停流程如何达到“立即拒绝新 admission”仍是 rollout 前阻断；本文没有执行配置修改。

## 25. Rollback Plan

不依赖删除数据库，不触发旧 Agent fallback。

| 阶段 | 策略 |
|---|---|
| A. Production data 产生前 | 保持 OFF；失败 migration 自带 transaction 回滚；已成功 additive migration 默认留存，不为回退应用而 DROP TABLE；检查旧 usage schema兼容、回退已知release |
| B. Controlled pilot data 后 | global OFF并证明生效 → 停止新admission → 按cancel/deadline安全drain → 保留conversation/run/message/usage/events → 回退已知应用release，课堂主体继续工作 |
| DB 操作失败 / partial rollout | 停在最近验证步骤；检查事务/ledger/source checksum；不盲目重跑、不手动标applied、不覆盖不可变审计数据 |
| 数据损坏 | 独立授权的数据恢复事件；本报告的 schema-only snapshot 无法恢复学生数据，不能代替正式备份 |

前置记录：已知良好 release、配置状态、目标 project、migration manifest、恢复点与恢复演练、值守责任人。在数据存在后绝不自动 drop Agent tables/usage columns，避免删除审计或影响原 ai_token_usage；回退新代码后继续保留旧课堂功能。

验收：旧课堂可用、Agent入口消失、新Run为0、已有Run不能再做模型/工具业务工作、数据留存、无新→旧 learning-agent/respond ask fallback。**G-F26 PASS 指策略完整，不代表生产 rollback 已执行/演练通过。**

## 26. Monitoring / Stop Conditions

Wave0/1 在有人值守窗口逐 Run 检查，不用未经数据支持的 p95/成本阈值。当前样本是 smoke，不能为线上编造细粒度错误率。

| 信号 | 停止规则 | 需保留的最小证据 |
|---|---|---|
| wrong user/tenant、越权或教学域写入 | **一次即停止**，OFF，新admission为0 | runId/request metadata、安全错误码、授权证据，禁止复制真实正文 |
| completed 缺 source/evidence/output gate，或任何 bypass | **一次即停止** | run/status、event sequence、source refs、definition digest |
| migration conflict/error、grant扩大、definition不匹配 | 停止发布及下一波，不开flag | migration identity/checksum、schema/grant diff |
| persistent cancel失效、过deadline仍启动新模型/Tool | 停止 pilot | receivedAt/deadline、modelCall/tool IDs、terminal/lease状态 |
| 首个status被整体缓冲、超过12秒投影或45秒执行预算 | 暂停扩大；可重现则关停该pilot路径 | TTFB、frame时间、query count、terminal code；区别cleanup |
| Provider连续失败或 unknown usage集中出现 | 暂停该验证波，查环境/Provider/记录链；不无上限重试 | requests/run、reported/unknown、safe errors、阶段耗时 |
| 无法按runId定位、secret scan FOUND、默认正文日志 | 停止 rollout | 脱敏扫描状态或缺失事件类型，不打印secret |

运营必须记录独立的 timeout/cancel/failure/unknown usage，区分无run的pre-admission拒绝和已admitted失败。还需指定告警接收人/响应人及 Provider 政策负责人；当前没有假设这些职责已配置。G-F27 PASS 仅指停止规则已形成，生产告警执行不在本次完成范围。

## 27. Gate Matrix

| Gate | Status | Evidence | Impact | Required Action |
|---|---|---|---|---|
| G-F1 Target Supabase Environment Identified | PASS | launcher/PM2/config/ref与真实catalog一致，§4–5 | 确认开发DB也是生产，避免错误seed | 保持read-only |
| G-F2 JWT/Auth | BLOCKED | 无安全完整staging | 无目标synthetic登录证据 | 准备synthetic Auth环境并实测 |
| G-F3 PostgREST | BLOCKED | 既有为SQL bridge | URL序列化不等于目标PostgREST | 真实服务集成测试 |
| G-F4 RLS Positive | BLOCKED | 只读policy元数据，§6 | 无目标授权读取PASS | A1正向矩阵 |
| G-F5 RLS Negative | BLOCKED | legacy published-only policy；无真实JWT矩阵 | 不能声称target完整隔离 | 跨学生/tenant/角色/版本负向矩阵 |
| G-F6 Agent Migration Compatibility | FAIL | 202609130001 ledger identity冲突；DDL副本成功 | 无安全直接发布序列 | 独立修复migration identity，禁止改旧ledger |
| G-F7 Agent Migration Staging Apply | PARTIAL | current-schema空库三SQL成功，role membership恢复不完整 | 不能代替full Supabase staging | 完整权限/角色与行为复验 |
| G-F8 Production-like HTTPS Streaming | PARTIAL | 私有TLS逐帧PASS；actual Tailscale只GET | 最终用户入口未证 | 安全实际代理流验证 |
| G-F9 Origin / Host / Scheme | PARTIAL | lab HTTPS200/cross-origin403 | 未确认Tailscale scheme传递 | 最终路径same/cross-origin验证 |
| G-F10 Disconnect / Cancel | PARTIAL | direct/SQL/lab TLS通过 | 真实代理持久cancel未证 | 最终HTTPS→真实Agent infra检查 |
| G-F11 Compression / Buffering | PARTIAL | lab默认compress/gzip请求无压缩逐帧 | 不能外推实际代理 | 最终入口各帧/headers实测 |
| G-F12 Real Course Pin Coverage | FAIL | target lesson被规则拒绝，0/1；131/132无script | 当前无可用真实pilot课时 | 选择现有规则可证明安全且有published script的内容；不放宽策略 |
| G-F13 Pin Projection Performance | PARTIAL | 8-node shape cold/warm与query count；无target RTT | 首屏12秒等待风险未量化 | user-scoped目标smoke |
| G-F14 Current Supported Scope Documented | PASS | §14–17 | 范围明确，未加current/prerequisite支持 | 保持fail closed |
| G-F15 Full Run Under 45s | PARTIAL | normal53ms/slow45016ms；projection另12s | full explain统一45秒未证明 | 明确计时边界、完整staging测量 |
| G-F16 Real Tool / Evidence Invariants | PASS | 实际Tool/guard回归和3个SQL Run | 隔离范围不变量通过 | 目标链复验仍受F2–5约束 |
| G-F17 Teaching Domain Zero Writes | PASS | 23表指纹不变，源码read-only | 本次所有执行测试零教学写 | 每个后续wave重复；任何写入阻断 |
| G-F18 Usage / Trace Completeness | PARTIAL | runId定位3场景、unknown分离 | 无生产operator/告警演练 | 表/定义部署后受限运维复验 |
| G-F19 Production Build | FAIL | 全应用build在既有docs/evidence类型错退出 | 无可发布完成artifact | 单独解决既存build输入阻断并重建 |
| G-F20 Client Bundle Boundary | PARTIAL | 323已编译chunks扫描PASS | build未完成，非release验收 | 成功完整build后复扫并browser验证 |
| G-F21 Secret Scan | PASS | 实际secret内存比较+模式；无值输出 | 受测源码/报告/输出未发现secret | 对最终release重复 |
| G-F22 Security Regression | PASS | 328总测试中的相关隔离套件 | 不替代target RLS | 保留独立目标Gate |
| G-F23 Existing Classroom Regression | PARTIAL | 56+browser PASS，OFF请求0 | production build CSS和staging ON未证 | 成功release上检查课堂/移动端 |
| G-F24 Kill Switch | PARTIAL | 进程内OFF gate PASS；配置不热更新 | 缺生产即时收敛演练 | 所有workers OFF证明及drain |
| G-F25 Controlled Allowlist Strategy | PARTIAL | 最小policy已写；现为global-only | 不可受控单tenant/course/user开放 | server rollout约束实施/验证 |
| G-F26 Rollback Plan | PASS | §25，前/后数据两阶段非破坏性策略 | 计划存在，未生产演练 | 授权发布前演练 |
| G-F27 Monitoring / Stop Conditions | PASS | §26，有证据的停止规则 | 尚需值守及真实告警接线 | 指定责任人，Wave0演练 |

## 28. Architecture Deviations

| Observed Reality | Affected Decision | Proposed Revision | Rollout 前必须解决？ |
|---|---|---|---|
| development与production同Supabase，无安全完整staging | 以开发通过推断目标RLS | 保留独立target integration Gate；准备可销毁完整环境 | 是 |
| Agent 0B version与目标既有ledger冲突 | 三migration可顺序发布的假设 | 形成唯一、可审阅且保留历史的发布identity reconciliation | 是 |
| 当前课时/章锁超出MVP支持且多数无published script | Student UI READY等于真实课程可试点 | 只对有内容且独立可证明授权/解锁的scope声明ready | 是；不扩权限 |
| Pins另12秒、POST45秒、stop-only收尾 | 完整 Explain≤45秒的表述 | 明确计时起点与业务截止/清理边界，目标全链验证 | 是 |
| 只有global env，且启动时注入 | 即时kill与受控灰度 | server受限allowlist及可验证生效/在途drain契约 | 是 |
| 既有docs/evidence进入production类型检查 | 已有397错误不影响发布的假设 | 单独处理构建输入策略；本阶段不改档案或忽略错误 | 是 |
| legacy script RLS为published-only | 将完整StudentPolicy归因于RLS | 明确应用Policy与DB可见性两层各自保证，验证真实叠加效果 | 是 |

这些是观察后的建议，不是已经修改的架构。本阶段新增 Tool/Skill/Agent/长期 memory/Teacher Copilot/verified_current 均为 0。

## 29. Remaining Blockers

发布前必需完成：完整 synthetic Supabase 的 JWT/PostgREST/RLS；migration identity冲突处理与full-role staging复验；成功全应用production build及最终bundle/mobile检查；实际安全Tailscale链上的流/Origin/断连/persistent cancel；有published脚本且满足现有解锁规则的试点scope；目标projection与完整45秒预算验收；server allowlist、跨进程kill/drain演练；operator/告警值守和Provider政策责任方确认；精确Agent definition的受限发布准备。

没有使用真实学生绕开测试环境；没有借服务端adminclient直接给学生补全上下文；没有把 `prerequisite_passed` / `prerequisite_completed` / `previous_completed` 变成支持状态。当前不是“只差开flag”。

## 30. Deployment Plan

**未来 sequence，仅文档，未执行：**

1. 当前保持 NO-GO / OFF；先分别关闭 §29 blockers，并得到一条明确的生产变更授权。
2. 锁定成功完整 build 的代码/配置/依赖 manifest；核对staging与production角色、schema、policy、proxy差异，准备已验证恢复点。
3. 按 §9 在 OFF 下应用已解决identity冲突的迁移，逐份验证，不将本地目录一键推送生产。
4. 受限发布精确 tenant Agent definition；校验runtime artifacts与source一致，无自动模型切换。
5. 部署已通过的应用 artifact，flag仍OFF；检查所有 serving workers、新route OFF响应、旧课堂正常、无Agent新写。
6. 在不触达真实学生的受控范围执行实际HTTPS、Auth/RLS、usage与取消 smoke；验证数据写入只限Agent Infrastructure。若该步骤需要生产synthetic短时开启，必须另行明确授权及隔离保证，不能从本文推导许可。
7. 验证server allowlist与kill/drain/rollback后，单独授权Wave1；逐步进入Wave2/3，不自动扩容人群。
8. 任一 stop condition 触发 §25；保留审计数据，禁止dual-run fallback。

本次未 git push、未 copy release、未 PM2 reload/restart、未改 Tailscale、未 production migration、未 enable flag。

## 31. Final Recommendation

**NO-GO。不能进入受控生产灰度。** 既存 UI/Runtime 的开发验证保持有效，但目标授权链、发布identity、构建、真实可用内容和最终代理均有实质缺口。

- Target Supabase: PARTIAL（identified PASS；NO SAFE STAGING ENVIRONMENT）。JWT/Auth、真实PostgREST、RLS正/负向：BLOCKED。
- Migration Compatibility: FAIL（version identity冲突）；current-schema副本三SQL应用成功但托管角色复刻PARTIAL；Production Migration: NOT APPLIED。
- Production-like Proxy: PARTIAL（direct及私有TLS smoke通过，实际Tailscale NDJSON未测）。
- Real Course Coverage: 当前策略推断可支持课时0/1；10个内容候选locale pins不能越过unlock策略。
- Runtime Performance: PARTIAL；未证明包含projection的完整≤45秒。
- Teaching Domain Writes: 0（本次执行测试/运维操作范围）；生产教学/Agent写入0。
- Production Build: FAIL（397个既存docs/evidence TS errors）；Client Bundle Security: compiled扫描PASS，完整release验收PARTIAL。
- Kill Switch / Pilot Strategy: PARTIAL；Rollback与Stop Conditions计划已形成，生产演练未做。
- Live Provider Runs / Requests / Tokens: 0 / 0 / 0。
- Tests: 328 PASS / 1 SKIP；定向strict TS、lint、diff检查通过。

工作区最终保护检查：**2,592 个基线文件 SHA-256 一致；既有文件变化 0；`git diff --check` PASS**。只新增本报告，原有业务工作未覆盖。生产仍OFF，无部署。结束于Stage1F验证阶段。

证据索引（临时本地文件，不含可公开复制的凭证；核心结果已在正文摘录，`/tmp` 不作为长期保留保证）：

| Evidence | 用途 |
|---|---|
| `/tmp/uply-stage1f-baseline.json` | 本阶段前文件哈希 |
| `/tmp/uply-stage1f-readonly/meta.json` / `catalog.json` | 当前目标catalog/policy/ledger安全元数据 |
| `/tmp/uply-stage1f-schema-result.json` / `schema-verify.json` | schema恢复、三SQL与grant验证；必须连同角色差异阅读 |
| `/tmp/uply-stage1f-coverage-result.json` | 课程聚合，无教材正文/学生记录 |
| `/tmp/uply-stage1f-performance-result.json` | projection shape、normal/slow runtime |
| `/tmp/uply-stage1f-proxy-result.json` | 明确非Tailscale的私有TLS smoke |
| `/tmp/uply-stage1f-observe-result.json` | 三场景runId定位与23表零写 |
| `/tmp/uply-stage1f-build-result.json` / `build.log` / `full-types.log` | 正式应用构建及397既存错误 |
| `/tmp/uply-stage1f-scan-result.json` | Secret/boundary状态，不含secret匹配正文 |
| `/tmp/uply-stage1f-regression.log` / `classroom.log` / `next.log` / `browser.log` / `transport-db.log` | 本次重跑结果 |

[report]: </home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-production-readiness.md>
[production]: </home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/production.ts>
[auth]: </home/yangzhen/projects/my-lms-system/src/lib/auth.ts>
[repository]: </home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/repositories/supabase-student-teaching-repository.ts>
[m0]: </home/yangzhen/projects/my-lms-system/supabase/migrations/202609130001_agent_core_foundation.sql>
[m1]: </home/yangzhen/projects/my-lms-system/supabase/migrations/202609140001_agent_runtime_completion_evidence.sql>
[m2]: </home/yangzhen/projects/my-lms-system/supabase/migrations/202609140002_agent_run_cancel_request.sql>
[handlers]: </home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/student-handlers.ts>
[config]: </home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/transport-config.ts>
[slots]: </home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/page-projection/lesson-slots.tsx>
[page]: </home/yangzhen/projects/my-lms-system/src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page-content.tsx>
[access]: </home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/policies/access-rules.ts>
[runtime]: </home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/runtime/create-student-ai-teacher-runtime.ts>
[definition]: </home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/runtime/student-runtime-definition.ts>
[prompt]: </home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/runtime/student-prompt-assembler.ts>
[lessonport]: </home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/domain-ports/current-lesson-read-port.ts>
[store]: </home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/run-store.ts>
[persistence]: </home/yangzhen/projects/my-lms-system/src/features/agent-core/persistence/supabase/repositories.ts>
[trace]: </home/yangzhen/projects/my-lms-system/src/features/agent-core/observability/trace.ts>
