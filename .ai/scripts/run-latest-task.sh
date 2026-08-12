#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [ -z "$ROOT_DIR" ]; then
  echo "ERROR: 当前目录不在 Git 仓库中。"
  exit 1
fi

cd "$ROOT_DIR"

LATEST_WORKTREE="$(
  git worktree list --porcelain |
  awk '
    /^worktree / {
      path=$2
    }
    /^branch refs\/heads\/cez\// {
      print path
    }
  ' |
  while read -r wt; do
    if [ -d "$wt" ]; then
      printf "%s\t%s\n" "$(stat -c %Y "$wt")" "$wt"
    fi
  done |
  sort -nr |
  head -n 1 |
  cut -f2-
)"

if [ -z "$LATEST_WORKTREE" ]; then
  echo "ERROR: 没有找到 cez/* worktree。"
  exit 1
fi

echo "=== Latest Cezar Worktree ==="
echo "$LATEST_WORKTREE"
echo

if [ ! -f "$LATEST_WORKTREE/.ai/team/NEXT_TASK.md" ]; then
  echo "ERROR: 最新 worktree 中不存在 .ai/team/NEXT_TASK.md"
  exit 1
fi

if [ ! -f "$LATEST_WORKTREE/.ai/team/STATE.json" ]; then
  echo "ERROR: 最新 worktree 中不存在 .ai/team/STATE.json"
  exit 1
fi

if [ ! -x "$LATEST_WORKTREE/.ai/scripts/run-team-cycle.sh" ]; then
  echo "ERROR: 最新 worktree 中不存在可执行的 run-team-cycle.sh"
  exit 1
fi

echo "=== Current State ==="
cat "$LATEST_WORKTREE/.ai/team/STATE.json"
echo

NEXT_ACTION="$(
  python - "$LATEST_WORKTREE/.ai/team/STATE.json" <<'PY'
import json
import sys

path = sys.argv[1]

with open(path, encoding="utf-8") as f:
    state = json.load(f)

print(state.get("next_action", "UNKNOWN"))
PY
)"

STATUS="$(
  python - "$LATEST_WORKTREE/.ai/team/STATE.json" <<'PY'
import json
import sys

path = sys.argv[1]

with open(path, encoding="utf-8") as f:
    state = json.load(f)

print(state.get("status", "UNKNOWN"))
PY
)"

echo "Status: $STATUS"
echo "Next action: $NEXT_ACTION"
echo

if [ "$STATUS" = "DONE" ]; then
  echo "任务已经是 DONE，不重复执行。"
  exit 0
fi

if [ "$STATUS" = "BLOCKED" ]; then
  echo "任务当前为 BLOCKED，需要人工处理。"
  exit 3
fi

if [ "$NEXT_ACTION" != "WAIT_FOR_WORKER" ]; then
  echo "WARNING: 当前 next_action 不是 WAIT_FOR_WORKER。"
  echo "为避免重复执行 Worker，本次停止。"
  exit 2
fi

echo "=== Starting AI Team Cycle ==="
echo

exec "$LATEST_WORKTREE/.ai/scripts/run-team-cycle.sh" "$LATEST_WORKTREE"
