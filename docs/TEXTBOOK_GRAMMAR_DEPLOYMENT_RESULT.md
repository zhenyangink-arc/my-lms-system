# 教材语法一致性修复：正式部署结果

完成时间：2026-09-13 04:30 UTC（韩国时间 13:30）。本轮用户明确授权：定向处理两条循环事务、备份/还原核验、最小错误码修复，以及原两份语法迁移和候选部署。

## 1. 实际结果

- UPLY 已恢复原 Tailscale HTTPS 8443 入口，PM2 `uply-first-enable` 运行新生产构建 `5Fa4thXL2m4EcFA5-Qx5R`。
- 三份 migration 与 ledger 在同一 PostgreSQL 事务中提交成功。没有顺带部署其他 migration。
- 本轮没有打开新的 gate、扩大 cohort、安装密钥、发布教材、修改教学文字、创建章节练习绑定或重置学生数据。
- 主开发目录业务代码和原有未提交工作保留。部署只向 release source 应用了本次确认的 31 个文件和新构建；旧源码文件及旧构建保留。
- 其他 PM2 服务及其他 Tailscale 入口未改动。

入口：`https://kmgwak-system-product-name.taila18cd5.ts.net:8443/platform/dashboard/admin/apps/korean/textbooks`。

## 2. 停写阻断的根因与修复

生产 `runtime_publish_private.check_authoring_statement()` 将永久性业务拒绝 `PUBLISHED_DEPENDENCY_IMMUTABLE_USE_EDIT_WINDOW` 标为 SQLSTATE `40001`。PostgREST 14.5 因此循环重试既有请求。新的数据库事务时间不等于有其他用户持续发出新的 HTTP 请求；前轮关于外部任务的推断已纠正。

03:20 UTC 重新匹配 PID、backend_start、数据库角色和完整查询 SHA 后，只向两个确认的 backend 发出终止信号。随后连续三次检查 Runtime/Recording 请求及其他活动请求均为 0，没有清理请求表。

独立修复 migration 只将此业务错误码改为 `PT409`，原函数其余正文、fence 判断、锁序、SECURITY DEFINER、search_path 和 ACL 不变。原始 HTTP 请求发起者仍未确认，本次无需假定其身份来处置已确认的重试机制。

实际隔离 PostgREST 14.5 验证：删除发布依赖返回一次 HTTP 409，body.code 为 PT409；版本行数不变，没有循环 DELETE 事务；合法编辑窗口仍可使用。生产上线后只读观测没有再发现这些循环 DELETE 或 advisory lock 等待。

参考：[Supabase 官方说明](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b)。没有升级托管 PostgREST、放宽 fence、撤销权限或放行删除来规避问题。

## 3. 备份与真实还原

位置：`/home/yangzhen/backups/uply-first-enable-20260910/grammar-2026-09-13T02-56-47-448Z.yjN7w6/`。

- 备份快照时间：2026-09-13T03:22:45.723Z；database.dump 大小 5,746,105 bytes。
- SHA256：`843a2b7e74708f2992265a963618cf69b9c4acc491ecc328ccbb4362c54a7b8a`。
- 目录 700，备份与私有诊断文件 600；包含逻辑结构/数据、角色与权限补充、函数、约束、RLS、触发器、迁移记录、依赖目录及恢复脚本。
- 在 PostgreSQL 17.6.1.159 无外部网络的独立临时库中实际还原，22 项核验全部通过：230 张表、21,290 行、677 个函数、1,697 个约束等。
- 还原中修正了隔离容器输入传递方式，并补齐 pg_dump 省略的 16 项显式 owner 默认 ACL 表示。补充只在隔离库执行，严格恢复原权限；没有放宽比较标准或生产权限。
- 03:48 UTC 将所有 230 张表的当前内容摘要与还原库比较，全部一致。只排除了隔离库新执行的三条 migration ledger 记录和新列的空默认表示；封存备份 SHA 校验通过后才执行生产迁移。
- 原始 dump 保留不变；`PRE_MIGRATION_BACKUP_SHA256.json`、`FINAL_BACKUP_FILES_SHA256.json` 保存摘要，`FINAL_VERIFICATION.json` 保存实际核验结果。

数据库备份**不是媒体文件备份**：没有下载/复制 R2 或 Supabase Storage 对象；角色密码、外部运行凭据及托管平台控制面配置不由此备份恢复。保留恢复脚本与权限补充材料，恢复必须进入另行确认的独立目标，不可对远端盲目覆盖。

临时私有连接容器和含还原数据的无网络临时数据库容器均已清理；原始备份、旧备份、教材和媒体未删除。

## 4. 精确迁移清单

执行顺序为错误码修复优先，其后两份原批准语法 migration；三份整体原子提交，ledger 保存精确 SQL 源码。

| 文件 | SHA256 |
| --- | --- |
| `202609130003_runtime_authoring_nonretryable_error.sql` | `0c5a16609d3c7196284f86cecb96f250988d2ff78834a92d8e0cce5966edd73d` |
| `202609130001_textbook_grammar_authoring.sql` | `a60e244ae46099ded2547d323f0311e20a5d4c87b85c0f3b8e8d52d674e6be5a` |
| `202609130002_textbook_grammar_practice_binding.sql` | `cacb86eacfd3777492be47c6941456b43460d870c88c9269b735a863c82b2ed8` |

迁移前验证现有 14 个函数正文及签名、对象不存在条件、ledger、请求排空；迁移使用有限 lock/statement timeout 和发布互斥锁。迁移后确认三条 ledger SHA、空身份默认、错误码及 ACL；教材节点、attempt、教学脚本版本数量未变。

迁移没有把 pending 媒体改 ready，没有编辑任何 grammarCards 正文或 script v23，没有修改旧答案/作答。

## 5. 部署内容与用户可验收范围

原语法修复范围详见 `TEXTBOOK_GRAMMAR_CONSISTENCY_IMPLEMENTATION.md`：

- 教材管理读取并统计实际 `nodes.content.grammarCards`，不再只把旧 `grammar` 数组计入数量；隔离真实内容测试覆盖全教材 63 张卡、第一章 3 张卡、第一章 8 Step。
- 第一章通过负责人工作台编辑 form/function/caution/source 四类字段，保留现有规则、例句、音频和稳定身份，遵守编辑窗口/CAS/重新校验发布流程。
- 章节练习引用兼容当前语法卡，使用完整受校验快照、锁和 platform_owner 权限；本轮没有自动创建任何引用。
- 没有扩展其他 15 章编辑功能，也没有改造学生 Renderer。

真实配置构建直接调用 Next CLI `build --webpack`，没有使用 npm prebuild，不在真实凭据环境运行测试，不使用隔离占位 URL/key 构建。

持久候选：`/home/yangzhen/releases/uply-first-enable-20260910/grammar-consistency-2026-09-13T02-56-47-448Z.GO1GuS/`。

31 文件清单摘要：`b7c2735202d74fe8dabf3c9be0efc3e2a668dbf21e3b600aa63aae9249299bfd`。这不是整个目录所有文件的 Merkle 摘要；具体文件 SHA 在 `operations.json`。

补丁关系：原 `docs/TEXTBOOK_GRAMMAR_CONSISTENCY.patch` 不变；新增 `docs/TEXTBOOK_GRAMMAR_RETRY_FIX.patch` 只追加错误码 migration 与测试。二者均以 release 的已说明基线审查，不直接覆盖主开发目录差异。

## 6. 测试与实际访问

| 验收 | 结果 |
| --- | --- |
| 最终完整回归 | 1221 项：1217 通过，0 失败，4 个原有可选 PGlite 测试跳过 |
| TypeScript | 通过 |
| 新增错误码测试 | 2 项通过，包含真实 PostgreSQL / PostgREST 14.5 |
| 实际备份还原 | 22 项全部通过 |
| 当前真实 schema 上的隔离 migration 演练 | 三份原子提交、ledger 与数据/ACL 检查通过 |
| 真实配置生产构建 | 通过；Build ID `5Fa4thXL2m4EcFA5-Qx5R` |
| 本地首页、教材页、工作台 | 无 5xx；管理页匿名请求仍进入登录保护 |
| 真实 HTTPS 8443 | 首页 200，教材页匿名访问保持登录保护 |
| 旧首次启用发布工具 | 保持关闭，明确返回 RELEASE_TOOL_DISABLED / 404；不是故障，也不是负责人鉴权通过 |
| 正常 platform_owner 浏览器查看/编辑 | **本轮未执行，需要用户验收** |
| 真实学生新作答/录音 | **本轮未执行** |

没有将“构建成功、服务启动、匿名页可访问”称作完整负责人或学生 E2E。

## 7. 保留与恢复边界

- 旧构建：`/home/yangzhen/releases/uply-first-enable-20260910/source/.next-before-grammar-1789271693244`。
- 原 31 文件中已有文件的备份：候选目录下 `previous-source-files/`。
- 数据库迁移 forward-only；不 DROP 回滚，不删除 ledger，不自动复活旧会话。
- 后续如果通过新编辑器产生了身份 override 并重新发布，不能盲目回退不识别该字段的旧应用。
- 没有执行 Git commit/push；当前主工作区原有未提交修改保留。

关键证据均在 `docs/evidence/textbook-grammar-consistency-20260913/`：`deployment-result.json`、`migrate-result.json`、`isolated-migrate-result.json`、`backup-freshness.json`、`final-regression.json`、`final-typecheck.json`。

```text
production migrations executed = 3 (exact allowlist)
production deployment completed = true
maintenance = false
owner browser E2E = not performed
student test scope expanded = false
teaching content edited = false
student data reset = false
media objects modified = false
other services modified = false
```
