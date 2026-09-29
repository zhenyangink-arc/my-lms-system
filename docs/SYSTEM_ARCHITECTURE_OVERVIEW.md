# LMS 系统架构总览

> 基于 2026-09-15 工作区的静态盘点。本文件描述系统边界与推荐依赖方向，不替代各专项交付文档。

## 1. 一句话定位

这是一个部署在 Cloudflare 上、以 Next.js App Router 为应用壳、以 Supabase 为认证与数据平台的多租户 LMS。系统同时服务学生、教师、机构管理员和平台管理员，并包含课程、作业评测、智能教材、教学 Agent、学习洞察与留学服务等业务域。

## 2. 系统上下文

```text
学生 / 教师 / 机构管理员 / 平台管理员
                    │
                    ▼
       Next.js 16 + React 19 应用
   页面 / Server Actions / Route Handlers
                    │
        ┌───────────┼────────────┐
        ▼           ▼            ▼
  Supabase Auth  Postgres/RLS  外部媒体与实时服务
        │           │          R2 / Cloudflare Realtime
        └───────统一租户与权限边界───────┘
                    │
                    ▼
         OpenNext → Cloudflare 部署
```

## 3. 当前逻辑分层

| 层 | 当前落点 | 职责 |
| --- | --- | --- |
| 入口与路由 | `src/app` | 页面、布局、加载态、Route Handlers、页面级 Server Actions |
| 业务能力 | `src/features` | 按领域组织的组件、服务、动作、校验与业务流程 |
| 共享领域/基础设施 | `src/lib` | 鉴权、租户、Supabase、课程目录、发布运行时及历史共享服务 |
| 通用界面 | `src/components/ui`、`src/components/layout` | 可复用 UI 原语与全局布局 |
| 数据与安全 | `supabase/migrations` | 表、函数、RPC、RLS、审计和发布约束 |
| 运维与验证 | `scripts`、`tests` | 数据转换、迁移验证、权限验证、领域测试、浏览器测试 |
| 静态与私有资源 | `public`、`private-assets` | 可公开资源与不直接公开的教材媒体 |

当前规模约为：`src/app` 643 个文件、`src/features` 491 个文件、`src/lib` 115 个文件、37 个 Route Handlers、63 个 Server Action 模块、457 个数据库迁移、172 个测试文件和 153 个脚本文件。

## 4. 产品与角色边界

### 学生端

- 首页学习任务、课程与章节学习
- 智能教材与章节专项训练
- 作业、考试、成绩、错题复习
- 学习记录、能力画像、周计划、工具箱
- 会话练习、实时课堂、留学申请辅助

### 教师与机构端

- 课程、章节、教材与题库管理
- 作业、试卷、批改与成绩发布
- 学生、班级、权限与学习洞察
- 教学脚本、教学 Agent 与内容发布
- 公告、资源库、材料与签证管理

### 平台端

- 租户、账号、应用能力和平台权限
- 跨机构统计、模型用量与运营审计
- 平台级课程、内容和应用治理

平台身份不进入租户上下文；普通业务身份由当前有效的 `tenant_memberships` 决定。页面侧鉴权入口是 `getAuthContext()` / `requireActiveUser()`，数据侧最终边界由 Supabase RLS 与受控 RPC 保证。

## 5. 核心业务域

```text
平台控制面
├── tenant-management / accounts / permission-center
├── institution-platform-overview / model-usage
└── platform-learning-insights

教学管理面
├── courses / curriculum-plans / library
├── digital-textbook / learning-agent-script-studio
├── teaching-agent / agent-core / agent-operations
├── chapter-practice / growth-toolbox
└── student-assignments / grades / course-completion

学生学习面
├── student-home-learning / student-current-course
├── smart-textbook-runtime / chapter-practice
├── student-review-center / student-weekly-learning-plan
└── student-ability-portrait / learning-records

延伸服务面
├── announcements / help-center
├── universities / visa-management / document-reviews
└── conversation practice / live classroom
```

## 6. 关键数据流

### 普通页面读取

```text
Browser → App Router Server Component
        → requireActiveUser
        → feature service
        → Supabase user client
        → RLS 过滤后的数据
```

### 业务写入

```text
Client Component → Server Action / Route Handler
                 → 输入校验 + 权限判断
                 → Supabase RPC 或表操作
                 → revalidate / redirect / JSON response
```

### 智能教材发布与学习

```text
作者工作区 → 内容/脚本校验 → 快照发布 → 已发布版本
                                          │
学生运行时 ← 兼容适配层 ← runtime loader ─┘
     │
     └→ 进度、尝试、录音证据、完成判定
```

### 教学 Agent

```text
教学内容/脚本 → Agent run → 工具与技能执行 → 事件流
                                           │
学生 UI ← Route Handler/transport ← 运行状态与教学产物
                                           │
                         完成证据 / 对账 / 可取消与恢复
```

## 7. 目前最需要治理的结构问题

1. **路由层过重。** `src/app` 中同时存在页面编排、业务查询、Server Actions 和大量业务组件；路由目录正在承担 feature 层职责。
2. **共享层含义过宽。** `src/lib` 既有基础设施，也有课程、成绩、教材、录音等领域逻辑，容易形成无约束的横向依赖。
3. **同一领域存在多套入口。** 例如智能教材分布在 `src/app`、`src/features/digital-textbook`、`src/features/smart-textbook-runtime`、`src/lib/smart-textbook-*`，作者态、发布态、运行态与兼容态边界不够直观。
4. **管理端路由有双轨迹象。** `/dashboard` 与 `/[space]/dashboard` 并存，并带有 legacy 路由，增加导航、权限和回归成本。
5. **数据契约分散。** 数据库表查询、RPC、Zod 契约及类型分别散落在页面、feature service 和 lib 中，变更影响难以快速判断。
6. **迁移与专项脚本数量较大。** 大量阶段性验证脚本是重要资产，但需要区分长期回归测试与一次性交付证据。

## 8. 推荐目标架构

继续保持“模块化单体”，暂不拆微服务。当前业务共享同一租户、课程、学生和权限模型，拆服务会先放大数据一致性与运维复杂度，收益有限。

推荐每个领域统一为以下结构：

```text
src/features/<domain>/
├── domain/          # 纯业务类型、规则、状态机；不依赖 Next.js/Supabase
├── application/     # 用例编排，如发布、提交、批改、完成判定
├── infrastructure/  # Supabase repository、外部服务 adapter
├── server/          # server-only 查询、commands、权限入口
├── components/      # 领域 UI
└── index.ts          # 对外公开 API；禁止跨域引用内部文件
```

路由层只保留：

- URL 参数解析和页面元数据
- 调用 feature 的 query/use case
- 组合页面级组件
- loading / error / not-found 边界

共享层收敛为：

```text
src/shared/
├── auth/            # 会话、角色、租户上下文
├── db/              # Supabase client 与通用数据库工具
├── ui/              # 无业务语义的 UI 原语
├── validation/      # 真正跨域的校验工具
└── observability/   # 日志、审计、错误映射
```

## 9. 强制依赖方向

```text
app → features → shared
             ↘ domain

允许：app 调用 feature 公共入口
允许：feature infrastructure 依赖 shared/db
禁止：shared 反向依赖 feature
禁止：一个 feature 深链到另一个 feature 的内部文件
禁止：Client Component 直接使用 service-role client
禁止：页面组件直接承载跨页面业务规则
```

跨领域协作通过明确的公开用例完成，例如：

- `course-completion` 调用 `assessments.getStudentResultSummary()`
- `student-home-learning` 调用各任务域提供的 read model
- `smart-textbook-runtime` 只消费 `publishing` 输出的已发布契约
- `teaching-agent` 通过稳定的 content/runtime ports 使用教材内容

## 10. 建议的治理顺序

### 第一阶段：先立边界，不搬代码

- 为每个 feature 增加单一公开入口和 owner 说明。
- 新代码禁止继续向 `src/lib` 添加具体业务服务。
- 定义页面、Server Action、Route Handler、RPC 各自适用场景。
- 给关键领域补充依赖规则和架构检查。

### 第二阶段：处理三个高价值切面

1. 将学生首页聚合收敛为只读 projection，避免首页直接知道各领域表结构。
2. 将智能教材明确拆为 authoring、publishing、runtime、legacy-adapter 四个边界。
3. 将 Agent 拆为 definition、orchestration、runtime、transport、evidence 五个边界。

### 第三阶段：瘦身路由与共享层

- 把 `src/app/dashboard/**/page-content.tsx` 中的领域逻辑迁入对应 feature。
- 将 `src/lib` 中的领域文件逐步归还各 feature。
- 合并或明确 `/dashboard`、`/[space]/dashboard`、legacy-v1 的生命周期。

### 第四阶段：数据与发布治理

- 为核心 RPC 建立输入/输出契约及调用方清单。
- 将数据库迁移分成 baseline、长期增量、已归档交付迁移。
- 将验证脚本分为 CI 回归、发布门禁、一次性证据三类。

## 11. 架构决策结论

- 保持模块化单体，而不是现在拆微服务。
- Supabase RLS 是数据安全底线，应用层权限是用户体验和提前失败机制，两者都保留。
- 浏览器不掌握管理密钥；service role 只能存在于 `server-only` 基础设施中。
- 跨域首页与洞察使用 read model/projection，避免把聚合查询散落在页面。
- 智能教材以“不可变已发布快照”为学生运行时唯一内容来源。
- 新功能优先进入 `src/features/<domain>`，`src/app` 只负责路由适配。

## 12. 下一步可执行清单

- [ ] 为现有 feature 建立 owner 与公开 API 清单
- [ ] 统计 `src/app` 内直接访问 Supabase 的页面，并按领域迁移
- [ ] 统计 `src/lib` 的领域归属，生成迁移映射表
- [ ] 画出智能教材和教学 Agent 的数据库表/RPC 依赖图
- [ ] 明确双路由与 legacy-v1 的退役计划
- [ ] 将上述依赖方向加入 ESLint 或边界测试
- [ ] 为核心域补充 ADR（架构决策记录）
