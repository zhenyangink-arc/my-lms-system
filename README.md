# PUFFY LMS

PUFFY 是一个面向学生、教师和运营团队的学习管理系统。项目包含公开首页、Supabase 账号体系、学生学习控制台、课程与课时进度、学习资料、师生问答，以及分角色管理后台。

## 技术栈

- Next.js 16 App Router、React 19、TypeScript
- Tailwind CSS 4、shadcn/ui、Lucide Icons
- Supabase Auth、Postgres、Row Level Security
- Cloudflare R2 私有文件存储与短时签名 URL

## 本地启动

环境要求：Node.js 20.9 或更高版本，以及一个已经配置好数据表和 RLS 策略的 Supabase 项目。

```bash
npm install
copy .env.example .env.local
npm run dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)。请先把 `.env.local` 中的示例值替换为真实配置。

## 环境变量

| 变量 | 用途 | 暴露范围 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目地址 | 浏览器与服务端 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key | 浏览器与服务端 |
| `R2_ACCOUNT_ID` | Cloudflare 账户 ID | 仅服务端 |
| `R2_ACCESS_KEY_ID` | R2 API Access Key ID | 仅服务端 |
| `R2_SECRET_ACCESS_KEY` | R2 API Secret | 仅服务端 |
| `R2_BUCKET_NAME` | R2 bucket 名称 | 仅服务端 |
| `R2_SIGNED_URL_EXPIRES_IN` | 签名 URL 有效秒数，默认 3600 | 仅服务端 |

不要把真实密钥提交到 Git。R2 相关变量不能添加 `NEXT_PUBLIC_` 前缀。

## 常用命令

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run start
```

## 权限模型

角色从低到高为 `student`、`teacher`、`admin`、`ceo`、`super_admin`。账号状态包括 `active`、`inactive`、`suspended`。

- Dashboard 入口统一验证 Supabase 用户和 `profiles.status`。
- 管理页面和每一个 Server Action 都会再次执行角色校验。
- `ceo` 不能管理其他 CEO 或老板账号。
- `super_admin` 不能通过普通账号管理页被改角色或停用。
- 所有数据库表仍必须配置正确的 RLS；应用层校验不能代替数据库权限。
- R2 下载先通过当前用户的 Supabase/RLS 查询资源，再签发短时地址。

## 数据库前提

当前代码会使用这些核心表：`profiles`、`course_categories`、`courses`、`lessons`、`lesson_progress`、`lesson_resources`、`lesson_questions`。仓库当前没有数据库 migration，因此新环境不能只靠 `npm install` 自动创建 Supabase schema；部署前需要从现有 Supabase 项目导出并版本化 schema 与 RLS。

更详细的代码边界与数据流见 [docs/architecture.md](docs/architecture.md)。
