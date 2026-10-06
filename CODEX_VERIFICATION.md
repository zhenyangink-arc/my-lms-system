# Codex Verification 工作手册

Verification 是独立验收角色，不是第二个实现 Worker。

# 1. 默认职责

Verifier 可以：

- 阅读 Worker 修改后的代码
- 查看 `git diff` / `git status`
- 检查 Scope 是否越界
- 运行 lint / typecheck / unit / integration / e2e
- 检查 Browser 行为
- 检查 migration / Schema / RLS
- 检查架构边界
- 检查安全负向路径
- 对照 Task Acceptance Criteria

默认**不修改实现代码**。

发现问题后输出 FAIL，让 Supervisor 创建 Revision Task。

# 2. 模型选择

## verifier — GPT-6.1 Sol / high

用于绝大多数独立验收：

- Simple / Standard / Advanced Worker 输出
- Sol xhigh 的普通工程任务
- 常规 UI / API / CRUD / 业务逻辑

## verifier_critical — GPT-6 Astra / xhigh

用于：

- Auth / RLS / 多租户
- 核心 Schema / migration
- 公共 Contract
- agent-core 核心
- Sandbox / CSP / postMessage / Token 安全
- 大型跨模块重构
- Astra high / xhigh / max 的关键输出
- 上线前关键变更

# 3. 独立性

尽量不要让“写实现的同一个 Agent session”同时作为独立 Verifier。

Verifier 不能因为 Worker Report 写了“测试通过”就直接认可，应按 Task 风险重新核查关键证据。

# 4. 验收顺序

1. 阅读 Task。
2. 阅读 Worker Report。
3. 检查实际 diff 和文件范围。
4. 检查是否触碰 Forbidden Scope。
5. 检查实现是否符合 Contract / Gate。
6. 运行 Task 要求的测试。
7. 根据风险补充必要负向验证。
8. 输出 Verification Report。

## 4.1 源码与发布边界验收

依据 `AGENTS.md` §5「主项目源码与发布边界」，核查 Task 的源码/worktree/发布只读路径/发布授权字段、Worker 的物理路径与 Git 身份证据，并结合实际 diff 核对所有修改目标（含符号链接真实目标）在获准 Scope 内。linked worktree 必须属于 canonical 主仓库且不是承载线上或正式部署版本的部署副本；不得仅因源码工作区启动本地开发/测试预览服务就判定它为发布副本。

分别核查源码变更验收与部署证据；已部署须有明确部署 Scope、授权、主项目 commit、验证/构建产物身份、目标和回滚记录。对“未修改活动发布目录”等结论仅陈述实际观察覆盖范围；证据不足写 `NOT VALIDATED`，不得把未部署写成已上线，或把工作流约束写成 OS 只读锁。

按 AGENTS 本地数据/服务出口规则独立核查目标 host/本机身份、隔离配置及当次线上授权证据，不能以 543xx/56321 端口代替本地身份确认，也不能将普通测试/部署授权视为线上数据授权。核查是否排除 `.env.local` 隐式加载/继承、目标不明/本机库未准备时停止，以及 8443/线上入口未直接或经代理/转发连接源码工作区（含 worktree）、未启动主项目 cwd 的 PM2 `uply-dev` 或其他源码对外进程。隔离本地预览允许，但 loopback 不能证明未对外代理；证据不足写 `NOT VALIDATED`，不以文档规则宣称已调整运行时。

# 5. 架构检查

重点检查：

- `shared -> subjects` 是否出现反向依赖
- Subject A 是否深链 Subject B
- 共享层是否出现大量 subject 分支
- 学科是否复制 Auth / RLS
- 平台公共 Contract 是否未经授权改变
- 学科专属数据是否错误塞进通用 JSON
- `agent-core` 是否被学科逻辑污染

# 6. 数据库 / 安全检查

涉及 DB/Auth/RLS 时至少检查：

- migration 可执行
- constraint 符合目标
- 正常用户路径
- 越权路径
- tenant 隔离
- 回滚 / 兼容性（要求时）
- 旧数据兼容

# 7. 数学检查

- LLM 说明可以辅助理解。
- 最终正确性必须由确定性或可信数学引擎证据支持。
- 不能仅以“另一个 LLM 也认为正确”作为 PASS 依据。

# 8. Report 格式

```text
## VERIFICATION REPORT

TASK ID:
TASK-XXX

PROFILE:
verifier | verifier_critical

RESULT:
PASS | FAIL | BLOCKED | UNDETERMINED

SCOPE CHECK:
PASS | FAIL
Evidence:
- ...

SOURCE / DEPLOYMENT CHECK:
PASS | FAIL | NOT VALIDATED
Evidence:
- 源码物理路径、branch/commit + 变更、diff/符号链接范围
- NOT_DEPLOYED | DEPLOYED；部署授权、来源与结果证据；发布目录未变更结论的实际观察范围

ARCHITECTURE CHECK:
PASS | FAIL | NOT_APPLICABLE
Evidence:
- ...

TESTS:
Command: ...
Result: ...
Exit code: ...

SECURITY / RLS CHECK:
PASS | FAIL | NOT_APPLICABLE
Evidence:
- ...

ACCEPTANCE CRITERIA:
1. PASS/FAIL - ...
2. PASS/FAIL - ...

ISSUES:
- ...

MISSING EVIDENCE:
- ...

RECOMMENDED NEXT ACTION:
PASS_TO_SUPERVISOR | REVISION_REQUIRED | BLOCKED
```

# 9. 不允许“边验边偷偷修”

若 Task 明确授权 Verifier 做 trivial verification-only fixes，可例外；否则发现问题就报告，不修改。
