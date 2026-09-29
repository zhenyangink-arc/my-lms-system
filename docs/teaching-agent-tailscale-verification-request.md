# UPLY Teaching Agent — Tailscale Operational Approval Request

状态：**APPROVED FOR TEMPORARY TRANSPORT PROBE ONLY；Actual Tailscale Verification PARTIAL**。R4B 已于 2026-09-15 完成获批测试并清理：实际 Streaming、Origin / Host / Scheme、Disconnect 均 PASS；Compression / Buffering 为 PARTIAL（未压缩逐帧传输 PASS，gzip NOT NEGOTIATED，压缩路径未验证）。Infrastructure Approver、Release Operator、Execution Operator 及 Cleanup Owner 均为杨震；见证人为 N/A — self-managed infrastructure。

首尔时间：任务窗口从 14:07:53 起、最长至 14:37:53；实际 probe 验证为 14:12:49–14:13:04，临时 binding 为 14:12:56–14:13:04。新增至撤销确认的单调时钟间隔 7.478 秒。9443 已撤销，43183 已停止，既有 443/4000/8443 及完整 Serve 配置与 before 一致。详见 [R4B 实测报告](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r4b-tailscale-transport-verification.md)。Stage 1G 仍 NOT READY。

该批准仅覆盖杨震自管 tailnet 上临时 HTTPS 9443 → http://127.0.0.1:43183 的 synthetic transport probe。杨震本人注册、创建并管理该 tailnet，将当前服务器加入其中，并决定本节点的 `tailscale serve` 配置；不存在要求额外审批的学校、公司、实验室、其他管理员或基础设施负责人。

当前服务器：**self-managed by 杨震**。当前 OS account：`yangzhen`；项目路径为 `/home/yangzhen/projects/my-lms-system`。本批准不授权生产 Agent、Supabase、Provider、现有 443/4000/8443 binding、PM2、production migration、deploy、Feature Enable 或 allowlist 写入。Backup 与 Data / Policy Approver 不因基础设施自管而自动指定。

## 1. 已批准并执行的精确范围

| 项目 | 请求 |
|---|---|
| 临时 binding | 同一 Tailscale 节点新增 HTTPS 9443 → http://127.0.0.1:43183 |
| 地址 | https://kmgwak-system-product-name.taila18cd5.ts.net:9443 |
| Probe 路径 | /__uply_transport_probe/stream、/origin、/disconnect，仅临时独立 Next 进程 |
| 时间 | 获批窗口最多 30 分钟，binding 目标 ≤10 分钟；本次实际时间见顶部及批准表 |
| 进程 | 固定与当前候选相同 Next 16.2.10 production 模式；独立目录/loopback 43183，与候选相同 stream/compress 相关设置 |
| 数据 | 随机 probe ID、序号、时钟和经筛选的网络字段；纯合成 frame |
| 不使用 | production Agent、production Supabase、DeepSeek/Provider、production Student Cookie/JWT、真实学生或课程数据 |
| 安全边界 | 无 auth bypass、无主业务 route、无 Funnel、无 ACL 修改、无 Tailscale reset/daemon restart、无 PM2 restart/reload、无 production migration/deploy、无 Feature Flag ON 或 allowlist 写入 |
| 服务器管理 / 执行人 / Tailscale批准 / 窗口 | self-managed by 杨震 / 杨震 / APPROVED FOR TEMPORARY TRANSPORT PROBE ONLY / 2026-09-15 14:07:53 起最多 30 分钟（Asia/Seoul） |
| 端口检查与清理 | Preflight：9443 无 binding、43183 无 listener；获批测试期间只新增指定 binding；清理后两端口不再提供 probe，Serve 配置恢复，与 before 完全一致 |

临时 probe 自身不加载生产 Auth/Agent，也不关闭产品 validator。限制其外连，不提供任意 upstream 或任意文件读取。只使用已批准 tailnet 测试客户端及现有 grants；若需要修改 ACL，停止并重新申请，不扩大本请求。

## 2. Probe 规格与通过证据

**Streaming**：实际 Next Route Handler `ReadableStream`，三行 NDJSON（完整 newline），seq=1 在开始发送，约 200ms 后 seq=2，再约 200ms 后 seq=3 并关闭。响应 `Content-Type: application/x-ndjson; charset=utf-8`、`Cache-Control: no-store`、`X-Accel-Buffering: no`。timers 在 cancel/abort 中释放。不能一次拼完三行再返回。

分别用 loopback 与实际 Tailscale HTTPS 路径、identity 与可协商 compression 请求，浏览器 fetch reader 和 `curl --no-buffer --compressed` 交叉观察，各至少 5 组。保存 server frame emit 时间与 client 每行 parse 到达时间、content-encoding/transfer headers、字节数、完成时间；客户端按 newline 重组，网络 chunk 边界不等于 NDJSON frame。跨机器绝对时间需校准；优先同一机器 collector 比较时序并保留单调时钟 elapsed，不能用未校准墙钟相减。

PASS 需要逐阶段可见（第一帧在最终阶段完成前到达，能观察间隔），不是最后一次性出现三帧；正常/压缩两种可用路径均不得聚合到末尾。记录真实间隔和编码，没有 encoding 时写未压缩；如压缩路径无法实际触发，记录限制而非宣称已测 gzip。200ms 是生成间隔，不是网络 SLA。发现 buffering 即 FAIL 并归因，不能临时改生产压缩选项掩盖。

**Origin**：单独 probe POST 重现 [student-handlers.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/student-handlers.ts:30) 的当前判断：expected = request.url 的 protocol + Host header（缺失时用 URL host）；Origin 必须精确等于 expected，sec-fetch-site 不能是 cross-site。未来 probe 的该逻辑必须逐字核对或静态 fixture 比较；不改生产函数、不增宽 forwarded header 信任。

只记录无 query 的 probe request.url、Host、scheme、x-forwarded-proto、Origin、计算的 expected、状态码；不记录 Cookie/Authorization/Tailscale 身份 headers 或全 headers。

| Case | 预期 |
|---|---|
| 外部 HTTPS same-origin POST | 200；下游 URL/Host/scheme 与 validator 一致 |
| 不同 Origin / sec-fetch-site cross-site | 403 |
| missing / null Origin | 403 |
| 伪造 forwarded-host/proto | 不得改变当前信任边界或绕过跨源拒绝 |

如果 external HTTPS 在 Next 被视为 http，导致合法同源拒绝，Gate FAIL，记录 exact 字段并停止；R3B 不修改 origin validation。

**Disconnect**：客户端收到第一帧后关闭连接；下游应在诊断窗口 5s 内看到 request.signal abort 或 stream cancel，并终止 timers，后续帧不再 emit。记录实际触发的是哪条通知，不能假称两个都发生；无法通知或仍继续发送为 FAIL。另跑正常完成对照，不能把正常 close 误认为中断。只测网络，不启动真实 Agent，不证明 Run cancellation/reconciliation。

## 3. 获批后的 Runbook（R4B 已执行并清理）

以下保留执行步骤用于审阅；本次新增和撤销命令各执行一次。不是重新执行或延长测试窗口的指令。

1. 核对书面批准人、窗口、host/ports/paths/test client。保存 canonical `tailscale serve status --json`；核对 443/4000/8443 与当前快照，9443 无配置且两个端口空闲。若已占用或已有绑定，STOP，不自行换端口。
2. 在独立目录准备/审核 probe，关闭真实服务依赖，启动 loopback 43183 production Next；先完成本地正负向测试。记录 Next/config/source 摘要，不复制生产 env/secrets。
3. 仅执行获批的增量 binding：

```sh
# R4B EXECUTED ONCE: 2026-09-15 14:12:56 Asia/Seoul
 tailscale serve --bg --https=9443 http://127.0.0.1:43183
```

4. 立即比较配置：只允许新增 9443；既有三条 bindings 必须原样。执行 stream、origin、disconnect 并保存安全元数据。失败/到期立即进入撤销。
5. 删除自己新增的绑定：

```sh
# R4B EXECUTED ONCE: 2026-09-15 14:13:04 Asia/Seoul
 tailscale serve --https=9443 off
```

6. 只停止本次拥有的 probe 进程，确认 43183 无 listener；临时 HTTPS endpoint 不再服务 probe。重读 canonical status，应与 before 完全相同。**禁止 serve reset 或整体覆盖配置**；遇到他人并发修改，只清理自己的项并记录差异，由责任方判断，不能覆盖别人的变更。
7. 保存 before/after 摘要、probe 结果、清理时间与 Release Operator 签名。确认 UPLY PM2/runtime config 无修改；不重启生产服务。

命令依据为本地 `tailscale serve --help` 及 [Tailscale Serve CLI 官方文档](https://tailscale.com/docs/reference/tailscale-cli/serve)；[Serve 官方说明](https://tailscale.com/docs/features/tailscale-serve) 区分 tailnet Serve 与公网 Funnel。本计划不用 Funnel。

## 4. 验收边界与批准记录

此独立端口能验证**实际 Tailscale daemon → 同版本 Next** 的传输语义；不能单独证明真实 8443 路由的 Auth/StudentPolicy 或目标课堂可用。未来签署 G-R3-8..11 时必须核对现有 8443 与临时 9443 的 proxy/HTTP/config 差异，确认差异仅端口/隔离合成应用，并附同版本配置证据。若部署路径存在额外 middleware/compression 差异，保留该 Gate BLOCKED，另行安排获批验证，不能把 loopback 或 synthetic 功能 E2E 冒充完整生产课堂。

| 批准字段 | 当前值 |
|---|---|
| 基础设施批准人 | 杨震 |
| Release Operator / 执行人 | 杨震 |
| 见证人 | N/A — self-managed infrastructure |
| Backup | TBD — NOT ASSIGNED |
| Data / Policy Approver | TBD — APPROVAL REQUIRED |
| 批准日期 | 2026-09-15 |
| 工单 | N/A — self-managed infrastructure |
| 测试窗口 | 2026-09-15 14:07:53 起，最长至 14:37:53（Asia/Seoul）；已于 14:13:04 完成验证与清理 |
| 测试开始时间 | 2026-09-15 14:12:49（Asia/Seoul，loopback 验证开始） |
| 测试结束时间 | 2026-09-15 14:13:04（Asia/Seoul，清理验证完成） |
| 允许的 binding | 仅 HTTPS 9443 → http://127.0.0.1:43183 |
| 允许的 Probe 路径 | /__uply_transport_probe/stream、/__uply_transport_probe/origin、/__uply_transport_probe/disconnect |
| 客户端、访问范围 | 仅本人管理 tailnet 内测试客户端 |
| 既有 binding 保护 | 443 / 4000 / 8443 不允许修改 |
| 撤销 / 清理责任人 | 杨震 |
| Actual Tailscale Verification | PARTIAL — 压缩路径未协商，不能以其他项 PASS 替代 |
| Streaming | PASS — 三类客户端各 5 组实际 9443 样本均逐帧到达 |
| Origin / Host / Scheme | PASS — same-origin 200；跨源、cross-site、missing/null、伪造 forwarded 拒绝符合预期 |
| Compression / Buffering | PARTIAL — UNCOMPRESSED buffering PASS；gzip NOT NEGOTIATED，无压缩传输 PASS 声明 |
| Disconnect | PASS — 实际 request.signal abort 约 1.05ms，清除 timers，frame2/frame3 emit=0；正常完成 control PASS |
| 批准状态 | APPROVED FOR TEMPORARY TRANSPORT PROBE ONLY |
