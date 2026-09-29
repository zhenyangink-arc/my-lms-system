# UPLY Teaching Agent — Build Stage 0A Verification

## 1. Executive Summary

**CONDITIONAL GO — 可以进入 Build Stage 0B：Core Contracts & Foundation；不能据此放行 Student MVP。**

当前机器确实运行着 PM2 管理的 Next Node 生产服务。现有 Node 和已安装 Next 的请求／流适配基础经过合成测试，可以逐块输出 NDJSON、感知客户端断开，并保持超过 45 秒的请求。DeepSeek `deepseek-v4-flash` 在明确关闭 thinking 的测试配置下，完成了真实的“模型选择 Tool → 本地无副作用执行 → Tool Result 回传 → 第二次流式回答”闭环，两个模型调用共约 1.96 秒。以上足以支持开始 Core 合同与基础建设。

限制同样明确：Qwen 开发凭证不可用；生产 HTTPS 代理上的完整、已认证 Assistant 流式请求没有安全 fixture，未完成验证；现有链没有完整取消传播；服务端记录的是教学游标，不能无条件证明当前正在播放的句子；两只 Student Read Tool 的专用安全投影与 AgentRun 原子 RPC 尚不存在。

首个 MVP 的**能力验证基线**推荐 DeepSeek `deepseek-v4-flash`、`thinking.type=disabled`。这是后续开发选择，**本次没有切换线上模型、修改 Provider 配置或实现 Adapter**。首批解释句子的合同应保持 `verified_selection`，经服务端核验所选内容；不把现有游标直接命名为可靠的 `verified_current`。

本文中的 PASS 只覆盖该行明确陈述的测试对象。宿主能力通过不等于新 Core 已经存在；配置存在不等于部署完成；只读元数据不证明 RLS、并发和业务授权已经通过运行测试。

## 2. Inputs & Environment

### 输入与事实优先级

已完整阅读 [Current State Audit][AUDIT] 和 [Architecture v1][ARCH]。前者是调查记录，后者是目标设计；两者均以本阶段读取的运行环境、源码和配置为准。没有修改这两份文件。

| 项目 | 本次记录 |
|---|---|
| 工作目录 | `/home/yangzhen/projects/my-lms-system` |
| Git HEAD | `b1672390ae96357a2143358235cc10edeff8d488` |
| 验证日期 | 2026-09-13；现场记录截至约 13:25 UTC / 22:25 KST，报告整理随后完成 |
| Node | 本机 shell 与在线 UPLY 进程均为 v26.5.0 |
| 安装依赖 | Next 16.2.10；OpenNext Cloudflare 1.20.1；Wrangler 4.112.0 |
| 在线程序 | PM2 `uply-first-enable`；Next production start；127.0.0.1:3000 |
| 在线源码目录 | `/home/yangzhen/releases/uply-first-enable-20260910/source` |
| 本工作目录开发进程 | PM2 `uply-dev` stopped；没有把 shell 的环境当成线上进程配置 |
| 现状报告 SHA-256 | `8d1c036e66b29cc4d8facbdc7e0df90980aff4b67730500728378c4e06e815e5` |
| 架构文档 SHA-256 | `c38be2a1540b261bafe7e28ea6610c31e8795b21800f890e7c145decb0fa4538` |

### 方法与证据编号

| 编号 | 已执行的取证／测试 | 证明范围 |
|---|---|---|
| E01 | package、配置、Next 本地文档、进程、端口、PM2 白名单字段、systemd、Docker、Tailscale serve 状态只读检查 | 当前机器实际宿主及代理，不覆盖所有外部部署 |
| E02 | 直接与 HTTPS 代理 GET `/login`；API GET；无 Cookie 合成 POST `/api/agent-chat` | HTTP 服务及未认证拒绝；不是完整 AI 流 |
| E03 | heredoc 内临时 localhost HTTP harness，使用实际安装的 Next request/stream 内部适配器；POST NDJSON、断开、46 秒连接 | Node 与 Next 流基础；不是现有 Route、浏览器或生产代理 |
| E04 | 已配置开发凭证，DeepSeek 恰好 3 个合成请求 | 流式 Tool 完整闭环、完成调用 usage、客户端取消 |
| E05 | Supabase REST OpenAPI GET，仅筛选表／字段／RPC 名称 | 暴露 schema 中的对象存在性，不读取学生业务行 |
| E06 | Provider 配置的只读 GET，仅选 provider、model、profile agent_code/status；2 条 published 配置 | 当前配置选择；不读取 system_prompt、对话或教学内容 |
| E07 | 实际 `teachingScriptSegments` 纯函数，输入两句合成韩语；源码追踪 auth、session、roster、SQL | 分句行为及数据来源；不证明真实用户授权或实时 UI 对齐 |
| E08 | 开始／结束 Git 状态、已有文件内容摘要、报告结构及链接检查 | 本任务写入边界 |

E03、E04、E07 使用 shell heredoc，未创建正式验证源码，也未创建 `/tmp/uply-agent-verification-*` 文件。临时监听器已关闭。E04 不使用真实学生、课程、教师、Prompt 或聊天数据；工具仅返回合成 echo。没有向 `ai_token_usage` 写入测试记录。

E05/E06 使用现有服务端凭证进行授权范围内的 GET；只打印允许的元数据与模型配置。开发配置与在线 launcher 配置在内存比较中，Supabase endpoint 相同、DeepSeek credential 相同；未打印凭证、其摘要或任何认证 Header。**这不能证明 Supabase Edge Function 的运行环境配置相同。**

未运行 build、install、migration、seed、发布、重启或写业务 API。现有 Guide POST 的无登录合成测试在认证入口返回 401，按该 Route 的执行顺序未进入 session/message 写入与 Provider 调用。未使用真实用户 Cookie 做正向测试。

### 证据边界

验证状态统一使用 PASS / FAIL / BLOCKED / UNKNOWN。数据库“实现可行性”额外使用任务要求的 FEASIBLE / FEASIBLE WITH NEW RPC / BLOCKED / UNKNOWN；第 19 节的标签是架构假设标签，不混用为测试通过状态。

源码行链接定位当前工作树。在线 release 的 `auth.ts`、Supabase server client、Guide Route、Learning Route、script runtime、teaching-video、package.json 共 7 个文件与工作树内容一致；这不是整个 release 与 HEAD 一致，也不是 source-to-build 完整性证明。

## 3. Runtime Deployment Verification

### 当前真实部署

E01 在宿主机读取到 PM2 daemon v7.0.3，`uply-first-enable` online，PID 1176676；其 cwd 指向独立 release。该进程使用 `/home/yangzhen/miniconda3/bin/node`，对应 Next server，实际监听 127.0.0.1:3000。`uply-dev` 为 stopped、PID 0。其他 Next 进程未凭名称计入 UPLY，已结合 cwd 区分。

[生产启动器][START] 读取其私有 runtime 配置，要求 `NODE_ENV === 'production'`，随后将配置赋给 `process.env`，以 `next start --hostname 127.0.0.1 --port 3000` 启动。安全白名单读取确认配置中的 `NODE_ENV=production`。不能用进程初始 `/proc/environ` 或当前 shell 没有 `NODE_ENV` 推翻 launcher 在进程内赋值的事实。

Tailscale serve 当前将本机 HTTPS 8443 入口代理到 `http://127.0.0.1:3000`；该 HTTPS 入口的 `/login` 实际返回 200。`pm2-yangzhen.service`、`tailscaled.service` active。未发现另一条已确认的 UPLY Web systemd 启动路径。Docker 中存在本地 Supabase 服务（数据库镜像 PostgreSQL 17.6 系列）；没有据此认定 UPLY Web 运行在 Docker 中。

**本机 Node production 运行路径：PASS。公网主域名、所有生产流量是否都走这条路径：UNKNOWN。** 这里的 Production Confirmed 限定为这台机器启动为 production 并经其配置的 HTTPS 入口提供服务，不推断其他环境。

### Runtime Deployment Matrix

| 路径 | Configured | Buildable | Currently Running | Production Confirmed | 证据与限制 |
|---|---|---|---|---|---|
| 当前工作树 Next dev | PASS | UNKNOWN | FAIL | UNKNOWN | package 有 dev；PM2 dev stopped；未启动、未构建 |
| release 的 Next Node | PASS | PASS | PASS | PASS | launcher、在线 PID/端口、现有 `.next/BUILD_ID`、HTTP 200；Buildable 仅指已有产物能启动，不是本次 fresh build |
| 当前工作树 fresh production build | PASS | UNKNOWN | UNKNOWN | UNKNOWN | 有 Next build/start scripts 与现存产物；没有对当前所有未提交内容做构建 |
| OpenNext / Cloudflare | PASS | UNKNOWN | UNKNOWN | UNKNOWN | 有配置和命令；工作树没有 `.open-next` 构建产物，未取得实际 Worker 部署证据 |

[package.json][PKG] 提供 Next dev/build/start 与 OpenNext build/preview/deploy 路径。[next.config.ts][NEXTCONFIG] 包含可选 distDir、图片、开发 origin、service worker Header 与 Server Action body 限制，没有定义 Teaching Agent 运行期限。[ecosystem.completion-worker.cjs][COMPLETION] 是课程 completion worker 配置，不能当成 Agent Core 或 UPLY Web 的在线证明。本次未发现 `.github`／`.gitlab` CI 配置目录；这不排除仓库外发布流水线。

### Node Runtime Gate

**PASS — 当前宿主有实际可运行的 Next Node 路径。** 安装的 Next 文档规定 Route Handler 默认 `nodejs`；检索当前 `src` 未发现显式 `export const runtime = ...` 覆盖。[本地 Next runtime 文档][NEXTRUNTIME]

E03 实测 `ReadableStream`、`AbortSignal.timeout`、`fetch` 可用，并验证 Next request signal 和 stream pipe 的实际行为。Next Node Composition Root 在此项目结构中有运行基础，但本次没有创建该 Composition Root。

### OpenNext / Worker 边界

[wrangler.jsonc][WRANGLER] 指向 `.open-next/worker.js`，compatibility date 为 `2026-07-21`，启用 `nodejs_compat`，静态资产目录 `.open-next/assets`，observability enabled；没有显式 CPU/subrequest 额度配置。[open-next.config.ts][OPENNEXT] 使用 `defineCloudflareConfig()`。

OpenNext 所说的 Next “Node.js runtime”在该部署目标中由 Workers 的 Node 兼容能力承载，不等于本机常驻 Node 进程。[OpenNext Cloudflare 文档](https://opennext.js.org/cloudflare)

Workers 的 HTTP wall-clock、CPU 时间、subrequest 限额是不同约束；保持连接的请求没有同样的硬性 wall-clock 截止，并不保证客户端断开后持续执行。`waitUntil` 的延长也有边界，不能作为任意 Run 的后台保障。账户套餐与实际配置尚未知。[Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)

| Worker 验证项 | Status | 现有证据／必须重新验证的部分 |
|---|---|---|
| 项目已配置 Node compatibility | PASS | `nodejs_compat` 与 OpenNext 配置实际存在 |
| 当前 UPLY Worker 已部署且接流量 | UNKNOWN | 无部署 ID、运行实例或访问链证据 |
| 45 秒 Run | UNKNOWN | 需实际账户限制、连接存活、CPU 和 timeout 组合验证 |
| NDJSON 经 Worker/代理逐块到客户端 | UNKNOWN | 本次 E03 只测 Node；没有 Worker 流测试 |
| 客户端断开 → Provider abort | UNKNOWN | 需 Worker 实例与代理测试 |
| 多步 Tool Loop | UNKNOWN | Provider 支持不代表 Worker 的子请求／CPU／包兼容通过 |
| DB persistence / terminal 落库 | UNKNOWN | 需真实部署凭证权限、网络及断开后的执行语义 |

结论：Node 是当前已验证的首版宿主。若改用 Worker，上表需要重新开 Gate；不能把本次 Node 结果平移过去。

## 4. Streaming Verification

### 当前源码中的路径

Guide：[Guide Route][GAPI] 调用 Guide Edge，接收文本，再以 NDJSON 事件发回 UI。Learning：[Learning Route][LAPI] 调用 Learning Edge 并返回文本流；[Learning UI][LUI] 以 fetch reader 消费。两个 Edge 都向 Provider 请求 `stream: true`，解析 Provider SSE，输出文本。[Guide Edge][GEDGE]、[Learning Edge][LEDGE]

这证明当前流传输代码存在，不足以证明线上代理未缓冲。已有业务 Route 可能创建 session、写 message 或推进教学状态，因此没有用真实学生请求测试。

### 实测 HTTP 与 chunk

| 测试 | Status | TTFB / Headers | Content-Type / Transfer | Chunk 与结论 |
|---|---|---|---|---|
| 直连 Node GET `/login` | PASS | 约 26.4 ms | HTML；Content-Length 26361；无 Transfer-Encoding | total 26.5 ms；同一时段读到多个 buffer 不代表增量生成 |
| 已配置 HTTPS 代理 GET `/login` | PASS | 约 20.5 ms | HTML；Content-Length 26361；无 Transfer-Encoding | total 20.6 ms；证明代理通达，不证明 NDJSON |
| GET 两个 POST-only AI Route | PASS | Guide 6.6 ms；Learning 4.5 ms | HTTP 405 | 符合方法限制；不是 AI 能力测试 |
| 无认证合成 POST Guide | PASS | total 69.9 ms | HTTP 401；application/json | 未进入 AI 和持久化分支 |
| E03 隔离 POST NDJSON | PASS | headers 22.5 ms | application/x-ndjson; charset=utf-8；chunked | 三个 29-byte 合成帧在 22.6 / 217.6 / 421.1 ms 到达 |
| E04 DeepSeek 直连 stream | PASS | planning headers 498.1 ms | text/event-stream; charset=utf-8 | 6 个读块；Tool 参数跨事件分片，见第 8 节 |
| Browser → 生产 HTTPS → 现有 Next AI Route → Edge/Provider → Browser | BLOCKED | 未测 | 未测 | 缺少无业务写入的授权合成 fixture；未新建 endpoint 来绕过限制 |

E03 使用实际安装的 `NextRequestAdapter.fromNodeNextRequest`、`signalFromNodeResponse`、`pipeToNodeResponse` 和 native HTTP listener。它不是一个部署到 Next App Router 的临时 Route，也没有真实浏览器或 HTTPS 代理参与；不得称为现有 Assistant 的端到端 PASS。总观测约 451.2 ms，包括约 30 ms 结束观察。

因此 **Teaching Agent POST + NDJSON 的 Node 基础能力 PASS，现有生产完整流路径 BLOCKED**。能否在当前代理上保持逐帧延迟仍需无副作用的正式测试入口或授权 fixture。Next 的自托管文档也指出代理 buffering 会影响 streaming。[本地 self-hosting 文档][SELFHOST]

## 5. Cancellation / Abort Verification

### 实际能力

| 验证项 | Status | 证据与限制 |
|---|---|---|
| Node fetch 接受 AbortSignal | PASS | E03/E04 都由 AbortController 中止读取并观察到 AbortError |
| Next request signal 可反映 HTTP 断开 | PASS | E03 通过实际 Next adapter 创建请求；断开后 request.signal.aborted 为 true |
| 断开可取消服务端 ReadableStream | PASS | E03 `ReadableStream.cancel` 被调用；客户端 cancel 后约 4.9 ms 服务端观察到 abort |
| Provider 请求的客户端 abort | PASS | E04 第 3 次调用，在首段内容约 675.1 ms 时取消，约 677.1 ms 结束 |
| 当前 UI → Next → Edge → Provider 全链传播 | FAIL | UI 有 AbortController，但 Next 上游 fetch 未链接 request.signal；Edge 使用独立 45 秒 timeout |
| 生产 HTTPS 代理上的断开传播 | UNKNOWN | 只读 login 请求无法验证长连接断开；未拿真实学生请求测试 |
| Provider 停止计算／不再计费的远端确认 | UNKNOWN | 本地 AbortError 不是远端停止确认；取消请求未返回最终 usage |
| 未来实际业务 Tool 接收同一 signal | UNKNOWN | 专用 Tool Runtime 尚未实现；echo 仅本地同步纯函数 |

E03 abort 测试 headers 4.3 ms、首帧 4.4 ms，服务端同时观察到 request abort 与流 cancel，总观测约 37.2 ms。Next 的实现监听 response close，在响应未正常结束时触发 abort，再将 signal 传入 Request 和 pipe。[Next request adapter][NEXTREQUEST]、[Next stream pipe][NEXTPIPE]

**Abort Capability Gate：PASS，限定宿主可实现。** 当前业务链的实现完整性另行 FAIL。未来需要把同一取消原因与剩余 deadline 贯通 Core、Provider fetch、异步 Tool 和终态；仅 UI 停止显示不能作为完成依据。本阶段未实施这些变更。

### Timeout / Retry / 错误

现有两个 Edge 的 Provider fetch 都使用 `AbortSignal.timeout(45_000)`；这是单次 Provider fetch 的 timeout，不是覆盖鉴权、读 context、多次模型调用和持久化的 Run 总预算。相关函数中没有已连接的通用 retry loop；上游非成功／缺 body 会被简化为 502，catch 也返回通用错误。[Guide Edge][GEDGE]、[Learning Edge][LEDGE]

| 错误类型 | Status | 能获得的信息／当前限制 |
|---|---|---|
| 客户端取消 | PASS | 实测 AbortError；远端成本未知 |
| 网络失败规范化 | UNKNOWN | fetch 异常及 cause 可供未来分类，但本次未主动制造网络失败 |
| 429 | UNKNOWN | 原始 upstream.status 可读取；本次未制造限流，旧 502 包装会丢失精细类别 |
| 5xx | UNKNOWN | 同上；未向 Provider 发送故障探测请求 |
| invalid schema / model | UNKNOWN | 没有额外失败请求；Tool 参数成功 JSON 解析不是 schema-error 处理测试 |
| 自动 retry 的预算和幂等正确性 | UNKNOWN | 本次无 retry；新 Adapter 尚不存在 |

原始 fetch response 足以让未来 Adapter保留 HTTP 状态和有限安全错误结构，这仍是待实现的错误合同，不能标成已通过运行验证。

## 6. Provider Configuration

### 凭证存在性

只读取名称存在性，不输出值。开发检查范围是本机现有 `.env.local`；线上 Node 检查范围是 launcher 的配置来源，未读取 Edge secret 管理接口。

| 环境变量 | 开发 `.env.local` | 在线 Node launcher 配置 | 含义 |
|---|---|---|---|
| DASHSCOPE_API_KEY | NOT SET | NOT SET | 无法开展 Qwen live test |
| DEEPSEEK_API_KEY | SET | SET | 开发凭证可用于获准的极小合成测试 |
| QWEN_AGENT_URL | NOT SET | NOT SET | 源码提供兼容 API 默认地址；Edge 实际 env 未确认 |
| QWEN_MODEL | NOT SET | NOT SET | 不能用 seed/allowlist 当成当前选择 |
| DEEPSEEK_BASE_URL | NOT SET | NOT SET | 测试使用现有源码已配置的官方默认值 |
| NEXT_PUBLIC_SUPABASE_URL | SET | SET | 只用于当前环境只读元数据／配置检查 |
| SUPABASE_SERVICE_ROLE_KEY | SET | SET | 本次仅 GET；未输出值、未读学生记录 |

### Endpoint 与当前 selected model

| Provider | Endpoint config source | 本次使用／确认 | Status |
|---|---|---|---|
| Qwen | Edge 中 `QWEN_AGENT_URL`，否则 `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | 源码地址存在；没有凭证，没有实际 selected Qwen model | BLOCKED |
| DeepSeek | Edge 中 `DEEPSEEK_BASE_URL`，否则 `https://api.deepseek.com`，追加 `/chat/completions` | 按源码默认值解析 `https://api.deepseek.com/chat/completions`；未改 env 或搜索替代 endpoint | PASS |

模型配置选项包含 Qwen `qwen3.7-plus`、`qwen-plus`、`qwen-max`，DeepSeek `deepseek-v4-flash`、`deepseek-v4-pro`。这些字符串仅表示应用提供的选择，不证明账号权限或每个型号的能力。[model-options.ts][MODELOPTIONS]；实际 Edge 读取 profile.model。[Guide Edge][GEDGE]、[Learning Edge][LEDGE]

E06 针对现有数据库使用只读查询，选择 `provider,model,learning_agent_profiles!inner(agent_code,status)`，只筛 published，最多 10 条；HTTP 200，实际得到 2 条：

| Published profile | Provider | Model | Status |
|---|---|---|---|
| `uply-korean-teacher` | deepseek | deepseek-v4-flash | PASS：配置行存在并选择该模型 |
| `uply-guide-agent` | deepseek | deepseek-v4-flash | PASS：配置行存在并选择该模型 |

没有选取 system_prompt 或 reply_policy 原文，没有将任何配置行作为 Provider 测试内容。当前 Qwen selected model 为 **UNKNOWN**。现有业务 Edge 是否成功加载这两条配置并实际完成推理，本阶段未通过登录业务链验证；E04 证明的是直接 Provider 能力。

## 7. Qwen Capability Test

**BLOCKED — credential unavailable。实际请求数：0。** 没有要求补 key，也没有把 DeepSeek 成功推论给 Qwen。

| 验证项 | Status | 结论 |
|---|---|---|
| 当前 Qwen selected model | UNKNOWN | 当前 published 配置为 DeepSeek；仅存在 Qwen allowlist |
| Qwen 文本 streaming | BLOCKED | 开发凭证未配置 |
| 真正 Tool Call（name/id/arguments） | BLOCKED | 未发请求 |
| Tool Result → 第二次推理 → final | BLOCKED | 未发请求 |
| Tool Calling + Streaming | BLOCKED | 无分片、finish reason、call id 实测 |
| 完成／取消／错误调用 usage | BLOCKED | 无真实 response |
| Abort | BLOCKED | 无真实 Qwen stream |
| Structured Output | BLOCKED | 无真实 response-format 验证 |

当前没有证据让 Qwen 成为“首个已验证的 Student MVP Provider”。保留 Provider Adapter 合同的可扩展方向不受影响，但不能把 Qwen 的 Gate 标为 PASS。

## 8. DeepSeek Capability Test

### 实验配置与范围

实际请求数 **3**，没有 retry，没有追加第 4 次。模型为当前已确认配置中的 `deepseek-v4-flash`，raw Node fetch，官方兼容 API 源码默认 endpoint。每次 `max_tokens=128`、`stream=true`、`stream_options.include_usage=true`；明确设置 **`thinking: { type: "disabled" }`**。

该选项是测试参数，没有写入环境或线上配置。当前 DeepSeek 文档区分 thinking enabled/disabled，thinking 模式的多轮工具协议还有相应约束；现有 Edge 请求没有显式发送这个选项。因此本次成功只覆盖上述精确配置，不能宣称验证了默认 thinking 或所有模式。[DeepSeek Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)

测试工具 `echo_test` 完全在内存执行，无 DB、HTTP、课程或文件操作。其参数 schema：

```json
{
  "type": "object",
  "properties": { "value": { "type": "string" } },
  "required": ["value"],
  "additionalProperties": false
}
```

合成 system instruction 只要求使用 echo 工具并在获得结果后回复 echo value；user 为 `Call echo_test with value verification.`。本地结果固定为 `{"echo":"verification"}`。没有使用 UPLY Prompt 或学生内容。

### 完整闭环

1. 第一次请求真实包含 `tools`，`tool_choice=auto`；没有强制指定函数。Provider 返回一个真实 `echo_test` Tool Call。
2. 按 Tool Call index 拼接分片，保留 Provider 返回的 call id；完整 arguments 解析后核对为 `{"value":"verification"}`。
3. 本地合成工具执行，生成 `{"echo":"verification"}`。
4. 第二次请求的 history 追加实际 assistant tool_calls，再追加 matching `tool_call_id` 的 tool result。继续 stream；最终回答阶段 `tool_choice=none`。
5. 第二次真实推理返回普通文本，测试精确匹配 `verification`。这次没有新 Tool Call。

**完整闭环：PASS。** 这不是预先取资料再塞 Prompt；模型实际返回了 Tool Call，工具结果按协议回传后发生第二次模型请求。最终阶段禁止再选 Tool 是本次 bounded fixture 的设置，不证明多轮无限工具循环。

### 安全协议记录

| 字段／行为 | 第一次 planning | 第二次 final |
|---|---|---|
| HTTP | 200 | 200 |
| Content-Type | text/event-stream; charset=utf-8 | text/event-stream; charset=utf-8 |
| 顶层 SSE | `data:` JSON，结束 `[DONE]` | `data:` JSON，结束 `[DONE]` |
| delta 字段 | role、content、tool_calls | role、content |
| Tool call count | 1 | 0 |
| function name | echo_test | 不适用 |
| call id | 存在，原样关联；不抄录实际值 | tool result 使用相同关联 |
| arguments | 10 段；最终 JSON 可解析且完全匹配 fixture | 无 |
| finish_reason | tool_calls | stop |
| usage | 在第 13 个 JSON event，约 1199.5 ms | 在第 4 个 JSON event，约 758.8 ms |
| 最终内容校验 | 进入 Tool 分支 | 精确匹配合成预期 |

上述是安全字段形状与行为摘要，未保存完整 Provider Response 或认证 Header。Tool arguments 的 JSON 解析成功不代表 `response_format=json_schema` 已验证。

### 逐块与 usage

| 指标 | Planning | Final |
|---|---:|---:|
| Headers 到达 | 498.1 ms | 184.7 ms |
| Read chunks | 6 | 4 |
| Chunk 到达时间 | 499.2 / 1131.4 / 1145.1 / 1160.0 / 1171.5 / 1199.3 ms | 184.9 / 692.0 / 745.8 / 758.7 ms |
| Final 首个文本 delta | 不作为回答首 token 计量 | 692.0 ms |
| 请求总耗时 | 1203.0 ms | 759.3 ms |
| input / prompt tokens | 304 | 94 |
| output / completion tokens | 38 | 2 |
| total tokens | 342 | 96 |
| prompt cache hit / miss | 0 / 304 | 0 / 94 |

第三次是纯合成短文本 streaming 取消测试：headers 185.9 ms，读块约 186.2 / 674.9 ms，首个文本 675.1 ms 时执行 abort；677.1 ms 观察到客户端 AbortError 结束。没有收到 finish、`[DONE]` 或 usage，必须记录 **reported usage unavailable**。远端计算停止与最终费用为 UNKNOWN。

## 9. Provider Capability Matrix

以下 PASS 均限定测试参数。Abort 列只代表本地 fetch 取消，不代表远端计费停止。

| Provider | Endpoint config source | Current model | Streaming | Tool Calling | Streaming + Tools | Usage | Abort | Structured Output | Test Method | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Qwen | Edge env/default endpoint | UNKNOWN | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | 静态检查；0 请求 | BLOCKED |
| DeepSeek | Edge 已有默认 endpoint；开发 key | deepseek-v4-flash；E06 published 配置 | PASS | PASS | PASS | PASS：两次完成；FAIL：取消无 reported usage | PASS：客户端；远端 UNKNOWN | UNKNOWN | 3 次真实合成 fetch；thinking disabled；echo 闭环 + cancel | PASS：受测能力 |

首个 MVP Provider 推荐 **DeepSeek，限定上述受测型号和参数**。这是当前环境证据得出的可用性选择，不是价格、教学质量、并发稳定性或所有模型的排名。`deepseek-v4-pro`、Qwen allowlist 各型号、默认 thinking、强制 structured response、并行多工具、多轮工具继续选择均未测。

## 10. Authentication Foundation

**Auth Foundation Gate：PASS，限定可信请求入口已经存在且可在现有 Route Handler 使用。**

[getAuthContext][AUTH] 使用 [Supabase server client][SUPASERVER]，从 Next `cookies()` 读取会话，再调用 `supabase.auth.getUser()`；它不是相信客户端传来的 role/userId。接着检查 profile active，读取 active tenant membership 与 active tenant，以成员角色组装服务端上下文。现有 [Guide Route][GAPI] 已调用它；E02 实际无认证 POST 返回 401。

| 关注项 | Status | 边界 |
|---|---|---|
| Route Handler 内复用 getAuthContext | PASS | 已有调用 + 线上未认证拒绝实测 |
| 服务端 user 校验、profile / membership 查询逻辑存在 | PASS | auth.ts 调用 getUser 并查询当前用户关联记录 |
| 正向学生、教师和租户隔离运行测试 | BLOCKED | 无可用授权合成账号 fixture；本次未读真实学生记录 |
| 脱离 Next request 的普通后台函数直接调用 | FAIL | 当前 server client 依赖 Next cookies request context；不能当成通用后台 auth port |
| 完整 Student/Teacher Agent 策略已存在 | FAIL | 当前 helper 不覆盖 Agent 资源、Tool 和 Run 全部资格 |

`getAuthContext` 的 React `cache` 包装是调用上下文中的复用机制，不是持久登录状态或全局授权缓存；未来 Composition Root 应在有效 Next request 内建立 AuthContext，不能凭这个包装假定任意执行环境可用。

还必须处理现有两条边界：平台身份会获得 `tenant: null`；tenancy schema 不可用时有 legacy fallback，亦可能 active + tenant null。未来租户 Agent 入口不能仅检查 `status === active` 后用高权限客户端读取业务数据。[auth.ts][AUTH]

[student-permissions.ts][STUDENTPERM] 的 role/tier helper 有复用价值，但不能替代 app capability、enrollment、资源所有权和可见范围；[StudentAppRouteLayout][APPLAYOUT] 的页面检查也不能自动继承到新 API。[admin.ts][ADMIN] 中的平台 owner guard 应保持自己的范围，不能作为普通 Teacher/Student Agent 权限提升通道。

本次使用 service-role 做元数据 GET 不证明未来 Tool 授权安全。未来可信 user/tenant 来自 request intake，资源约束仍须在只读 domain port 内执行，不能让模型参数或浏览器 body 决定权限。

## 11. Student Segment Binding

**Segment Binding Gate：FAIL，针对“现有系统已能无条件可靠绑定当前正在播放句子”的要求。** 服务端确实保存 segment 游标；“只有客户端知道 segment”也不准确。

### 已有事实

E05 确认 `learning_agent_sessions` 暴露 `script_version_id`、`current_node_id`、`teaching_state`、`tenant_id`、`student_id`、`lesson_id`、`status` 等字段。没有读取任何学生 session 行。

[Learning Route][LAPI] 读取指定 session 时以 tenant/student/lesson/profile 限制；未指定时查最新 active session。它加载 published script、nodes，并经 [resolveScriptStep][SCRIPT] 解析状态，再插入或更新 session。`teaching_state.scriptSegmentNodeId` 与 `scriptSegmentIndex` 构成服务端 segment 游标；ready 分支会推进它。

| 所需事实 | 当前来源 | Status | 可信含义与限制 |
|---|---|---|---|
| script version 存储 | session.script_version_id + script 查询 | PASS | 字段、查询存在；重新加载可能映射至新的 published version |
| current node 存储 | session.current_node_id | PASS | 表示服务器最后保存的 node；不是多页面同步证明 |
| segment index 存储 | teaching_state.scriptSegmentNodeId / scriptSegmentIndex | PASS | server runtime 实际读写；非仅前端状态 |
| segment 切分规则 | teachingScriptSegments / teacherScriptSegments | PASS | E07 调用实际纯函数对合成两句分段，结果匹配 |
| 当前真实用户游标有效且不陈旧 | 未读取真实 session | UNKNOWN | 没有安全 fixture 做恢复／跨页／并发验证 |
| 当前播放帧／所见句子与该游标始终一致 | 缺少端到端一致性合同 | FAIL | UI 可暂停、清空显示、切换讲解模式；请求不携带完整选句 revision 绑定 |
| 已有可直接调用的 verified_selection validator | 未找到专用实现 | FAIL | 需要新只读核验投影，不能信任浏览器原句 |

[teachingScriptSegments][SEG] 优先使用 configuration 中指定语言的 scriptSegments，但要求合法字符串数组、数量上限及拼接与完整原稿一致；否则按换行段落拆分。E07 仅证明合成输入的纯分句行为，未接数据库。

[教材 loader][LOADER] 仅在版本/node/segment node 对齐时恢复 index，否则回落 0；[Learning UI][LUI] 会在发起 tutor request 时暂停视频／改变显示，还支持角色扮演等特殊内容。视频片段使用的 authored language 与 UI locale 不一定相同。数组 index 在编辑、切分和版本变化后不具有稳定句子 ID 语义。

### 为什么不能直接 verified_current

1. 现有 session 更新没有为 segment 绑定提供比较并交换的 state revision；读取与更新之间可能被其他请求覆盖。
2. script version 变化时按 node_key 迁移，不能把旧 index 无条件解释为新版同一句。
3. 部分更新没有将写入错误转为强一致状态证明；显式 session 路径也不能等同于“最新 active UI session”。
4. 页面显示、视频播放位置、phase 特殊反馈与最后保存教学游标不是同一个事实。

这些是静态数据路径证据，不是已复现某个学生受到影响，也没有执行攻击或并发写测试。

**首版判断：保持 `verified_selection`。** 用户明确选择句子，未来服务端核验 lesson/script version/node/语言/segment 与原句或 digest 一致，才允许引用；缺失或陈旧时不猜测。现有 server cursor 可以作为“最后保存的教学位置”候选来源，但未经对齐不能称“现在正在播放”。这保持 Architecture v1 已有降级原则，不修改原文或现有 Runtime。

## 12. Read-only Domain Port Feasibility

### 两只 Student MVP Tool

| MVP Tool | Existing read source | Side-effect free? | Authorization source | Missing projection | Feasibility |
|---|---|---|---|---|---|
| get_current_lesson_context | `loadSmartDigitalTextbook` / published script、nodes 查询；`teachingScriptSegments` 纯切分 | loader 当前查询是 select，纯分句无副作用；整份 UI loader payload 不适合直接给模型 | getAuthContext、app 资格、enrollment、lesson/course 可见性；不能仅凭 admin 查询参数 | NEW：已核验 lesson/version/segment 的最小内容、目标、来源；字段白名单、长度、相邻段范围；禁止 answer key / 整份 configuration | 数据与纯读取机制有基础；专用安全 Tool port 尚未就绪 |
| get_current_teaching_state | 教材 loader 的 session 恢复查询；`learning_agent_sessions` 的 own-session 数据结构 | 独立 select 可只读；`/api/learning-agent/respond` 会写状态，不能调用 | verified user/tenant；session 的 student/lesson/profile/status 关系；发布版本 | NEW：最小 teaching state 视图、版本/index 检查、stale 语义、允许字段；不能凭未验证 session ID | 数据存在；需新 read projection/domain port |

相关纯读取资产：[教材 loader][LOADER]、[分句函数][SEG]。Learning Route 中虽有可参考的 select，但整条 Route 包含 session create/update、restart、消息和教学状态流程，**不能包装成 read-only Tool**。[Learning Route][LAPI]

| 验证项 | Status | 说明 |
|---|---|---|
| 只读数据来源与纯分句机制存在 | PASS | 源码查询、实际函数合成执行、schema 元数据相互支持 |
| 两只 Tool 已有专用、可直接安全调用的 port | FAIL | 未找到包含完整 scope + 最小模型投影的现成合同 |
| 正向／越权／stale fixture 运行测试 | BLOCKED | 缺少安全 fixture；未读写真实学生数据 |
| 新 port 的可实现性 | UNKNOWN | 有明确来源，但尚未实现和验证；不是数据完全不存在 |

现有 experimental adapter 或 UI 恢复读取也不能因名称接近，就当成已接入真实模型的 Tool。此项是 Student MVP 前的建设缺口，**不是禁止开始 Core 合同的理由**。

## 13. Teacher Scope Feasibility

**Teacher 授权数据来源存在：PASS；完整 Teacher Copilot 授权运行验证：BLOCKED。**

| 资产 | 当前证据 | Status | 限制 |
|---|---|---|---|
| tenant_student_assignments | E05 表元数据含 tenant_id、student_id、teacher_id、student_app_id | PASS | 没有读取真实 roster |
| getTeacherAssignedStudentIds | tenant / teacher / app 条件读取 assignment | PASS | 发生查询错误时返回空数组；未来应区分 unavailable 与 roster 为空 |
| app capability / enrollment / membership | class snapshot SQL 实际检查 | PASS | 逻辑存在，不是已完成所有角色的 live tests |
| class snapshot RPC 在当前暴露 schema 存在 | E05 RPC metadata | PASS | 没有执行 RPC 或读取学生汇总 |
| course-specific class snapshot | service 参数和 SQL没有 courseId | FAIL | 当前快照是 app/roster 范围，不能宣称针对某课程 |
| course 关联读取来源 | TeacherPracticeInsights 中 unit → chapter → lesson → course 关系，review/progress 查询 | PASS | 还需严格 course/time/coverage 最小投影 |
| Teacher 越租户／越 roster 运行验证 | 无合成账号／roster fixture | BLOCKED | 本次仅静态检查，不做真实账号数据探测 |

[getTeacherAssignedStudentIds][ASSIGN] 提供指派学生范围。[class snapshot service][CLASSSERVICE] 传 tenantId、appId、studentId、now，没有 courseId。[snapshot SQL][CLASSSQL] 从 `auth.uid()` 确认 actor，检查 active profile / membership / teacher、当前 tenant、app `view_analytics` capability、teacher-student app access，并结合 enrollment 与有效状态构造 roster。

[TeacherPracticeInsights][INSIGHTS] 已有按 assigned student IDs、tenant、app 读取 practice/review 的路径及 course 关联，因此不是 Teacher 业务数据完全缺失。但 app 汇总覆盖多个课程时，不能将其作为某一课程的证据；课程缺数据也不能回退为未标注的全应用统计。现有姓名、账号等 UI 字段不应整包送模型。

Teacher MVP 可以基于这些授权事实继续定义只读合同；没有证据支持直接把当前页面 loader 当成已验收的 Agent Tool。无需虚构项目已经拥有正式 class 实体或 course-specific roster 数据模型。

## 14. Database Runtime Feasibility

### 本次实际读取

仓库有 443 个 migration 文件。E05 使用 Supabase REST OpenAPI GET，HTTP 200，仅查看暴露表定义和 RPC 名称，未执行 SQL/DML/RPC。当前本地 Docker 有 PostgreSQL 17.6 系列实例；这不自动证明被查询 endpoint 的远端 PostgreSQL 精确版本或 migration 执行权限。

五个目标表在本次取得的 **暴露 public OpenAPI definitions 中均未出现**：`agent_definition_versions`、`agent_conversations`、`agent_messages`、`agent_runs`、`agent_run_events`。这不是对不可见 schema 的全库不存在断言，也不意味着应在本阶段创建它们。

### 项目内真实模式

| 所需基础 | 项目证据 | Status | 证明范围 |
|---|---|---|---|
| migration 方式 | 已有顺序 SQL migration，事务块与权限声明 | PASS | 仓库机制存在；本次未执行／验证新 DDL 权限 |
| tenant_id 与 tenant scope | tenant migration、业务表及 E05 metadata | PASS | 已有约束/触发器模式；新表仍要单独定义 |
| UUID / JSONB / unique | usage、session、publication SQL | PASS | 项目实际采用，不是仅推测 PostgreSQL 能力 |
| append-only audit | harden agent operations 与 immutable publication history trigger | PASS | 已有实现模式；不是新 Run events 现成实现 |
| transaction / RPC / lock / CAS | publish_runtime_snapshot_v1 定义；E05 确认 RPC 名称暴露 | PASS | 源码含原子事务与预期版本检查；未运行并发测试 |
| 新 AgentRun admission 已可执行 | 无对应表/RPC证据 | FAIL | 不能声称 run 并发／预算控制已可直接调用 |
| 新 migration 执行权限、rollback、并发正确性 | 未执行写操作 | UNKNOWN | 需后续隔离环境验证 |

[publication migration][PUBLISHSQL] 的 RPC 使用 `SECURITY DEFINER` 和固定 search_path，先 guard actor/resource，执行 `pg_advisory_xact_lock` 与 `FOR UPDATE`，比较 expected snapshot/generation，冲突抛出 40001，并在同一事务中更新 pointer/history。权限在函数级 revoke/grant，部分服务端专用 RPC 只允许 service_role 执行；调用方仍必须建立可信 actor。这是项目中可追踪的“受控服务端 + 原子 RPC”先例，不是让模型直接拥有 service role。

[tenant migration][TENANTSQL] 包含 tenant_id 及 scope 约束模式；[agent operations hardening][OPSSQL] 对操作、失败、模型变化等日志使用 append-only 触发器。五表设计可以遵循现有工程机制，但旧 trigger/RLS 不会自动作用于未来新表。

### 实现可行性判断（非运行 PASS）

| 目标 | Feasibility | 当前证据／缺少什么 |
|---|---|---|
| 五表 logical foundation | FEASIBLE | UUID、tenant、JSONB、FK、审计与 migration 路径具备；未来 DDL、权限及版本合同仍需编写验收 |
| conversation-level concurrency | FEASIBLE WITH NEW RPC | 可参考项目已有事务锁模式；没有现成 AgentRun admission |
| idempotency | FEASIBLE WITH NEW RPC | 项目已有 unique 与预期状态比较；需要新请求 key/归属/重复响应的原子合同 |
| budget reservation | FEASIBLE WITH NEW RPC | 现有 usage 是事后统计，不是预算预留；需要同事务占额与结算机制 |
| terminal CAS | FEASIBLE WITH NEW RPC | 已有 publication CAS 先例；Run cancel/complete/fail 竞争尚未实现 |
| 数据库 Run 运行验收 | UNKNOWN | 没有运行新 SQL、锁竞争、重放、崩溃恢复或越权测试 |

因此 **G13 的运行验证状态为 UNKNOWN，实现可行性为 FEASIBLE WITH NEW RPC**。不能把“数据库支持事务”简化为“AgentRun 正确性 PASS”。

## 15. Observability & Usage Feasibility

### 当前暴露的持久化资产

| 表 | E05 确认的相关字段 | 可以复用的事实 | 不能替代什么 |
|---|---|---|---|
| ai_token_usage | id、user_id、tenant_id、provider、model、input_tokens、output_tokens、total_tokens、feature_code、agent_code、created_at | 已有按 provider/model/user/tenant/feature 计量维度 | 不是 AgentRun、ModelCall ledger 或预算事务 |
| learning_agent_messages | session_id、role、intent、content、action、provider、model、input_tokens、output_tokens、agent_profile_id、created_at | 旧聊天／教学消息与部分 usage | 一条消息不能天然映射多个模型调用与 Tool spans |
| guide_agent_failures | agent_profile_id、session_id、user_message_id、stage、error_code、provider、model、public_message、duration_ms、details、created_at | Guide 阶段失败与耗时记录 | 没有全量成功 Run、多 ModelCall/Tool 事件 |
| guide_agent_operation_logs | actor_id、action、target_type、target_id、summary、details、created_at | 配置操作审计 | 不是请求执行 trace |
| learning_agent_model_change_logs | agent_profile_id、changed_by、previous/next provider/model、created_at | 模型配置变更审计 | 不能恢复历史 prompt/context/执行细节 |

证据：[usage 原始表][USAGESQL]、[provider usage 扩展][USAGEPROVIDER]、[Guide failure 写入][GAPI]、[日志 hardening][OPSSQL]，加 E05 当前 metadata。Wrangler observability enabled 是 Worker 配置，不证明当前 Node Agent 有 tracing。

**现有 AI Observability 不足以直接承担 Run tracing：FAIL。现有 usage/操作审计资产存在：PASS。**

### 本次真实 usage 可得性

| ModelCall 场景 | Status | Provider reported usage | 持久化情况 |
|---|---|---|---|
| Tool planning 完成 | PASS | input 304 / output 38 / total 342；接近流末尾 | 未写 DB |
| Final 完成 | PASS | input 94 / output 2 / total 96；接近流末尾 | 未写 DB |
| 两次已完成调用合计 | PASS | input 398 / output 40 / total 438 | 仅本报告记录，非生产统计 |
| 客户端取消 | FAIL | reported usage unavailable；不等于零 token | 未估造、未写 DB |
| Provider error / 429 / 5xx | UNKNOWN | 本次没有这些响应 | 未测试 |
| 币值成本 | UNKNOWN | 没有取得可用于本次结算的价格快照／账单；未以 token 数假装实际费用 | 未估造 |

E04 证明未来可按 ModelCall 分别收集成功调用的 usage，再关联 Run；不保证所有取消／失败场景都返回 usage，也不能用 final 一次 usage 覆盖 planning 的消耗。

### EXTEND 的边界

`ai_token_usage` 应 **EXTEND**，保持其计量用途；不能把它直接当 AgentRun。本阶段不设计最终 migration。未来需要能够关联 runId/modelCallId、definition/prompt/context 版本、调用状态、reported/unknown usage 来源、开始结束与耗时、终止原因；如需要计费还需要价格版本、币种和可追溯计算依据。Tool、permission、retry 和 lifecycle event 应有对应执行事实，不能靠 usage 一行重建。

旧行没有保存的 run/span/call 关联、完整 prompt/context 快照、取消最终 token、价格版本和漏记调用无法可靠回填。必须保留 legacy/unknown 语义，不按时间相近强造关系，也不把未知消耗写成 0。

## 16. Runtime Budget Smoke Test

**SMOKE TEST ONLY。完整 Tool 闭环样本 N=1，不能称生产 p95、并发性能或教学任务可靠性基准。**

| 阶段 | 实测 | Status | 范围 |
|---|---:|---|---|
| Planning model call | 1203.0 ms | PASS | 小型 echo fixture，流式工具规划 |
| Synthetic Tool | 0.006 ms | PASS | 纯内存 echo；没有真实 DB、鉴权、课程查询 |
| Answer headers | 184.7 ms，相对第 2 次请求 | PASS | 不是首个文本 token |
| Answer first text | 692.0 ms，相对第 2 次请求 | PASS | 仅该合成回答 |
| Answer completion | 759.3 ms | PASS | 两个输出 token |
| 两模型调用完整闭环 | 1963.1 ms | PASS | 含本地 Tool/请求编排；不含生产 intake/persistence |
| Persistence overhead estimate | 无可验证数值 | UNKNOWN | 本阶段禁止落库测试；只读 metadata RTT 不能替代写事务开销 |
| Node 长连接 | 第二帧约 46003 ms，总观测 46032.5 ms | PASS | E03 独立 listener + Next stream 基础；没有代理／DB／Provider |
| 生产完整 Run ≤45 秒 | 未测 | UNKNOWN | 无正式 Core、真实只读 Tool、持久化及代理路径验收 |

E03 长连接第一帧约 3.7 ms、第二帧约 46003 ms，没有中止；证明宿主不会普遍在 45 秒前终止所有连接。它不证明现有生产代理、Edge Function 或新 Core 的截止策略。

45 秒作为后续 bounded Run 上限有 smoke 证据支持，并无本次样本显示模型单次已经超过目标。但真实教材上下文、较长回答、冷启动、DB 竞争、重试都会改变时延；剩余时间不能全部分给模型。当前 Edge 的每次 45 秒 timeout 不等于新 Run 的累计 45 秒 deadline。

本阶段没有为 persistence 给出虚构的毫秒数，也没有进行压测。后续验收必须覆盖真实但合成的 context/read port、admission 与 terminal persistence，并记录超时后是否仍发生写入／模型输出。

## 17. Go / No-Go Gate Matrix

| Gate | Status | Evidence | Impact | Required Action Before Build Stage 0B |
|---|---|---|---|---|
| G01 Runtime host | PASS | E01：PM2 online、release cwd、Node PID/端口、production launcher、HTTPS login | 已有明确首版宿主 | 将首版 scope 固定为该 Next Node 路径；不要默认 Worker |
| G02 Node compatibility | PASS | E03：ReadableStream、fetch、Next signal/pipe、46 秒连接 | 可开始 Node Composition Root 合同 | 保留 request-scoped composition 与 signal/deadline 合同 |
| G03 Streaming | BLOCKED | E03 isolated NDJSON PASS；生产完整 Browser/Next/Edge/Provider/代理未测 | 不阻止合同；阻止声称学生端 streaming 已验收 | 将完整无副作用 fixture 的生产路径测试保留为 Student MVP Gate |
| G04 Abort capability | PASS | E03 signal/stream cancel；E04 fetch AbortError | 宿主可做；旧业务链仍 FAIL | 明确 host PASS 与旧链未接线；合同要求传播，不复用旧取消语义 |
| G05 Qwen tools | BLOCKED | DASHSCOPE_API_KEY NOT SET；0 请求 | Qwen 不能作为已验证首个 Provider | 首版以已验证 DeepSeek 为基线，Qwen 不作为 0B 前置条件 |
| G06 Qwen tools + streaming | BLOCKED | 无 Qwen live response | 同上 | 明确保留 Qwen 未验证状态 |
| G07 DeepSeek tools | PASS | E04 两请求真实工具闭环、10 段参数、final 匹配 | 第一种真实 Tool Provider 已证明 | 固定受测 model + thinking disabled 的验证范围 |
| G08 Provider usage | PASS | E04 planning/final 独立 usage | 可以定义 per-call ledger；取消 usage 缺失另记 FAIL | 合同允许 reported usage unavailable；不把未知计为零 |
| G09 Auth composition | PASS | getAuthContext 现有 Route 调用；E02 401 | 可信 request intake 可复用 | tenant null / app / resource / role 仍需明确拒绝和投影规则 |
| G10 Student segment binding | FAIL | E05/E07 + SCRIPT/LOADER/UI：游标存在但无实时一致绑定 | 当前句子不能直接按 verified_current 上线 | 0B 合同保持 verified_selection；明确服务端核验、stale 语义 |
| G11 Read-only domain ports | FAIL | 源数据与纯函数存在；专用安全两 Tool port 不存在 | Student MVP 前需新增，只能参考现有查询 | 在 0B 标注 NEW port；禁止调用 respond 作为读取工具 |
| G12 Teacher scope data | PASS | ASSIGN/CLASSSQL + E05：roster、capability、enrollment 来源 | Teacher 合同有真实数据基础 | 显式 app-level；不能把 snapshot 声称为 course-level |
| G13 Database Run feasibility | UNKNOWN | 项目 lock/CAS/RPC 先例；新 admission 未实现、未运行 | FEASIBLE WITH NEW RPC；不是现成事务能力 | 标注待建原子边界与后续验收；无需为写合同先执行 migration |
| G14 Trace/usage feasibility | PASS | E05 元数据 + E04 completed-call usage | 有可扩展资产；完整 Run tracing 尚缺 | 保持 EXTEND + 独立 Run/Call 关联；未知旧行不伪回填 |
| G15 45s budget | PASS | E04 1.963 秒单闭环；E03 46 秒宿主连接 | 仅 smoke feasibility；生产预算 UNKNOWN | 保留 45 秒上限为待完整验收目标，不宣传 p95 |

G08/G14 的 PASS 是“已获得可用于未来计量的事实”，不是完整计费／trace 系统 PASS。G15 是小样本可行性 PASS，不能覆盖 G03。G10/G11 的 FAIL 是当前成品能力不满足，而非底层无数据或无法继续设计合同。

## 18. Blockers

### A — Must resolve before Stage 0B

**在本报告限定的 Node + DeepSeek + Core Contracts & Foundation 范围内，没有仍未解决的 A 类环境阻断项。**

这个结论依赖范围：不要求 Qwen 同时通过、不把 Worker 当已验证宿主、不把 0B 等同 Student MVP。如果改为“必须 Qwen-first”或“必须 Worker-first”，相应凭证／部署能力 Gate 会成为那个新范围的前置阻断；本阶段没有这样的证明。

### B — Must resolve before Student MVP

| 项目 | 当前状态 | 为什么必须在学生路径前解决 |
|---|---|---|
| 已认证的完整 NDJSON／代理验证 | BLOCKED | 需安全 fixture，证明逐帧而非缓冲；当前 login 和 isolated harness 不足 |
| UI → Next → Core → Provider/Tool 取消传播 | FAIL | 旧链只有局部取消；还需断开、deadline、终态行为验收 |
| verified_selection 服务端绑定 | FAIL | 当前没有新绑定 validator；不能相信客户端句子或把陈旧游标当当前播放 |
| 两只 read-only domain ports | FAIL | 需 scope、enrollment、发布版本、字段白名单与 stale 行为；不能用有写入的 respond |
| Student/tenant/app/resource 正向和拒绝 fixture | BLOCKED | 尚未做真实运行隔离验收；service role 不能替代用户授权 |
| Run admission / idempotency / reservation / terminal CAS | UNKNOWN | 新 RPC 未实现、未测，UI 锁和普通多次 insert 不构成事务保障 |
| Run/ModelCall usage 与终态 trace | FAIL | 当前日志不能完整对应多次模型调用；取消 usage 必须保持未知 |
| 完整 45 秒预算、持久化与失败路径 | UNKNOWN | 本次短 echo 和 46 秒连接不覆盖真实运行工作量 |

这些是后续实现／验收工作，本次均未修复或创建。

### C — Can defer

| 项目 | 当前状态 | 可推迟的范围 |
|---|---|---|
| Qwen tools / tools+stream | BLOCKED | DeepSeek 首批可继续；Qwen 接入前重新验证 |
| OpenNext/Worker 运行资格 | UNKNOWN | 不影响已确认 Node-first；迁移到 Worker 前必须验证 |
| 其他型号、thinking enabled、Structured Output、并行工具 | UNKNOWN | 非本次受测 MVP 合同，使用前另开能力验收 |
| Teacher course-specific summary | FAIL | 可推迟到 Teacher MVP；app-level 统计不得先冒充课程证据 |
| Teacher 授权运行验收 | BLOCKED | 缺少安全角色 fixture；Teacher MVP 前需要完成 |
| 取消远端停止确认与精确费用 | UNKNOWN | 可推迟供应商账单对账；Student MVP 仍必须明确记录 usage unknown 并限制预算 |
| 全量 production benchmark / p95 | UNKNOWN | 不阻断 0B；上线前仍需基本时限与失败验收，不能拿本 smoke 当负载证明 |

## 19. Architecture v1 Assumption Validation

本表验证原架构假设，不重写或修改 Architecture v1。

| 假设 | Validation | 当前依据 | Revision Recommendation / 后续限制 |
|---|---|---|---|
| 1. Shared Agent Core Runtime | SUPPORTED BUT NOT VERIFIED | 宿主与真实模型 Tool 协议可行；没有新 Core | 继续合同阶段；不可称共享 Core 已上线 |
| 2. Next Node Composition Root | CONFIRMED | 在线 Node production + 现有 auth Route + E03 | 结论限此宿主；Worker 需独立验收 |
| 3. Qwen / DeepSeek Provider Adapter | SUPPORTED BUT NOT VERIFIED | DeepSeek协议通过；Adapter未实现；Qwen BLOCKED | DeepSeek-first，固定受测配置；Qwen 能力不作默认承诺 |
| 4. POST + NDJSON Runtime Events | SUPPORTED BUT NOT VERIFIED | E03 POST NDJSON 逐帧；生产完整链 BLOCKED | 保留协议方向，补全部署链测试后才能放行学生端 |
| 5. Abort propagation | SUPPORTED BUT NOT VERIFIED | Next signal 与 Provider fetch 可取消；旧链未贯通 | 合同覆盖每个异步边界与 deadline；本地取消不宣称远端计费停止 |
| 6. Real Tool Calling | CONFIRMED | E04 实际 tools → call → local result → 第二次模型 → final | 只证明单工具合成闭环，不是领域 Tool 授权验收 |
| 7. 45-second bounded Run | SUPPORTED BUT NOT VERIFIED | 1.963 秒 smoke + Node 46 秒连接 | 仍需整个 Run 的预算／持久化／代理验证 |
| 8. Student segment grounding | SUPPORTED BUT NOT VERIFIED | 原架构已有 verified_selection fallback；服务端游标事实已核实 | 保持 verified_selection 首批；若将 verified_current 当默认则 NEEDS REVISION；新核验器未实现 |
| 9. Teacher assigned-roster scope | SUPPORTED BUT NOT VERIFIED | assignment、capability、enrollment、snapshot SQL/metadata | roster 来源成立；课程投影与合成角色测试未完成 |
| 10. Five-table logical foundation | SUPPORTED BUT NOT VERIFIED | 项目已有 tenant/UUID/JSONB/RPC/append-only 模式 | FEASIBLE WITH NEW RPC；不把五表存在或权限生效当事实 |
| 11. ai_token_usage extension | CONFIRMED | 现有字段与 per-call usage实测；明确缺少Run关联 | 确认 EXTEND 判断；不是新字段和迁移已完成 |
| 12. Script Runtime remains authoritative | CONFIRMED | 现有 SCRIPT/Route 执行状态转换，教材恢复依赖其状态 | 保留领域权威；Agent read port 不调用推进 Route、不让模型代写教学状态 |

第 3 项中 **Qwen 的具体能力子假设为 BLOCKED**；复合 Adapter 方向可继续，不等于两个 Provider 都已确认。以上“CONFIRMED”表示相应事实或设计依据获支持，不把尚未实现的未来模块登记为现状。

## 20. Required Changes Before Stage 0B

本阶段没有需要通过“先修改线上代码／配置”才能解除的 A 类阻断。开始下一阶段前，应以本报告固定以下合同边界；这是待做事项记录，不是本次实施授权：

1. 将 Stage 0B 限定为 Core Contracts & Foundation，宿主依据为已确认的 Next Node release 路径；不承诺 Worker 已通过。
2. 将 Provider 能力基线写成 `deepseek-v4-flash` + thinking disabled 的真实受测组合；Qwen tools/stream 保持 BLOCKED，避免凭 allowlist 实现能力声明。
3. 保持 Student 第一批 `verified_selection` 与服务端核验要求；把现有 server cursor、当前播放、用户选句视为不同事实；无 revision 对齐不承诺 verified_current。
4. 在合同里明确两只 Student Tool 依赖 NEW read-only domain ports；不得通过 `/api/learning-agent/respond` 提供读取。
5. AuthContext 必须来自 Next request 的 verified user/active tenant；平台或 legacy tenant-null 不能自动进入租户 Agent；Teacher app-level snapshot 不提升成 course evidence。
6. 保留未来 Run admission、幂等、预算预留、terminal CAS 的原子边界及后续隔离环境验证；当前未实现不能被标成 PASS，也不需要在 0B 前违规执行 migration。
7. Usage 合同区分 completed reported usage、cancelled usage unknown 和估算；运行事件、ModelCall 与 Run 不合并成现有 token usage 一行。
8. 记录 B 类验收清单：真实部署 NDJSON、完整取消、授权 fixture、领域投影、事务竞争、45 秒全过程；不以本次宿主 smoke 替代。

没有修改既有架构文档来消除 Unknown，也没有为这些条目创建 Core、Tool、Skill、API 或 SQL。

### 工作树与清理核对

本阶段开始时工作树已存在其他任务的修改；不能把当前 `git status` 非空解释为本任务修改业务文件。开始时以下 6 个 tracked 文件已有 diff：

- `src/features/growth-toolbox/components/growth-toolbox-listing.tsx`
- `src/features/growth-toolbox/components/toolbox-items-table/columns.tsx`
- `src/features/growth-toolbox/components/toolbox-items-table/index.tsx`
- `src/features/learning-agent-script-studio/ChapterReleaseCheckPanel.tsx`
- `src/features/learning-agent-script-studio/TeachingScriptNodeForm.tsx`
- `src/features/learning-agent-script-studio/TeachingScriptStudio.tsx`

另有已存在的未跟踪文档、证据、脚本和构建目录，全部保留。E08 对 tracked + nonignored untracked 的既有路径内容做排序摘要，排除本报告：2660 个普通文件，SHA-256 `ba532473eaa103faf84556f59eaf0d3d6803cefd3cbddf99fb9ac013b5519da5`。结束核对与开始基线完全一致；已有 6 个 tracked diff 维持 80 insertions / 89 deletions。本次唯一新增交付物是本报告。

报告结构检查为规定的 21 节，全部本地证据链接指向存在文件且行号有效；敏感凭证模式检查未命中，报告无行尾空格，`git diff --check` 通过。两份输入文档的结束 SHA-256 与第 2 节一致。

校验方法：按 Git 路径排序，将路径与 NUL 分隔写入摘要；普通文件写入内容 SHA-256，符号链接记录目标，缺失路径记录 MISSING。该聚合摘要用于防止只看 diff 遗漏既有未跟踪文件；不包含 ignored runtime/cache 文件，不声称后台进程绝无自发写入。

临时测试全部通过 heredoc 执行，未产生 `/tmp/uply-agent-verification-*` 文件；隔离 HTTP listener 已关闭。没有安装依赖、没有 source build/test 产生业务产物、没有迁移、没有数据库或线上配置写入。

## 21. Final Recommendation

**Overall：CONDITIONAL GO。Stage 0B：READY，仅指可以开始 Core Contracts & Foundation；本任务到此停止。**

| 必答问题 | 结论 |
|---|---|
| 1. 当前真实 UPLY Runtime 是什么？ | 本机 PM2 `uply-first-enable` 管理 Next Node production，127.0.0.1:3000，经当前 Tailscale HTTPS 8443 入口可访问；Worker 生产部署 UNKNOWN。 |
| 2. Next Node Composition Root 是否可行？ | PASS；真实宿主、既有 Route auth 和 Node/Next 流能力有证据。新 Composition Root 尚未创建。 |
| 3. POST + NDJSON streaming 是否已被环境证明？ | 隔离 Node/Next 基础 PASS；现有生产 Browser→Next→Edge/Provider→代理完整链 BLOCKED，不能整体声称已证明。 |
| 4. Abort propagation 是否可实现？ | 宿主能力 PASS；现有链未完整传播；代理与远端停止行为 UNKNOWN。 |
| 5. 当前 Qwen 配置是否真实支持 Tool Calling？ | BLOCKED — credential unavailable；0 次请求，selected model UNKNOWN。 |
| 6. Qwen tools + streaming 完整闭环？ | BLOCKED；没有实测。 |
| 7. DeepSeek 当前状态？ | published 配置为 deepseek-v4-flash；thinking disabled 下真实工具流闭环 PASS；完成 usage 可得，取消 usage unavailable。 |
| 8. 哪个 Provider 最适合首个 Student MVP？ | 基于本次可用性证据，DeepSeek deepseek-v4-flash，明确使用受测参数；不代表已验证教学质量或负载。 |
| 9. 服务端能否可靠绑定当前 segment？ | 保存 server segment cursor 是事实；可靠对应当前播放不能保证。首版 verified_selection，需新增服务端核验。 |
| 10. 两个 Read Tools 是否有安全数据来源？ | 有已发布内容、纯分句、本人 session 的读取基础；没有可直接放行的完整安全 port，需要 NEW read projections。 |
| 11. Supabase 能否支撑 Run/幂等/并发？ | FEASIBLE WITH NEW RPC；项目已有受控事务锁/CAS先例。新 Run 运行验证 UNKNOWN，不是已验收。 |
| 12. 是否可以进入 Stage 0B？ | READY，条件与 B 类上线 Gate 已列明；不进入 Student MVP、部署或数据库实施。 |

<!-- Evidence links use absolute local paths to the inspected workspace. -->
[AUDIT]: /home/yangzhen/projects/my-lms-system/docs/assistant-current-state-audit.md
[ARCH]: /home/yangzhen/projects/my-lms-system/docs/teaching-agent-architecture-v1.md
[START]: /home/yangzhen/.config/uply-first-enable-20260910/start.mjs:10
[PKG]: /home/yangzhen/projects/my-lms-system/package.json
[NEXTCONFIG]: /home/yangzhen/projects/my-lms-system/next.config.ts
[COMPLETION]: /home/yangzhen/projects/my-lms-system/ecosystem.completion-worker.cjs
[WRANGLER]: /home/yangzhen/projects/my-lms-system/wrangler.jsonc
[OPENNEXT]: /home/yangzhen/projects/my-lms-system/open-next.config.ts
[NEXTRUNTIME]: /home/yangzhen/projects/my-lms-system/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/runtime.md
[SELFHOST]: /home/yangzhen/projects/my-lms-system/node_modules/next/dist/docs/01-app/02-guides/self-hosting.md:239
[NEXTREQUEST]: /home/yangzhen/projects/my-lms-system/node_modules/next/dist/server/web/spec-extension/adapters/next-request.js:43
[NEXTPIPE]: /home/yangzhen/projects/my-lms-system/node_modules/next/dist/server/pipe-readable.js
[GAPI]: /home/yangzhen/projects/my-lms-system/src/app/api/agent-chat/route.ts:90
[LAPI]: /home/yangzhen/projects/my-lms-system/src/app/api/learning-agent/respond/route.ts:225
[GEDGE]: /home/yangzhen/projects/my-lms-system/supabase/functions/guide-agent-runtime/index.ts:40
[LEDGE]: /home/yangzhen/projects/my-lms-system/supabase/functions/learning-agent-runtime/index.ts:247
[MODELOPTIONS]: /home/yangzhen/projects/my-lms-system/src/features/model-usage/model-options.ts:1
[LUI]: /home/yangzhen/projects/my-lms-system/src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx:4916
[SCRIPT]: /home/yangzhen/projects/my-lms-system/src/lib/learning-agent-script-runtime.ts:336
[SEG]: /home/yangzhen/projects/my-lms-system/src/lib/teaching-video.ts:27
[LOADER]: /home/yangzhen/projects/my-lms-system/src/lib/smart-digital-textbook.ts:474
[AUTH]: /home/yangzhen/projects/my-lms-system/src/lib/auth.ts:97
[SUPASERVER]: /home/yangzhen/projects/my-lms-system/src/lib/supabase/server.ts:1
[STUDENTPERM]: /home/yangzhen/projects/my-lms-system/src/lib/student-permissions.ts:40
[ADMIN]: /home/yangzhen/projects/my-lms-system/src/lib/admin.ts:195
[APPLAYOUT]: /home/yangzhen/projects/my-lms-system/src/app/dashboard/StudentAppRouteLayout.tsx:11
[ASSIGN]: /home/yangzhen/projects/my-lms-system/src/lib/student-assignments.ts:61
[CLASSSERVICE]: /home/yangzhen/projects/my-lms-system/src/features/teacher-class-today/api/service.ts:16
[CLASSSQL]: /home/yangzhen/projects/my-lms-system/supabase/migrations/202608190021_teacher_class_today_snapshot.sql:6
[INSIGHTS]: /home/yangzhen/projects/my-lms-system/src/features/teacher-practice-insights/teacher-practice-insights.tsx:212
[PUBLISHSQL]: /home/yangzhen/projects/my-lms-system/supabase/migrations/202609100001_runtime_publish_foundation.sql:65
[OPSSQL]: /home/yangzhen/projects/my-lms-system/supabase/migrations/202609040004_harden_agent_operations.sql:154
[TENANTSQL]: /home/yangzhen/projects/my-lms-system/supabase/migrations/202607210001_tenant_id_on_business_tables.sql
[USAGESQL]: /home/yangzhen/projects/my-lms-system/supabase/migrations/202607200001_ai_token_usage.sql
[USAGEPROVIDER]: /home/yangzhen/projects/my-lms-system/supabase/migrations/202608260003_split_ai_usage_by_provider.sql
