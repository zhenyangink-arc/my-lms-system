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

遵守 `AGENTS.md` §5「主项目源码与发布边界」；开发 Writable Scope 不得包含承载线上或正式部署版本的部署副本；源码工作区内本地开发/测试预览按该定义区分。

```text
SOURCE_REPOSITORY:
/home/yangzhen/projects/my-lms-system

WORKTREE:
主项目物理路径，或明确声明的同仓库 linked worktree 物理路径；记录 realpath / Git common dir / worktree 身份核对证据。

RELEASE_READ_ONLY_PATHS:
- /home/yangzhen/releases/**
- 当前及计划承载线上或正式部署版本的部署副本目录（含符号链接真实目标）

DEPLOYMENT_ALLOWED:
NO（默认） | YES（依据会话实际授权，注明范围/依据；已授权不重复询问）

DEPLOYMENT_SCOPE:
NONE，或独立声明发布目标、操作、已验证主项目 Git commit、构建产物身份/验证证据、追溯与回滚方案；禁止以部署名义直接编辑发布源码。

VALIDATION_DATA_TARGET:
NONE（无需数据操作），或已确认的本机数据库（543xx / lms-verify 56321）；注明 host、本机实例身份依据、隔离配置来源（不含凭据），排除主项目 .env.local 自动加载/线上环境继承；目标不明/本机未准备则停止，不回退线上。

CURRENT_ONLINE_DATA_AUTHORIZATION:
NONE（默认），或用户对当次的明确授权依据、目标与操作 Scope；同次同 Scope 不重复询问，普通继续/测试/部署不构成线上数据授权。

SOURCE_EXPOSURE_BOUNDARY:
仅隔离本地开发/测试/临时预览；8443/任何线上入口不得直接或经代理/Tailscale/转发连接源码工作区（含 worktree）；不启动/重启主项目 cwd 的 PM2 uply-dev 或其他源码对外进程，loopback 不等于允许代理对外；线上运行使用可追溯发布副本。

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

WORKTREE ISOLATION:
REQUIRED | OPTIONAL | NOT_AVAILABLE（实际路径与身份见 Scope 的 WORKTREE）
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

按 `CODEX_WORKER.md` 格式提交；包含源码路径、branch/commit + 变更、验证结果及 `NOT_DEPLOYED | DEPLOYED` 与相应证据。

## Verification Report

按 `CODEX_VERIFICATION.md` 格式提交；独立核对路径/diff 范围与源码/部署状态，发布未变更结论限于实际观察范围。
