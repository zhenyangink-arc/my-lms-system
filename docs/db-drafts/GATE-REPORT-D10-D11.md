# Architecture Gate 报告：D10 + D11（日界线时区可由调用方指定）

> **性质：作者自审，不是独立审查。** 与 `GATE-REPORT-D9.md`、`GATE-REPORT-D5-D7-D8.md` 同样的限制：写草稿的同一个 Claude 会话按 `CODEX_SUPERVISOR.md` 的 Gate 要求自查，需要独立 Gate 补上独立性。
> 日期：2026-10-02。验证均在隔离验证库 `lms-verify` 完成（含经真实 REST 接口的调用），没有碰真实库。背景见待决事项 C13 与 `../university-major-structure-design.md` 第 11 节。

## 1. 结论：ALLOW（有条件）

可以进入“整理为正式迁移”的下一步，前提是满足第 6 节条件。D10 与 D11 **互不依赖、不依赖 D1–D9**，做法相同、风险相同，建议在同一次 Gate 里过，迁移可以放在同一批。

## 2. 要解决的问题

产品决定（2026-10-01）：时间一律跟随用户电脑的时区。应用层已经做完（用户时区 cookie 机制，见设计稿第 11 节），但两个数据库函数把“今天”写死为 `Asia/Seoul`，应用层改不了：

| 函数 | 迁移 | 受影响的显示 |
|---|---|---|
| `get_teacher_class_today_snapshot` | `202608190021` | 教师“今日课堂”：今天已学习、今日必做、连续未学习天数 |
| `get_institution_platform_learning_overview` | `202608190022` | 机构 / 平台学习总览：今日活跃学生、今日必做、章节练习与复习使用人数 |

非韩国时区的老师 / 机构负责人会看到按首尔日界线算的“今天”，与页面上其他按电脑时区显示的时间不一致。

## 3. 推荐方案与被否决的方案

**推荐**：两个函数各新增一个末位参数 `p_time_zone text default 'Asia/Seoul'`，函数体里写死的 `'Asia/Seoul'` 换成 `coalesce(nullif(btrim(p_time_zone), ''), 'Asia/Seoul')`。不传时行为与原来一致；应用侧从用户时区 cookie 取值后传入。

| 被否决的方案 | 原因 |
|---|---|
| 在 `profiles` 等表里存用户时区，函数自己读 | 要加列 / 同步机制；用户换电脑或出差时区就变，存下来的值会过期；浏览器值才是“当前电脑” |
| 保留旧签名、另建新函数 | 两个函数体维护两份，容易漂移 |
| 保留旧签名并存新签名（重载） | 按名调用会有歧义（PostgREST 按参数名解析，两个重载都能匹配）；所以是先删旧签名再建新的，授权、注释同步重建 |
| 用 `set_config('timezone')` 由调用方设会话时区 | 函数是 `stable`、连接池下会话状态不可靠，且无法区分同一请求里的其他查询 |
| 函数里显式查 `pg_timezone_names` 校验 | 实测每次约 35 ms，对“单次聚合”不值得；PostgreSQL 在 `at time zone` 处对未知时区本来就抛 22023 |

## 4. 改动清单（每个函数一处替换，不改任何表、策略）

| 类别 | 对象 | 说明 |
|---|---|---|
| 函数 | `get_teacher_class_today_snapshot`（D10） | 参数 4 → 5；函数体 4 处 `'Asia/Seoul'` → `v_time_zone`；其余与 `202608190021` 逐字一致（已用 diff 核对） |
| 函数 | `get_institution_platform_learning_overview`（D11） | 参数 2 → 3；函数体 2 处 `'Asia/Seoul'` → `v_time_zone`；其余与 `202608190022` 逐字一致 |
| 授权 | 两个函数 | 与原来一致：`revoke ... from public, anon`、`grant execute ... to authenticated`（`service_role` 来自默认权限，回滚后 ACL 指纹逐字一致） |
| 注释 | 两个函数 | 追加“按 `p_time_zone`（默认首尔）计算” |

未改：所有表、所有 RLS 策略、其他函数。安全模型不变：仍是 `security definer`、`search_path=''`，授权检查在日界线计算之前；`p_time_zone` 只作为 `at time zone` 的操作数，**没有动态 SQL**，不存在注入面。

## 5. 证据（验证库，一次性，未保留执行状态）

- **行为测试**：D10 11 项、D11 10 项全部符合预期（`*.test.sql`，事务内构造数据、最后回滚）。同一条活动：不传 / 显式首尔 = 同一结果，纽约结果不同（D10：连续未学习 3 天 vs 4 天，今天已学习 false vs true；D11：今日活跃 0 vs 1）；空字符串 = 首尔且结果逐字一致；无效时区 22023；学生 / 非本机构调用 42501；anon 无权限；旧签名不再存在、只剩 1 个重载。
- **回滚**：`*.down.sql` 执行后函数定义、权限、注释的合并指纹与升级前逐字一致（D10、D11 各重复验证）。
- **经真实 REST 接口的部署顺序验证**（D10，以 verify-teacher 登录，PostgREST 调 `/rpc/get_teacher_class_today_snapshot`）：
  | 状态 | 旧调用（4 个命名参数） | 新调用（带 `p_time_zone`） |
  |---|---|---|
  | 迁移前 | 200 | **404 PGRST202**（找不到该签名） |
  | 迁移后 | 200（默认值生效） | 200；无效时区 400 / 22023 |
- 耗时：显式时区校验 35 ms（已因此放弃）；现在的实现没有额外查询。

## 6. 自审发现与条件

**进入正式迁移前的条件：**

1. **部署顺序必须是“先迁移，后上应用”。** 新应用在迁移之前上线会得到 404 PGRST202（上表）；旧应用在迁移之后继续可用（默认值）。迁移应作为独立的先行发布。
2. **应用侧在迁移上线后再改**：`teacher-class-today/api/service.ts`、`institution-platform-overview/api/service.ts` 传 `p_time_zone: await getViewerTimeZone()`（页面已能取到）。两处都是一行改动；`scripts/verify-institution-platform-overview.mjs` 直接按位置调用旧签名，迁移后仍可用，可后续补一组带时区的断言。
3. **迁移编号**：排在 Codex 线迁移之后；与 D1–D9 无依赖。

**已知且接受的边界：**

- “今天”是调用者的今天：同一机构里两位不同时区的老师看到的“今日”不同，这是产品决定的结果。
- 错误信息是 PostgreSQL 原生英文（`time zone "…" not recognized`，SQLSTATE 22023）；应用层本来就把非 42501 的错误转成通用中文提示，不暴露原文。
- 时区名也接受 PostgreSQL 认可的缩写与 POSIX 写法（如 `EST`、`UTC+3`）；应用传的是浏览器的 IANA 名，不受影响。
- 回滚（down）只恢复函数，不涉及数据，可安全执行。

**不在本次范围：**

- 每周学习计划的首尔周键（`202608190018`，存储层，C13 第 ② 项）。
- 平台负责人跨机构结课趋势按首尔月份分桶（`202608200008`），只影响月初月末几小时的归属。
