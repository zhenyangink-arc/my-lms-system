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
