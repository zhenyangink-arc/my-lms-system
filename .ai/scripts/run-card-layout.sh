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

echo "=== SMALL TASK ==="
echo "Project: $ROOT_DIR"
echo "Branch: $BRANCH"
echo "Task: $TASK"
echo

codex exec \
  --sandbox workspace-write \
  "
你是 Card Layout Worker。

任务：
$TASK

规则：
- 只处理卡片新增、删除、移动、排序。
- 优先只修改用户明确涉及的页面文件。
- 如果任务已经给出文件路径，直接读取该文件，不扫描整个项目。
- 保持现有卡片内容、样式、尺寸和功能不变，除非任务明确要求修改。
- 不做无关重构。
- 不修改数据库、认证、权限、环境变量或部署配置。
- 不执行 git commit、push、merge。
- 修改完成后只检查实际修改文件的 git diff。
- 不运行全量 build、lint、typecheck 或测试。
- 完成目标后立即结束，不继续探索项目。

最后简短输出：
1. 修改了什么
2. 修改了哪个文件
3. 是否完成
"
