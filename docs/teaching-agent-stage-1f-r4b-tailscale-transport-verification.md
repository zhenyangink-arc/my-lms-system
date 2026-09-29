# UPLY Teaching Agent — Stage 1F-R4B Actual Tailscale Transport Verification

## 1 Executive Summary

**Overall: CONDITIONAL。Actual Tailscale Verification: PARTIAL。Stage 1G: NOT READY。**

获批的独立 Next 16.2.10 production probe 已通过真实 Tailscale HTTPS 9443 完成逐帧传输、Origin 正负向及断连测试。Streaming、Origin / Host / Scheme、Disconnect 均 PASS。所有响应均无 Content-Encoding，包括 `curl --compressed` 的协商请求；因此未压缩 buffering PASS，但 gzip **NOT NEGOTIATED**，Compression / Buffering 保留 PARTIAL，不宣称压缩路径通过。

临时 binding 已撤销，probe 已停止。新增至撤销确认仅 7.478 秒，既有443/4000/8443及完整Serve配置与before一致；生产PM2、runtime文件hash、OFF/EMPTY均保持。没有生产Agent、数据库、Provider、migration、deploy或名单写入。

## 2 Approval Scope

用户明确授权，Infrastructure Approver / Release Operator / Execution Operator / Cleanup Owner均为杨震；Witness=N/A — self-managed infrastructure。该tailnet由杨震本人创建、加入节点并管理，无其他基础设施批准主体。Backup仍TBD，Data / Policy Approver仍TBD；本批准不能替代这些角色或组织数据政策。

唯一获批binding：`HTTPS 9443 → http://127.0.0.1:43183`。仅三个synthetic路径：`/__uply_transport_probe/stream`、`/__uply_transport_probe/origin`、`/__uply_transport_probe/disconnect`。同一自管tailnet节点上的客户端通过实际HTTPS Serve入口访问，未用本地TLS替身。未覆盖第二台设备、DERP或跨地域网络条件。

禁止项保持：443/4000/8443变更、Funnel、ACL、reset、daemon重启、PM2重启/重载、生产Agent/Supabase/Cookie/JWT/学生/课程、Provider、迁移、部署、FeatureON和allowlist写入。批准原文及结果：[Tailscale申请记录](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-tailscale-verification-request.md)。

## 3 Preflight

完整读取申请文件、当前[student-handlers.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/student-handlers.ts:30)、本机CLI帮助及Next本地Route Handler/production部署指南后执行。

| 核验 | 实际结果 |
|---|---|
| whoami / hostname | yangzhen / kmgwak-System-Product-Name |
| Tailscale | 1.102.2；本机serve --help支持--bg/--https及status |
| 443 | http://127.0.0.1:3001，与批准记录一致 |
| 4000 | http://127.0.0.1:4000，与批准记录一致 |
| 8443 | http://127.0.0.1:3000，与批准记录一致 |
| 9443 / 43183 | 无existing binding；无listener |
| 窗口起点 | 2026-09-15 14:07:53 Asia/Seoul |
| 最大窗口 | 30分钟，最晚14:37:53；未延长 |
| 实际验证 | 14:12:49–14:13:04，含loopback、Tailscale和清理 |

所有preflight检查成功后才创建probe。before Serve JSON、版本及按端口/地址范围脱敏的listener inventory存于[preflight.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4b/preflight.json)。没有保存身份headers或凭证。

## 4 Probe Design

独立目录 `/tmp/uply-r4b-probe.gobkCk`；复用现有node_modules，无安装升级。实际Next16.2.10、React/ReactDOM19.2.7。最小probe package的React声明为19.2.4，未安装该声明版本；本次实际解析和运行的是复用依赖19.2.7，见归档的实际版本，不把声明当作运行版本。

`next build --webpack`成功，Build ID `3_semom2IG5zaluLgUWDz`。使用`next start --hostname 127.0.0.1 --port 43183`；实际ss确认仅loopback监听。构建和运行环境用env白名单，仅PATH、NODE_ENV=production、NEXT_TELEMETRY_DISABLED=1；probe不读取.env.local/runtime.json，不导入业务Agent/Auth/Supabase/Provider。运维侧单独只读摘要检查runtime，未传给probe。

三个Route Handler使用真实Request/Response/ReadableStream；未创建页面业务入口，其他路径仅Next默认not-found/error。下划线路由目录采用Next本地文档的%5F编码规则。没有auth bypass，因为probe不承载任何受保护业务资源，也没有关闭产品鉴权。

Stream发送3条完整NDJSON：立即、约200ms、约400ms；每帧只有probeId/seq/serverElapsedMs。服务端事件另存process.hrtime单调时钟、emit/complete/abort/timers.cleared。高水位配置与现有transport相同，正常结束释放监听和计时器，断连停止后续emit。

Origin计算authority与拒绝表达式从当前产品函数逐字复制，并在启动前验证相等。只返回scheme、Host、x-forwarded-proto存在性/值、expected、originMatch和status；不枚举全部headers，不返回Origin原值、Cookie、Authorization或Tailscale身份字段。

源码、runner、build routes和实际配置完整归档为[probe-source.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4b/probe-source.json)；[probe-integrity.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4b/probe-integrity.json)记录产品validator和probe摘要。临时源码归档是审阅证据，runner含本次固定窗口，不是可自动重跑的长期部署脚本。

## 5 Loopback Verification

先访问`http://127.0.0.1:43183`。curl identity、curl --compressed、Node fetch reader各5个stream样本，另一次主动断连、一次正常disconnect control、7个Origin正负用例，共24次probe请求。全部核心断言通过后才允许建立binding。

curl使用`--no-buffer`，Node使用ReadableStream reader；均累积字节、按newline重组JSON行，未将网络chunk个数当帧数。客户端和服务端在同一机器使用相同单调时钟源记录，不使用跨机器墙钟差。

| Loopback客户端 | 样本 | 帧间到达间隔范围ms | 首帧早于完成至少ms |
|---|---|---|---|
| curl identity | 5 | 156.911–200.549 | 359.351 |
| curl --compressed | 5 | 199.525–200.753 | 400.961 |
| Node fetch reader | 5 | 195.664–200.707 | 398.748 |

首个冷请求有较大首帧开销但仍分阶段可见，没有最后一次性吐出。Origin 7/7通过；断连约3.874ms收到request.abort，后续emit0；正常control三帧及complete通过。原始样本：[transport-results.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4b/transport-results.json)。

## 6 Tailscale Binding

Loopback PASS后再次读取Serve并与before结构全等，确认9443仍空闲，然后只执行获批命令：

```sh
tailscale serve --bg --https=9443 http://127.0.0.1:43183
```

命令exit0；立即构造expected=before+唯一9443 TCP/HTTPS及Web Proxy项，逐结构比较成功。无其他配置差异。开始时间14:12:56；实际请求走批准的tailnet DNS HTTPS地址，curl与Node均保留TLS证书验证，没有--insecure、代理替身或host重映射。

[binding-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4b/binding-result.json)保存新增后配置及exit。执行器以try/finally确保异常清理，另设窗口截止和binding580秒撤销定时器；本轮正常完成，未触发超时。

## 7 Streaming

**Actual Tailscale Streaming: PASS。** 实际9443路径三种客户端各5组，共15组。逐帧seq严格1/2/3；客户端首帧均明显早于完成，相邻帧约200ms。

| Tailscale客户端 | 样本 | 首帧到达ms | 帧间到达范围ms | 完成ms | 首帧领先完成至少ms |
|---|---|---|---|---|---|
| curl identity | 5 | 19.785–22.878 | 199.576–200.938 | 423.174–426.890 | 402.983 |
| curl --compressed | 5 | 17.709–20.916 | 199.505–200.796 | 420.972–424.418 | 402.068 |
| Node fetch reader | 5 | 4.212–30.101 | 199.034–200.965 | 403.872–431.120 | 399.440 |

所有响应200，Content-Type=application/x-ndjson; charset=utf-8、Cache-Control=no-store、X-Accel-Buffering=no。transfer-encoding/content-length/vary仅按字段保存；不从这些headers推导帧数或网络协议。阈值仅用于本次阶段可见性诊断，不是生产SLA或用户体验p95。

## 8 Origin / Host / Scheme

**PASS，实际9443共7项。** 产品validator保持原样，不新增forwarded-host信任。

| Case | 预期 | 实际 |
|---|---|---|
| same-origin POST | 200 | 200 |
| different Origin | 403 | 403 |
| Sec-Fetch-Site: cross-site | 403 | 403 |
| missing Origin | 403 | 403 |
| Origin: null | 403 | 403 |
| 跨源Origin+伪造forwarded-host/proto | 403 | 403 |
| 正确Origin+伪造forwarded-host/proto | 200，不能改变authority | 200 |

实际Next诊断：scheme=`https:`；Host=`kmgwak-system-product-name.taila18cd5.ts.net:9443`；x-forwarded-proto存在且为`https`；expected=`https://kmgwak-system-product-name.taila18cd5.ts.net:9443`。本路径没有出现外部https被解释为http而拒绝合法同源的情况。恶意forwarded-host不替代Host；实际Serve路径上的proto仍是https。

Loopback伪造proto用例中Next会反映该值，但错误Origin仍被拒绝；不能把此事实泛化成所有代理都重写headers。通过结论只覆盖当前Serve→Next路径和给定用例。

## 9 Compression / Buffering

**PARTIAL。UNCOMPRESSED streaming/buffering: PASS。gzip: NOT NEGOTIATED。**

curl --compressed和Node默认协商请求全部没有Content-Encoding。当前真实响应为未压缩，所有样本均分阶段到达；不存在本次未压缩整体缓冲证据。压缩编码没有实际出现，不能写gzip PASS，也没有为通过测试调整Next compress、媒体类型或帧负载。

独立probe最终构建配置compress=true；只读读取R3D冻结制品与当前生产release的required-server-files，compress也均true、basePath/assetPrefix均空。没有改成compress=false。为何当前NDJSON未压缩不作未经验证的因果断言；真实压缩传输行为仍未确认。

9443使用同daemon且与8443都是HTTP loopback proxy，但独立probe不含生产middleware/Auth/StudentPolicy。通用框架压缩配置相同不等于完整课堂route已验证。因此Actual Verification整体PARTIAL，保留限制，不替代真实生产课堂/Pins或额外部署链验证。

## 10 Disconnect

**PASS。** 在实际9443收到frame1后，Node主动abort并取消reader。服务端实际观察到的是`request.signal abort`，约1.051ms；没有声称同时触发ReadableStream.cancel。

服务端清除所有timers，等待700ms（超过原200/400ms两次发送点）后确认frame2/frame3 emit count=0，窗口上限5秒。另一个正常control发出1/2/3并complete，无abort/cancel。Loopback也独立完成相同对照。

[server-events.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4b/server-events.json)共134条受限事件；按probeId交叉核对32次正常请求均三次emit+complete，两次主动断连均仅一次emit+abort+timers.cleared。这里验证网络断连语义，不证明Agent持久取消或reconciliation已运行。

## 11 Cleanup

14:13:04执行唯一获批撤销命令，exit0：

```sh
tailscale serve --https=9443 off
```

仅在当前9443仍指向本次owned target时执行删除，未调用reset或整体覆盖。停止本次spawn得到的probe PID，确认127.0.0.1:43183无listener；再次连接原9443 probe地址失败（curl exit7），9443不再服务probe。没有停止其他进程。

新增命令开始至撤销确认的单调时钟间隔7,478.382ms，实际binding寿命不超过该区间，远低于10分钟目标和30分钟窗口。临时源码/构建目录保留为本次审计材料，已无运行进程或服务端口。

[cleanup-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4b/cleanup-result.json)：ownedTemporaryBindingCount=0、probeListenerStopped=true、remoteEndpointUnavailable=true、configMatchesBefore=true。

## 12 Before / After Config Comparison

| 配置 | Before | 测试期间 | After |
|---|---|---|---|
| 443 | →127.0.0.1:3001 | 相同 | 相同 |
| 4000 | →127.0.0.1:4000 | 相同 | 相同 |
| 8443 | →127.0.0.1:3000 | 相同 | 相同 |
| 9443 | 不存在 | →127.0.0.1:43183 | 不存在 |

完整Serve JSON结构比较，忽略对象键序列展示差异；所有字段一致，没有只比较端口数。单binding add/remove各一次，其他Tailscale变更0。清理后独立只读复核也匹配。

## 13 Production Safety

[production-safety.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4b/production-safety.json)保存前后受限字段：UPLY PM2 PID1176676、restart_time0、pm_uptime、online状态及kill_timeout15000一致；runtime文件SHA保持`7a4b31b099fb968dd1105f8fbc67b946ae3fa79c30873998f8864ef1578878c8`。真实产品开关键仍OFF，三名单EMPTY。

Probe自身没有读生产runtime；此检查由运维侧只读解析，仅保存hash与OFF/EMPTY，不输出任何凭证。未访问生产数据库，未重查ledger；Production Migration NOT APPLIED表示本任务未执行任何迁移。Production Agent Run=0和Provider requests=0指本任务请求范围，不声称其他用户同期活动为0。没有读取实际学生或课程数据，没有把历史449 ledger检查包装成本轮数据库实测。

业务源码、Next配置、迁移、依赖、历史报告未修改；只更新当前批准文件，新增本报告和R4B证据。最终工作区逐文件比较及敏感模式检查见[workspace-scope.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4b/workspace-scope.json)。

## 14 Gate Matrix

| Gate | 名称 | 状态 | 证据 / 限制 |
|---|---|---|---|
| G-R4B-1 | Approval Scope Confirmed | PASS | 用户明确授权；批准记录 |
| G-R4B-2 | Ports Free | PASS | preflight，无9443 binding/43183 listener |
| G-R4B-3 | Existing Bindings Protected | PASS | before/add/after结构比较 |
| G-R4B-4 | Probe Isolated | PASS | 独立tmp，env白名单，loopback-only，源码归档 |
| G-R4B-5 | Loopback Streaming | PASS | 3类客户端×5组 |
| G-R4B-6 | Loopback Origin | PASS | 7/7 |
| G-R4B-7 | Loopback Disconnect | PASS | abort+timer清理+control |
| G-R4B-8 | 9443 Binding Exact | PASS | 只新增批准的TCP/Web项 |
| G-R4B-9 | Actual Tailscale Streaming | PASS | 真实HTTPS9443，3类客户端×5组 |
| G-R4B-10 | Origin / Host / Scheme | PASS | 真实HTTPS scheme、Host、7项用例 |
| G-R4B-11 | Compression / Buffering | PARTIAL | 未压缩逐帧PASS；gzip NOT NEGOTIATED |
| G-R4B-12 | Actual Disconnect | PASS | request.abort约1.05ms，后续emit0 |
| G-R4B-13 | No Auth Bypass | PASS | 无业务入口；产品validator相同，无Auth改动 |
| G-R4B-14 | No Production Agent | PASS | 仅synthetic probe，Agent请求0 |
| G-R4B-15 | No Provider Calls | PASS | 无Provider导入/密钥/请求 |
| G-R4B-16 | Binding Removed | PASS | removal exit0，9443不再服务probe |
| G-R4B-17 | Existing Bindings Restored | PASS | 完整Serve配置匹配before |
| G-R4B-18 | PM2 / Runtime Unchanged | PASS | PID/restart/uptime/配置hash一致 |
| G-R4B-19 | Feature OFF / Allowlists EMPTY | PASS | 前后只读配置摘要 |
| G-R4B-20 | Production Changes Zero except approved temporary Tailscale binding | PASS | add/remove各1，其他生产变更0 |

19 PASS / 1 PARTIAL / 0 FAIL。整体保持CONDITIONAL / Actual PARTIAL，不能按多数票算PASS。

## 15 Remaining Stage1G Blockers

- Production content / Pins及获准internal identity：本任务没有创建或验证真实内容与用户。
- Single-lesson范围：恰好一课及窗口冻结/lesson allowlist仍需独立证据。
- Provider Policy：Data / Policy Approver仍TBD，政策/合同/告知等批准未取得。
- Backup / recovery：备班TBD，本轮没有新恢复点、恢复窗口或回滚批准。
- 运维落实：主要工程角色已有杨震，不能再写所有操作员未指定；备班、值守窗口、reconciler/监控接受记录仍需完成。
- Production migration/deploy/definition/allowlist/First Enable执行授权仍未提供。
- 当前传输结果的限制：gzip未协商，实际压缩路径及完整生产课堂链未验证。

## 16 Final Recommendation

接受本次实际Tailscale未压缩逐帧、Origin及断连证据，并保持Compression / Buffering及整体Actual Verification为PARTIAL。**Stage 1G仍NOT READY。**

本次批准的临时binding已清理、probe已停止、生产保持原状。停止在R4B，不扩展Agent、不进入Stage1G、不部署、不执行生产迁移或启用Feature。
