# TASK TEMPLATE

## Identity

```text
TASK ID:
TASK-XXX

TITLE:
...

STATUS:
PROPOSED | SPECIFIED | INTERFACE_FROZEN | IMPLEMENTING | VERIFYING | COMPLETED | BLOCKED
```

## Routing

```text
IMPLEMENTATION PROFILE:
worker_low | worker_medium | worker_high | worker_xhigh | worker_astra_medium | worker_astra_high | worker_astra_xhigh | worker_max

ARCHITECT GATE:
REQUIRED | NOT_REQUIRED

VERIFICATION PROFILE:
verifier | verifier_critical | NOT_REQUIRED

MODEL ROUTING REASON:
说明为什么选这个模型 / effort；不要只写“任务复杂”。

DISPATCH RECORD REQUIRED:
YES

EXPECTED DISPATCH FORMAT:
[SPAWN] <task_name> -> <profile> | <model> <effort> | <reason>
```

## Objective

```text
OBJECTIVE:
一个明确、可验证的结果。
```

## Context

```text
WHY:
为什么要做。

CURRENT BEHAVIOR:
当前实现 / 问题。

DESIRED BEHAVIOR:
完成后的行为。
```

## Scope

```text
WRITABLE SCOPE:
- path/**
- path/file.ts

READABLE DEPENDENCIES:
- path/**

FORBIDDEN:
- path/**
- AGENTS.md
- .codex/**
```

## Contracts

```text
PUBLIC CONTRACTS:
- 已冻结的接口 / type / schema

MAY CHANGE PUBLIC CONTRACT:
YES | NO

If YES:
- Gate decision reference
```

## Data / Security Impact

```text
DATABASE IMPACT:
NONE | READ_ONLY | WRITE_LOGIC | SCHEMA | MIGRATION

RLS IMPACT:
YES | NO

AUTH IMPACT:
YES | NO

SECURITY IMPACT:
LOW | MEDIUM | HIGH
```

## Requirements

1. ...
2. ...
3. ...

## Out of Scope

- ...

## Acceptance Criteria

1. ...
2. ...
3. ...

## Required Validation

```text
TYPECHECK:
REQUIRED | NOT_REQUIRED

LINT:
REQUIRED | NOT_REQUIRED

UNIT:
REQUIRED | NOT_REQUIRED

INTEGRATION:
REQUIRED | NOT_REQUIRED

E2E / BROWSER:
REQUIRED | NOT_REQUIRED

MIGRATION / RLS:
REQUIRED | NOT_REQUIRED
```

具体命令：

```text
- ...
```

## Risk Focus

- ...

## Parallelism

```text
CAN RUN IN PARALLEL:
YES | NO

CONFLICTING TASKS:
- ...

WORKTREE:
REQUIRED | OPTIONAL | NOT_AVAILABLE
```

## Escalation Rule

以下任一情况出现时，停止扩大修改并上报：

- 需要修改 Writable Scope 外内容
- 需要改公共 Contract
- 发现 DB / RLS / Auth / 安全架构影响
- 当前 Profile 无法可靠解决
- 任务实际复杂度显著高于预期
- 发现任务更适合从 Sol 切换 Astra

输出：

```text
SCOPE_CHANGE_REQUEST
```

或：

```text
ESCALATION_REQUIRED
```

## Worker Report

按 `CODEX_WORKER.md` 格式提交。

## Verification Report

按 `CODEX_VERIFICATION.md` 格式提交。
