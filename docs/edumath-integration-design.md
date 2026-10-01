# EduMath 数学仿真接入设计

> 状态：设计稿，未实施（2026-09-30，分支 `feat/subject-slots`）
> 依据：只读审阅 `~/projects/edumath`（提交 `16d2e12`）的计划书 v1.1 第 2.1、9、12、15 节与附录 B，以及 `packages/embed-sdk` 源码；只读核对本项目现状。未修改任何一方的代码。
> 关联：[共享平台 + 学科模块架构](./shared-platform-subject-modules-architecture.md)、[课程与课时界面插槽设计](./course-lesson-experience-slot-design.md)。

## 1. 分工与边界

EduMath 是独立服务（AI 数学仿真生成器），不是另一个 LMS。双方职责按其计划书第 2.1 节：

| 职责 | LMS（本项目） | EduMath |
|---|---|---|
| 用户、机构、权限 | 权威来源 | 只接收签名的身份声明 |
| 课程、课时、学习进度 | 负责 | 不负责 |
| 学生学习事件 | 接收、存储、分析 | 只通过 postMessage 转交，不存个人数据 |
| 仿真生成、校验、版本、发布 | 不负责 | 负责 |
| 仿真运行 | 只放 iframe | 嵌入页（独立域名、沙箱） |
| 仿真引用 | 保存 `publication_id` / 嵌入地址 / 版本 | 不负责 |

在本项目内的分层：

- **平台层新增“外部互动内容接入”**：iframe 宿主、消息校验、Launch Token 签发、引用存储、事件入库。它不绑定数学，以后其他学科的仿真也可以复用。
- **数学学科模块**：注册“仿真课时”界面（通过[课程与课时界面插槽](./course-lesson-experience-slot-design.md)），在课时里使用平台的接入能力；数学管理端提供“添加数学仿真”的入口。
- **数学判题不在本设计内**：它属于“题型与判题器插槽”，是否复用 `@edumath/math-core` 另行决定（架构文档第 8 节第 5 项）。

## 2. EduMath 侧的约定（以 SDK 代码为准）

### 2.1 嵌入页与安全模型

- 嵌入页部署在独立域名，不使用 Cookie；地址有两种：`/embed/p/{project_public_id}`（跟随当前发布，默认使用）与 `/embed/v/{publication_id}`（固定版本，适合考试）。
- iframe 固定为 `sandbox="allow-scripts"`，**不给 `allow-same-origin`**，仿真运行在不透明源中，发来的消息 `event.origin` 为字符串 `"null"`。
- 宿主识别消息来源靠**对象身份**：`event.source === iframe.contentWindow` 且 `origin === "null"`，再用严格解析器校验内容；任何一项不符都静默忽略。SDK 已提供 `createEmbed`、`acceptSimMessage`、`isFromEmbeddedFrame`、`checkEmbedSrc`。
- 嵌入页 CSP 的 `frame-ancestors` 只允许登记过的主平台域名。

### 2.2 postMessage 协议 v1（`protocol: "edumath-sim"`）

| 方向 | 类型 | 内容（SDK 代码） |
|---|---|---|
| 宿主 → 仿真 | `host:init` | 可选 `locale`、`theme`、`learnerRef`（匿名标识，1–128 字符） |
| 仿真 → 宿主 | `sim:ready` | `publicationId`、`simulationType` |
| 仿真 → 宿主 | `sim:resize` | `height` |
| 仿真 → 宿主 | `sim:event` | `event: "param_change"`、`payload{param, from, to, source}`、`ts` |
| 仿真 → 宿主 | `sim:complete` | `payload{rule, value}`、`ts` |
| 仿真 → 宿主 | `sim:error` | `code`、`message` |

注意：计划书附录 B.5 的示例与代码不一致（`sim:ready` 示例写 `simulationId`，代码要求 `simulationType`；`sim:complete` 代码要求 `ts`，示例没有）。**对接以 SDK 代码为准**，建议 EduMath 侧同步更新计划书。

### 2.3 Launch Token（教师进入 Studio 的一次性凭证）

- 由 LMS 用私钥签发短期 JWT（≤ 5 分钟、一次性），EduMath 通过 LMS 公布的 JWKS 验签。
- 载荷（附录 B.6）：`iss`、`aud`、`sub`（LMS 用户引用，不含姓名）、`tenant_id`、`role`、`lesson_id`、`return_url`、`jti`、`iat`、`exp`。
- `return_url` 必须匹配 EduMath 侧为该机构登记的域名白名单。

### 2.4 服务间调用

每个接入平台分配 `client_id` + 密钥，用 OAuth 2.0 Client Credentials 换取短期令牌调用 API（查询仿真、版本、发布等），写接口支持 `Idempotency-Key`。

## 3. LMS 侧现状（只读核对）

| 项目 | 现状 | 影响 |
|---|---|---|
| 对接代码 | 没有任何 EduMath 相关代码 | 全部新增 |
| 全站 CSP | 没有（只有 `/sw.js` 设置了 CSP） | iframe 目前不会被拦；以后加 CSP 时必须把 EduMath 嵌入域名写进 `frame-src` |
| JWT 签发 | 没有相关库 | Cloudflare Workers 自带 WebCrypto，可直接用 ES256 签名，不一定新增依赖 |
| 学习事件表 | 只能由数据库触发器写入；分类只允许 `course / task / practice` | 仿真事件需要新增记录表与触发器（数据库改动） |
| 智能教材块类型 | 封闭的 25 种，无“仿真”块；运行时属于 Codex 线 | 第一版不做成教材块，改为课时级嵌入 |
| 数学应用 | 学科清单已存在，机构中为“即将上线” | 可以在不影响学生的前提下开发 |

EduMath 侧现状：`packages/embed-sdk` 已实现并有测试；学生嵌入页 `apps/embed` 仍为空目录，是学生端上线的前置条件。

## 4. 设计

### 4.1 模块布局（示意）

```
src/features/external-content/          平台层：外部互动内容接入
├── contracts.ts                        引用、事件、提供方类型（纯类型）
├── providers.ts                        已登记提供方（edumath）：嵌入域名、Studio 域名、协议版本
├── server/
│   ├── launch-token.server.ts          Launch Token 签发（WebCrypto ES256，import "server-only"）
│   ├── provider-client.server.ts       服务间调用（Client Credentials）
│   ├── embed-refs.server.ts            引用读写（服务端校验归属）
│   └── embed-events.server.ts          学生事件记录（服务端核对权限）
└── components/
    └── ExternalEmbedFrame.tsx          客户端组件：封装 SDK 的 createEmbed / acceptSimMessage

src/app/api/integrations/edumath/jwks/route.ts   公布公钥（JWKS）

src/features/subjects/math/
├── experience.server.tsx               “仿真课时”界面，使用 ExternalEmbedFrame
└── （管理端）添加仿真入口
```

### 4.2 教师添加仿真

```
数学管理端课时页 ──点击“添加数学仿真”──▶ LMS 服务端操作
   1. 核对：平台负责人，或机构中对数学应用有“管理内容”能力的员工；课时属于数学应用
   2. 签发 Launch Token（sub、tenant_id、role、lesson_id、return_url、jti、5 分钟）
   3. 返回一次性 Studio 地址
教师在 Studio 中生成、预览、编辑、发布
   ──▶ 返回 simulation_id / 嵌入地址（弹窗 postMessage，来源为 Studio 真实域名；或 return_url 跳回）
LMS 服务端操作
   4. 不信任浏览器转交的标识：用服务间令牌向 EduMath 查询该仿真，确认属于本机构、已发布、协议版本兼容
   5. 保存引用（课时、提供方、project_public_id、可选 publication_id、是否锁定版本、标题）
```

### 4.3 学生打开仿真课时

```
数学“仿真课时”界面（服务端）
   1. 平台已完成课时读取、解锁与准入判断（课程插槽约定）
   2. 读取该课时的仿真引用，生成嵌入地址并用 checkEmbedSrc 校验域名在白名单内
   3. 生成 learnerRef：对“租户 + 学生”做带密钥的哈希，不传真实 ID 或姓名
ExternalEmbedFrame（客户端）
   4. createEmbed（sandbox="allow-scripts"、no-referrer），ready 后发送 host:init
   5. 只接受通过 acceptSimMessage 的消息；resize 调整高度；param_change 在本地累计
   6. sim:complete 或离开页面时，调用服务端操作提交一次汇总（完成规则、数值、交互次数、时长）
服务端记录
   7. 核对学生对该课时所属应用的权限、课时已发布、引用属于该课时；按会话幂等写入
   8. 数据库触发器把汇总写入学习事件表（分类 course），进入首页、学习记录与学情统计
```

### 4.4 数据（数学阶段的数据库批次）

- `lesson_external_embeds`：课时、提供方、`project_public_id`、`publication_id`（可选）、是否锁定、标题、创建人；应用归属从课时推导，复用现有归属触发器；RLS：学生按应用权限读取已发布课时的引用，内容管理员维护。
- `external_embed_sessions`：租户、学生、引用、会话标识（幂等键）、完成规则与数值、交互次数、时长、时间；学生只能写自己的会话；触发器写入 `student_learning_activity_events`。
- 不逐条存 `param_change`：频率高且价值低，只存会话汇总。
- 迁移编号排在 Codex 线迁移之后（见[数据库依赖分析](./db-subject-unweld-dependency-analysis.md)第 5 节）。

## 5. 安全要求

| 风险 | 控制 |
|---|---|
| 伪造仿真消息 | 只用 SDK 的来源校验（窗口身份 + `"null"` 源 + 严格解析）；不自行实现 |
| 仿真完成被伪造刷分 | `sim:complete` 来自不可信的浏览器，**只作为学习参与信号**，不作为成绩或结课证据；数学判分由可信判题器完成 |
| 嵌入任意第三方页面 | 嵌入地址只能由服务端生成，并用 `checkEmbedSrc` + 提供方域名白名单校验；引用只保存标识，不保存完整 URL |
| 浏览器转交伪造的仿真标识 | 保存引用前，服务端用服务间令牌向 EduMath 核实归属与发布状态 |
| Launch Token 泄露或重放 | 5 分钟有效、一次性 `jti`、`aud` 固定为 Studio、`return_url` 白名单；私钥只在服务端环境变量中，JWKS 带 `kid` 支持轮换 |
| 学生隐私 | `learnerRef` 为带密钥的哈希，不含姓名与真实 ID；EduMath 不落库个人数据 |
| iframe 权限 | 保持 `sandbox="allow-scripts"`，不得添加 `allow-same-origin`、`allow-top-navigation`、`allow-forms`、`allow-popups` |
| CSP | EduMath 嵌入页 `frame-ancestors` 登记 LMS 实际域名；LMS 以后加 CSP 时 `frame-src` 放行嵌入域名 |

这些属于 AGENTS.md 所列的高风险项（JWT / Launch Token、postMessage、CSP、Sandbox），实施须走 Architecture Gate，并包含负向测试：伪造来源、伪造结构、过期或重放令牌、越权课时、非白名单地址。

## 6. 需要决定的事项

1. **SDK 的引入方式**（2026-10-01 已决定：固定版本拷贝构建产物，附来源与文件指纹，做法同 math-core；EduMath 仿真接入本身暂缓，用户 2026-10-01 说“先不做 edumath”）：`@edumath/embed-sdk` 目前是 EduMath 仓库内的私有包。选项：发布到私有 npm 源；按版本锁定并附哈希拷贝其构建产物；从 EduMath CDN 加载浏览器包。建议前两者之一，不建议运行时从第三方 CDN 加载脚本。
2. **域名与环境**：EduMath 的 Studio / 嵌入页 / API 域名；LMS 需要登记到 `frame-ancestors` 与 `return_url` 白名单的域名（包括 Cloudflare 与 Tailscale 入口）。
3. **密钥管理**：Launch Token 签名私钥、服务间 `client_id` / 密钥的存放与轮换（Cloudflare 机密变量）。
4. **仿真完成是否计入课时完成**：建议只计入学习参与，不自动把课时标记为完成，或只在教师设置后才计入。
5. **`@edumath/math-core` 是否用于 LMS 数学判题**：与题型、判题器插槽一起决定。

## 7. 实施顺序

| 步骤 | 内容 | 前置条件 |
|---|---|---|
| 1 | EduMath 完成学生嵌入页 `apps/embed`；双方确认协议 v1（修正计划书示例） | EduMath 侧 |
| 2 | 决定第 6 节第 1–3 项 | 用户与 EduMath 侧 |
| 3 | 平台层：`ExternalEmbedFrame`（封装 SDK）+ 提供方登记 + 负向测试 | 步骤 1、2 |
| 4 | 数据库：引用表、会话表、触发器、RLS | Codex 线迁移之后 |
| 5 | Launch Token、JWKS、服务间调用，教师添加仿真流程 | 步骤 2；Architecture Gate |
| 6 | 数学“仿真课时”界面（依赖课程与课时界面插槽阶段 3） | 插槽阶段 3 |
| 7 | 端到端验证：教师添加 → 学生学习 → 事件入库 → 首页与学情可见 | 本机库同步与浏览器验证可用 |

步骤 3 的客户端封装与负向测试不依赖数据库，可以较早进行；其余步骤分别受 EduMath 进度、数据库时序与课时插槽约束。
