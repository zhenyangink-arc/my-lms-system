# 教材语法修复：部署前只读核验

日期：2026-09-13。承接 `TEXTBOOK_GRAMMAR_CONSISTENCY_IMPLEMENTATION.md`。本轮授权解释为“先核验，不直接上线”；没有执行 migration、安装配置、停写、重启、发布教材或应用业务补丁。

## 1. 当前结论

| 项目 | 结果 |
| --- | --- |
| 补丁及候选源码 SHA | 29 项通过，与上轮交付一致 |
| 运行源码是否仍匹配补丁基线 | 是；`git apply --check --whitespace=error-all` 通过，仅 check |
| 主工作区未提交工作 | 保留；10 个候选涉及文件的 M/R 差异仍存在，不能盲目向 M 应用 |
| 目标数据库与 TLS | 与既有运行配置匹配；libpq `verify-full`，实际客户端 TLSv1.3 |
| 关键现有函数体 | 14 个与仓库对应版本一致；签名、search_path、SECURITY DEFINER、角色执行权限已记录 |
| 两份候选迁移的依赖/命名 | 依赖已存在；未发现目标新列、函数、迁移版本号碰撞 |
| 旧备份完整性 | 两份封存备份 SHA、大小、受限权限核对通过；可复用以前实际还原通过的证据 |
| 最新迁移前恢复点 | **未具备**：旧备份早于后续数据库部署，不能代替新的恢复点 |
| 是否可现在自动部署 | **否**：仍需维护/新备份/迁移/部署的明确授权及执行核验 |

本轮没有业务代码变化，复用上轮 1215 pass / 0 fail / 4 skip、TypeScript 和隔离构建证据，不重复整套开发回归。四个跳过项仍未声称通过。

## 2. 源码与服务

- 运行源码 R：`/home/yangzhen/releases/uply-first-enable-20260910/source`。
- 隔离候选 C：`/tmp/uply-grammar-consistency.CRGmOO`。
- 持久补丁：`/home/yangzhen/projects/my-lms-system/docs/TEXTBOOK_GRAMMAR_CONSISTENCY.patch`。
- 补丁 SHA256：`d585e004d51e7d121f4ffb3bcb1ad107300de402db2e0453a100c7f469b43057`。
- R Build ID：`l9HmPxSMluZWoirjL544P`；主 HEAD 仍为 `b1672390ae96357a2143358235cc10edeff8d488`，并不等于 R 的完整内容。
- PM2 `uply-first-enable` 状态 online，启动脚本 `/home/yangzhen/.config/uply-first-enable-20260910/start.mjs`；启动脚本包含 R 路径并使用生产 start，`uply-dev` 未 online。
- PM2 元数据 cwd 仍显示主项目，不能因此把热运行源码误认为 M。当前命令环境 `/proc` 无法看到 PM2 返回的宿主 PID，因此没有将其描述为逐进程 cwd/端口归属完全核验；实际执行部署前仍需重新检查宿主子进程与 drain 状态。
- 未操作另外 10 个 PM2 服务。没有调整 443/4000 或其他入口。

Tailscale 只读配置确认：HTTPS 8443 → `http://127.0.0.1:3000`。本地首页与 HTTPS 首页返回 200。未认证访问教材页/工作台的流式响应为 HTTP 200，但正文包含 `NEXT_REDIRECT` 和登录目标，**不是通过负责人鉴权**；没有将 200 当作 owner E2E 成功。

## 3. 真实数据库核验

使用既有受限 pg_service/pgpass/CA，经 PostgreSQL 17.6 工具容器连接已核对项目；没有打印密码、复制用户登录凭据或读取学生内容。

查询使用显式 `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`、20 秒 statement timeout。客户端确认 `SSL connection (TLSv1.3)`，事务 `readOnly=on`。仅 catalog、function definition、权限及匿名聚合 SELECT；没有调用内容编辑、发布、会话或录音 RPC。

原始函数体在进程内与仓库 SQL 对比；证据只保存定义/函数体摘要、签名、权限与比较结果，不保存原始业务行、答案或秘密配置。

### 3.1 函数

以下 14 项函数体与 R 对应 migration 一致（仅 trim 首尾空白）：

- `private.is_platform_owner`
- `public.assert_runtime_dependency_fence_v1`
- `public.begin_runtime_textbook_edit_v1`
- `public.edit_runtime_chapter_activity_v1`
- `public.publish_runtime_snapshot_v2`
- `public.read_chapter_practice_snapshots`
- `public.review_chapter_practice_binding`
- `runtime_publish_private.authoring_lock`
- `runtime_publish_private.capture`
- `runtime_publish_private.capture_rows`（追溯原 capture rename）
- `runtime_publish_private.check_authoring_statement`
- `runtime_publish_private.lock_authoring_statement`
- `runtime_publish_private.owner_guard`
- `runtime_publish_private.semantic_capture`

公开发布/编辑 RPC 仍 service_role-only；review/read 仍 authenticated 可执行、anon 不可执行。private 内部 capture/lock/helper 无直接客户端 EXECUTE。既有 review 仍按共享标准内容管理权限检查，这正是候选第二份迁移要收紧为 owner-only 的部分，不是本轮已经部署完成。

### 3.2 表、RLS、触发器与 ledger

- `digital_textbook_nodes.id/module_id` 为 UUID，`content` 为非空 JSONB；新 `authoring_grammar_identities` 列不存在。
- `chapter_practice_bindings` 的 version、snapshot、revision、reviewed_by 等字段、唯一约束及 RLS 存在，结构支持候选 RPC；当前 binding 数量 0，不代表获授权自动创建。
- nodes 的 `runtime_publish_lock`、`runtime_publish_fence`、`digital_textbook_nodes_set_updated_at` 均启用。
- nodes 虽有 authenticated 表级写 grant，但只存在 SELECT RLS policy，没有 DML policy；不能把表级 grant 误称为机构成员已获直接写权限。binding 无 authenticated INSERT/UPDATE grant。
- ledger 包含 chapter practice 的 `202609080001/2`、Runtime foundation/fence/admission/single-version/兼容发布的 `202609100001–5`，以及 `202609110001/2`；已核对的 wrapper 函数与后者一致。
- `202609130001/2` 均不在 ledger；新编辑函数、新卡片校验 helper 均不存在。没有自动修复 ledger。

匿名聚合：132 个教材节点、韩语教材 63 张语法卡、0 个章节练习绑定、1 个 published pointer；authoring_control 为 open，核验时未完成 Runtime request 数量 0。**这是瞬时只读观测，不是停写/排空证明**，未来维护窗口必须重新检查。

本次检查聚焦两份迁移依赖，不是重新证明整个生产 schema 所有对象均与仓库一致；未发现本次范围的 blocking drift。

## 4. 两份迁移的精确范围

| 顺序 | 文件 | SHA256 |
| --- | --- | --- |
| 1 | `202609130001_textbook_grammar_authoring.sql` | `a60e244ae46099ded2547d323f0311e20a5d4c87b85c0f3b8e8d52d674e6be5a` |
| 2 | `202609130002_textbook_grammar_practice_binding.sql` | `cacb86eacfd3777492be47c6941456b43460d870c88c9269b735a863c82b2ed8` |

第一份增加空默认身份 override 列、闭合编辑 RPC，并调整 capture 对“空 override”的等价处理；非空仍受 fence 保护。第二份更新现有章节引用 RPC 的当前卡片支持、锁序及 owner 检查。

均使用事务；没有新 extension、内容 seed、对象操作、历史 learner 数据重置。第一份 ALTER TABLE 仍需要表锁，不能因现有仅 132 节点就承诺无等待；应在维护排空后使用有限 lock timeout，失败即停。现有 `updated_at` trigger 保持，不禁用 fence。

已有隔离测试覆盖旧快照在加空列后仍可读取、保存与 override 原子更新、发布 fence、并发 CAS 及引用 SQL。**本轮没有在远端执行 DDL dry-run/rollback 演练**，因为 BEGIN 后再 ROLLBACK 仍不属于 SELECT-only。

## 5. 备份与恢复点

本轮仅读取、校验原封存文件，不下载媒体、不创建新备份、不恢复任何数据库：

| 封存位置 | 备份快照时间（UTC） | 本轮检查 | 既有实际还原证据 |
| --- | --- | --- | --- |
| `/home/yangzhen/backups/uply-first-enable-20260910/20260910T1353Z.LlXXsY/` | 2026-09-10 14:06:47 | 75 项大小/SHA/权限一致 | 22 项核验通过 |
| `/home/yangzhen/backups/uply-first-enable-20260910/pre-migration-20260910.Bvr8gH/` | 2026-09-10 14:52:46 | 54 项大小/SHA/权限一致 | 22 项核验通过 |

目录 700、已检查文件 600；两份 database.dump 均为 4,911,185 bytes，摘要见 backup preflight 证据。它们覆盖当时 pg_dump/权限补充范围，并通过当时无网络隔离库实际还原；本轮不是重新执行还原。

旧备份早于后续首次启用 migration 和正式测试，因此不适合作为当前原样恢复点。未来获批停写后，需要新建时间戳目录创建当前备份并验证恢复；不覆盖旧备份。不备份 R2/Storage 对象字节，数据库备份不等于媒体备份。托管平台配置、密码/外部密钥的排除项沿用封存报告，不能声称全项目一键灾备。

## 6. 等待授权后的执行顺序（本轮未执行）

1. 再次核对补丁/R 源码、配置、真实宿主进程与目标数据库；任何漂移先停止，不扩大迁移清单。
2. 只对 UPLY 进入获批维护停写，确认真实请求排空；不清理历史请求，不动其他服务。
3. 新建当前迁移前受限备份，验证恢复点；保留既有所有数据和旧备份。
4. 仅按以上顺序执行 SHA 校验通过的两份 migration，事务与 ledger 记录一致；核对实际已提交前缀。禁止通用 `db push` 带入其他 migration。
5. 从候选代码准备真实配置生产构建；不使用隔离占位构建、不向测试进程注入真实凭据、不触发带真实配置的 npm prebuild 测试。
6. 只部署 UPLY，保持现有测试开放范围，不扩 gate/cohort。应用不能提前上线调用不存在的 grammar RPC。
7. 正常 platform_owner 浏览器核验数量/查看内容。涉及真实文字修改、再发布和学生验证，先明确具体文本与现有测试账号范围；不为验收任意改写教学内容、不创建 binding、不复制登录 Cookie。

失败停止：在迁移未完成前保持维护，不重跑未核对的前缀；没有新编辑写入时也须核实空 override/旧快照兼容后才能考虑原应用恢复。**一旦发生新文字/身份绑定发布，不可盲目回退不识别 override 的旧应用**；保留数据，评估应用前滚修复或受控重新发布。禁止 DROP 回滚、清空记录或自动复活旧会话。

## 7. 交付与状态

证据目录：`/home/yangzhen/projects/my-lms-system/docs/evidence/textbook-grammar-consistency-20260913/`。

- `deployment-local-preflight.json`：补丁、配置目标/权限、PM2 元数据。
- `deployment-database-preflight.json`：只读 catalog、函数对比、权限、ledger、聚合；不含原始函数体或学生行。
- `deployment-backup-preflight.json`：文件 SHA、大小、权限、既有还原证据与时效结论。
- `deployment-entry-preflight.json`：8443 路由、公开 HTTP 检查及匿名登录跳转特征。

```text
codeBaselineReady = true
databaseDependencyPreflightPassed = true
freshRestorePointReady = false
deploymentReady = false
production migration executed this turn = false
production deployment executed this turn = false
owner browser E2E this turn = not performed
data deleted/reset = false
```

需要用户下一次明确批准的实际操作：**UPLY 维护窗口 + 新迁移前备份/还原核验 + 指定两份迁移 + 候选真实构建与部署**。本轮到此停止，不自动进入执行。
