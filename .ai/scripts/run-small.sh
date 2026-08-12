#!/usr/bin/env bash
set -euo pipefail

TASK="${*:-}"

if [ -z "$TASK" ]; then
  echo "Usage:"
  echo '  .ai/scripts/run-small.sh "你的任务描述"'
  exit 1
fi

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [ -z "$ROOT_DIR" ]; then
  echo "ERROR: 当前目录不在 Git 仓库中。"
  exit 1
fi

cd "$ROOT_DIR"

BRANCH="$(git branch --show-current)"

if [ "$BRANCH" != "main" ]; then
  echo "WARNING: 当前分支不是 main：$BRANCH"
fi

echo "=== SMALL TASK ==="
echo "Project: $ROOT_DIR"
echo "Branch: $BRANCH"
echo "Task: $TASK"
echo

codex exec \
  --sandbox workspace-write \
  "
你是本项目的小任务执行 Worker。

用户任务：
$TASK

这是 SMALL 级别任务。

执行原则：
- 只处理用户明确要求的小范围修改
- 优先最小改动
- 不扩大任务范围
- 不做无关重构
- 不修改数据库
- 不修改 Supabase migration
- 不修改 RLS
- 不修改认证
- 不修改权限模型
- 不修改环境变量
- 不修改部署配置
- 不执行生产部署
- 不执行 git commit
- 不执行 git push
- 不执行 git merge
- 如果发现任务实际涉及高风险或明显超出小任务范围，停止修改并明确说明

验证原则：
- UI / 文案 / 跳转类任务只做必要的 targeted 检查
- 不默认运行完整 build
- 不默认扫描整个项目
- 修改完成后检查 git diff
- 如果适合，执行 targeted typecheck / lint
- 不做与本任务无关的检查

完成后用中文简洁说明：
1. 修改了什么
2. 修改了哪些文件
3. 做了什么验证
4. 是否还有需要人工确认的问题
"

echo
echo "=== Git Status ==="
git status --short

echo
echo "=== Diff Stat ==="
git diff --stat
