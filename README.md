# PUFFY LMS

面向学生、教师、机构和平台运营的多租户学习管理系统。每个机构（租户）拥有自己的门户，学生在门户中进入已开通的学习应用（韩语、英语、数学、大学课程）或服务应用（留学服务）；教职人员在按应用划分的管理工作区中维护内容、学生、作业考试与学情。

当前主要业务是韩语课程（含智能教材、章节测试、巩固中心、会话练习与 AI 教学助手）。英语、数学应用已具备平台插槽与路由骨架，在机构中仍为“即将上线”。

## 技术栈

- Next.js 16 App Router（webpack 构建）、React 19、TypeScript
- Tailwind CSS 4、shadcn/ui、Lucide Icons
- Supabase：Auth、Postgres、Row Level Security、Edge Functions
- Cloudflare R2（私有文件与短时签名 URL）、Cloudflare Realtime（直播课堂）
- 部署：OpenNext for Cloudflare（`wrangler`）

> 本项目使用的 Next.js 版本与常见资料存在差异，修改代码前请阅读 `node_modules/next/dist/docs/` 中对应的指南（见 [AGENTS.md](AGENTS.md)）。

## 架构概览

- **模块化单体：共享平台 + 学科模块。**身份、租户、权限、课程骨架、学习记录、作业考试成绩、文件媒体与 `agent-core` 属于平台；学科特有的内容、题型、判题、渲染与 AI 能力放在 `src/features/subjects/<学科>/`，通过学科清单与注册表接入平台。
- **学科即学习类应用**：学科标识就是数据库中的 `student_app_id`（代码中的 `StudentAppSlug`）。
- **路由**
  - 机构门户：`/{space}`
  - 学生应用：`/{space}/apps/{korean|english|math|university|study-abroad}`
  - 管理工作区：`/{space}/dashboard/admin/apps/{appSlug}`；平台空间为 `/platform/dashboard/...`
  - 旧 `/{space}/dashboard/...` 学生路由只作兼容入口，会重定向到对应应用
- **目录**
  - `src/app`：路由、页面组装、Route Handlers
  - `src/features`：按领域组织的业务模块（含 `subjects/`）
  - `src/lib`：鉴权、租户、Supabase 客户端等共享基础设施（不得引用学科模块）
  - `supabase/migrations`：表、函数、RPC、RLS；`supabase/functions`：Edge Functions
  - `tests`、`scripts`：领域测试、迁移与权限验证、数据转换脚本

详细说明：

- [系统架构总览](docs/SYSTEM_ARCHITECTURE_OVERVIEW.md)
- [共享平台 + 学科模块架构](docs/shared-platform-subject-modules-architecture.md)（含遗留项与待决定事项）
- [多租户架构](docs/multi-tenant-saas-architecture.md)

## 本地启动

环境要求：

- Node.js：Next.js 16 至少需要 20.9；测试使用 `--experimental-strip-types`，建议使用 22.6 或更高版本。
- 本机数据库使用 Supabase CLI（Docker）。

```bash
npm install
cp .env.example .env.local   # 填入真实配置，切勿提交
npx supabase start           # 启动本机 Supabase
npm run dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)。

- `supabase/seed.sql` 为本机数据库提供一次性的开发账号（仅用于可丢弃的本机实例，见文件内说明）。
- `supabase/bootstrap/` 是**新环境**的 schema 基线与迁移账本元数据，**不得用于已有的生产数据库**，详见其中的 README。

## 环境变量

完整示例见 `.env.example`。

| 变量 | 用途 | 暴露范围 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目地址 | 浏览器与服务端 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key | 浏览器与服务端 |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端管理客户端（仅限 `server-only` 代码） | 仅服务端 |
| `R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET_NAME` | Cloudflare R2 私有存储 | 仅服务端 |
| `R2_SIGNED_URL_EXPIRES_IN` | 签名 URL 有效秒数，默认 3600，范围 1–604800 | 仅服务端 |
| `CLOUDFLARE_REALTIME_APP_ID`、`CLOUDFLARE_REALTIME_APP_SECRET` | 直播课堂（Cloudflare Realtime SFU） | 仅服务端 |
| `CONVERSATION_AI_BASE_URL`、`CONVERSATION_AI_CHAT_PATH`、`CONVERSATION_AI_WS_URL`、`CONVERSATION_AI_SERVICE_TOKEN` | 口语 AI 陪练服务 | 仅服务端 |
| `CONVERSATION_AI_DAILY_MESSAGE_LIMIT` | 每名学生每 24 小时的陪练轮次上限，默认 200 | 仅服务端 |

不要把真实密钥提交到 Git；仅服务端变量不得添加 `NEXT_PUBLIC_` 前缀。

## 常用命令

```bash
npm run dev               # 开发服务器（webpack）
npm run typecheck         # tsc --noEmit
npm run lint              # ESLint
npm run test:navigation   # 运行 tests/ 下全部 Node 测试
npm run check             # 测试 + 类型检查 + lint
npm run build             # 生产构建（会先自动运行 test:navigation）
npm run build:cloudflare  # OpenNext Cloudflare 构建（同样先运行测试）
npm run deploy            # 构建并部署到 Cloudflare
```

说明：

- 在新检出的工作目录中单独运行 `tsc` 前，先执行 `npx next typegen` 生成路由类型。
- `tests/` 中部分测试会写入 `docs/evidence/` 下的证据文件，另有依赖本机数据库或浏览器的测试；只验证局部改动时，可直接运行相关测试文件：`node --experimental-strip-types --test tests/<文件>.test.mjs`。
- `package.json` 中还有按章节、按功能的专项验证脚本（`test:chapter-*-security`、`test:course-completion` 等）。

## 权限模型

- **平台角色**：`platform_owner`（平台负责人）、`platform_deputy`（平台副负责人）、`platform_admin`（平台管理员）、`platform_course_inspector`（课程巡检员）。平台身份不进入任何机构的业务上下文。
- **机构角色**（来自 `tenant_memberships`）：`tenant_super_admin`（机构负责人）、`ceo`（运营负责人）、`admin`、`teacher`、`student`；学生另有会员档位 `normal`、`vip1`、`vip2`、`vip3`。
- **应用级授权**：机构是否开放应用（`tenant_student_apps`）、学生是否报名且在有效期内（`student_app_enrollments`）、员工在应用中的能力（`staff_app_assignments`：管理学生 / 内容 / 测评、查看分析）。
- **账号状态**：`active`、`inactive`、`suspended`；非 active 账号会被引导到停用页面。
- 页面与 Server Action 在服务端再次校验身份与能力；数据库 RLS 是最终边界，应用层校验不能代替它。
- R2 下载先通过当前用户的 Supabase / RLS 查询确认权限，再签发短时地址。

## 协作方式

本项目采用 Supervisor / Worker 的 AI 协作流程，规则见 [AGENTS.md](AGENTS.md) 与根目录的 `CODEX_*.md` 手册；正式任务使用 `.codex/tasks/` 下的模板与记录。
