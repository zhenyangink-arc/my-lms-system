# 教材语法一致性修复：部署暂停记录

> **最新状态：2026-09-13 04:30 UTC 已完成修复与部署，维护已解除。** 以下暂停记录保留用于追溯，不代表当前仍停服。最终结果见 `TEXTBOOK_GRAMMAR_DEPLOYMENT_RESULT.md` 和 `docs/evidence/textbook-grammar-consistency-20260913/deployment-result.json`。

记录时间：2026-09-13。状态依据：2026-09-13T03:04:48.958Z 停止核验，不代表之后外部请求的持续状态。

## 最新结论：已定位错误码导致的事务重试（03:18 UTC 更新）

此前把持续出现的新数据库事务推断成“其他程序持续发送新删除请求”证据不足，现予以纠正：新的 `xact_start/query_start` 不能证明新的 HTTP 请求。

已核实的链路为：

`PostgREST 14.5 DELETE → runtime_publish_fence → check_authoring_statement() → PUBLISHED_DEPENDENCY_IMMUTABLE_USE_EDIT_WINDOW / SQLSTATE 40001 → 事务失败 → PostgREST 重试`

- 生产函数正文与 release migration `202609100004_runtime_single_version_authoring.sql` 一致；第 60 行把永久性的发布保护拒绝声明为 `40001`。
- 03:13:06–03:18:01 UTC 的日志将该错误精确关联到观察中的两个 PostgREST backend：PID 2139928 报错 1801 次，PID 2139754 报错 1800 次。进程编号仅用于本次证据关联，后续操作不得只凭历史 PID。
- [Supabase 官方故障说明](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b) 明确说明：PostgREST 14 会对自定义 `40001` 错误反复重试，一个 API 请求可拆成多次 PostgreSQL 事务。建议使用非重试业务错误，例如 `PT409`，并单独处理已经陷入循环的 backend。
- 当前近一小时日志没有 API Gateway 来源记录可供归因，因此原始 HTTP 请求的发起者和发起时间仍未确认；不得推断是用户另开了任务。
- 主机只读核查未定位到对应脚本；目标数据库未安装 `pg_cron`。这不能排除其他所有来源。
- 03:12 和 03:18 的版本数量均为 draft 8、archived 1、published 1。持续错误与数量稳定符合回滚重试，不能把累计 tuple delete 统计当成已提交删除数量，也不能据此保证所有历史数据完全未变。

本轮仍只读，没有修函数、终止会话或执行迁移。下一步需要额外明确授权：先针对实时身份、错误及查询指纹均匹配的循环 backend 做受控终止；排空后备份并实际还原核验；随后实施经隔离测试的独立最小错误码修复 migration。保留发布保护逻辑、锁、权限和教材数据，不以打开编辑窗口、撤销 fence 或放行删除来解锁。

新增修复不在原两份语法 migration 清单中，不擅自加入执行。需审查调用端对错误码的映射，验证拒绝仍生效但不再自动重试，再恢复原部署流程。

证据：`writer-retry-correlation.json`、`writer-recheck-1789269034251.json`、`writer-recheck-1789269150512.json`、`writer-recheck-1789269488735.json`，均位于 `docs/evidence/textbook-grammar-consistency-20260913/`。

## 原始暂停记录

已在用户批准范围内完成部署前复核、候选持久保存和 UPLY 维护停服。停服后仍观察到外部 PostgREST 对 `public.learning_agent_script_versions` 的 DELETE 请求，停写条件未成立，因此停止在新备份之前。

这些请求不是本轮部署发出的；来源尚未确认。观察到 DELETE 请求不等于已确认删除成功或确认删除了哪些记录。未导出查询正文、记录内容或账号信息，未擅自终止数据库会话。

## 已完成与当前入口

- 候选 29 个文件摘要、增量 patch 及关键远端函数定义复核通过；两份目标 migration 尚未执行。
- 持久候选目录：`/home/yangzhen/releases/uply-first-enable-20260910/grammar-consistency-2026-09-13T02-56-47-448Z.GO1GuS/candidate/`。
- 增量 patch：`docs/TEXTBOOK_GRAMMAR_CONSISTENCY.patch`，基线为已运行的 release source，不可直接当作主开发目录补丁叠加。
- Tailscale HTTPS 8443 已关闭，`uply-first-enable` 已停止，端口 3000 未监听。因此当前 UPLY 入口处于维护不可用状态。
- 其他 PM2 服务和其他代理入口未变化。
- Runtime 与 Recording 已登记请求的未完成计数均为 0；但不能以此忽略仍在数据库执行的外部请求。
- 本轮临时凭据客户端容器已清理。它不承载数据库或媒体数据。

## 尚未执行

| 项目 | 状态 |
| --- | --- |
| 新逻辑备份及实际隔离还原 | 未执行 |
| `202609130001_textbook_grammar_authoring.sql` | 未执行 |
| `202609130002_textbook_grammar_practice_binding.sql` | 未执行 |
| 真实配置生产构建 | 未执行 |
| 候选部署及服务恢复 | 未执行 |
| 负责人页面验收 | 未执行 |

已准备的备份目录 `/home/yangzhen/backups/uply-first-enable-20260910/grammar-2026-09-13T02-56-47-448Z.yjN7w6/` 只有准备材料和受限诊断记录，没有新数据库备份，不是本轮恢复点。

本轮没有业务 patch 回写运行源码或主开发目录，没有清空或重置学生数据，没有执行 migration，没有上传或删除媒体对象。

## 原暂停时的继续条件（以上述最新诊断为准）

1. 确认并停止仍在修改教学脚本版本的其他任务或程序；不得根据数据库角色或进程名称猜测来源，不自动停止无关服务。
2. 重新只读核验真实写入者、请求排空、schema/ledger 和候选摘要。
3. 停写成立后创建新备份并完成实际隔离还原核验，再继续原批准的精确迁移和部署顺序。

不能盲目重跑当前操作脚本：维护已经生效，UPLY 已停止，临时连接容器已移除。若需要提前恢复访问，应先明确恢复操作并核对当前状态，不把维护解除写成部署成功。

## 证据

- `docs/evidence/textbook-grammar-consistency-20260913/deployment-stop.json`
- `docs/evidence/textbook-grammar-consistency-20260913/deployment-database-preflight.json`
- `docs/evidence/textbook-grammar-consistency-20260913/patch-manifest.json`
- `docs/TEXTBOOK_GRAMMAR_DEPLOYMENT_PREFLIGHT.md`

生产 migration executed = false；候选 deployed = false；学生数据 reset = false。
