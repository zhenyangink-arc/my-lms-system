#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# FULL TASK DELIVERY
#
# 输入：
#   $1 = Cezar worktree 绝对路径
#
# 作用：
#   STATE=DONE
#     ↓
#   从 Cezar worktree 当前真实状态构造纯业务 commit
#     ↓
#   排除 .ai/**
#     ↓
#   检查本地 main 必须完全干净
#     ↓
#   cherry-pick 到本地 main
#
# 明确不做：
#   - 不 push
#   - 不 stash main
#   - 不 reset main
#   - 不自动解决 cherry-pick 冲突
#   - 不直接 cherry-pick Cezar autosave commit
# ============================================================

WORKTREE_PATH="${1:-}"

if [ -z "$WORKTREE_PATH" ]; then
  echo "Usage: $0 <cezar-worktree-path>"
  echo "MERGE_STATUS: ERROR"
  exit 1
fi

if [ ! -d "$WORKTREE_PATH" ]; then
  echo "ERROR: Cezar worktree 不存在："
  echo "$WORKTREE_PATH"
  echo "MERGE_STATUS: ERROR"
  exit 1
fi

WORKTREE_PATH="$(cd "$WORKTREE_PATH" && pwd)"

if ! git -C "$WORKTREE_PATH" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: 指定路径不是 Git worktree："
  echo "$WORKTREE_PATH"
  echo "MERGE_STATUS: ERROR"
  exit 1
fi

WORKTREE_ROOT="$(git -C "$WORKTREE_PATH" rev-parse --show-toplevel)"
WORKTREE_ROOT="$(cd "$WORKTREE_ROOT" && pwd)"

if [ "$WORKTREE_ROOT" != "$WORKTREE_PATH" ]; then
  echo "ERROR: 必须传入 Cezar worktree 根目录。"
  echo "收到：$WORKTREE_PATH"
  echo "根目录：$WORKTREE_ROOT"
  echo "MERGE_STATUS: ERROR"
  exit 1
fi

BRANCH="$(git -C "$WORKTREE_PATH" branch --show-current)"

case "$BRANCH" in
  cez/*)
    ;;
  *)
    echo "ERROR: 只允许从 cez/* worktree 合入 main。"
    echo "当前分支：$BRANCH"
    echo "MERGE_STATUS: ERROR"
    exit 1
    ;;
esac

# ============================================================
# 1. 验证 STATE = DONE
# ============================================================

STATE_FILE="$WORKTREE_PATH/.ai/team/STATE.json"

if [ ! -f "$STATE_FILE" ]; then
  echo "ERROR: 缺少 STATE.json："
  echo "$STATE_FILE"
  echo "MERGE_STATUS: ERROR"
  exit 1
fi

STATE_STATUS="$(
python - "$STATE_FILE" <<'PY'
import json
import sys
from pathlib import Path

try:
    state = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
except Exception:
    print("INVALID")
else:
    print(state.get("status", "UNKNOWN"))
PY
)"

if [ "$STATE_STATUS" != "DONE" ]; then
  echo "ERROR: 当前任务还不是 DONE，拒绝自动合入 main。"
  echo "STATE.status = $STATE_STATUS"
  echo "MERGE_STATUS: BLOCKED_NOT_DONE"
  exit 2
fi

CURRENT_TASK="$(
python - "$STATE_FILE" <<'PY'
import json
import sys
from pathlib import Path

try:
    state = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
except Exception:
    print("completed full task")
else:
    task = state.get("current_task")
    if isinstance(task, str) and task.strip():
        print(" ".join(task.strip().split()))
    else:
        print("completed full task")
PY
)"

# ============================================================
# 2. 找到真正的 main worktree
# ============================================================

MAIN_WORKTREE="$(
git -C "$WORKTREE_PATH" worktree list --porcelain |
awk '
  /^worktree / {
    path = substr($0, 10)
  }

  /^branch refs\/heads\/main$/ {
    print path
    exit
  }
'
)"

if [ -z "$MAIN_WORKTREE" ]; then
  echo "ERROR: 没有找到 main worktree。"
  echo "MERGE_STATUS: ERROR"
  exit 1
fi

if [ ! -d "$MAIN_WORKTREE" ]; then
  echo "ERROR: main worktree 路径不存在："
  echo "$MAIN_WORKTREE"
  echo "MERGE_STATUS: ERROR"
  exit 1
fi

MAIN_WORKTREE="$(cd "$MAIN_WORKTREE" && pwd)"

MAIN_BRANCH="$(git -C "$MAIN_WORKTREE" branch --show-current)"

if [ "$MAIN_BRANCH" != "main" ]; then
  echo "ERROR: 找到的 main worktree 当前不在 main 分支。"
  echo "路径：$MAIN_WORKTREE"
  echo "分支：$MAIN_BRANCH"
  echo "MERGE_STATUS: ERROR"
  exit 1
fi

echo "========================================"
echo "FULL TASK DELIVERY"
echo "========================================"
echo "Source worktree: $WORKTREE_PATH"
echo "Source branch:   $BRANCH"
echo "Main worktree:   $MAIN_WORKTREE"
echo "STATE:           $STATE_STATUS"
echo

# ============================================================
# 3. main 必须完全干净
# ============================================================

MAIN_STATUS="$(git -C "$MAIN_WORKTREE" status --porcelain --untracked-files=all)"

if [ -n "$MAIN_STATUS" ]; then
  echo "ERROR: main 当前不是干净状态。"
  echo
  echo "为保护用户正在进行的工作，本脚本不会："
  echo "- stash"
  echo "- reset"
  echo "- restore"
  echo "- 覆盖 main"
  echo
  echo "=== main status ==="
  printf '%s\n' "$MAIN_STATUS"
  echo
  echo "MERGE_STATUS: BLOCKED_MAIN_DIRTY"
  exit 3
fi

# ============================================================
# 4. 找到本任务相对 main 的共同基点
# ============================================================

WORKTREE_HEAD="$(git -C "$WORKTREE_PATH" rev-parse HEAD)"
MAIN_HEAD="$(git -C "$MAIN_WORKTREE" rev-parse HEAD)"

BASE_COMMIT="$(git -C "$WORKTREE_PATH" merge-base "$MAIN_HEAD" "$WORKTREE_HEAD")"

if [ -z "$BASE_COMMIT" ]; then
  echo "ERROR: 无法确定 Cezar worktree 与 main 的共同基点。"
  echo "MERGE_STATUS: ERROR"
  exit 1
fi

if ! git -C "$MAIN_WORKTREE" merge-base --is-ancestor "$BASE_COMMIT" "$MAIN_HEAD"; then
  echo "ERROR: 基点不是当前 main 的祖先，拒绝自动合入。"
  echo "MERGE_STATUS: ERROR"
  exit 1
fi

echo "Main HEAD:       $MAIN_HEAD"
echo "Worktree HEAD:   $WORKTREE_HEAD"
echo "Task base:       $BASE_COMMIT"
echo

# ============================================================
# 5. 使用临时 Git index 构造“纯业务树”
#
# 关键：
# - 基于任务 BASE
# - 读取当前 Cezar worktree 的真实业务文件状态
# - 包含：
#     tracked 修改
#     tracked 删除
#     新业务文件
# - 排除：
#     .ai/**
#
# 不修改当前 Cezar worktree 的真实 index。
# ============================================================

TMP_INDEX="$(mktemp)"
rm -f "$TMP_INDEX"

cleanup() {
  rm -f "$TMP_INDEX"
}

trap cleanup EXIT

GIT_INDEX_FILE="$TMP_INDEX" \
  git -C "$WORKTREE_PATH" read-tree "$BASE_COMMIT"

GIT_INDEX_FILE="$TMP_INDEX" \
  git -C "$WORKTREE_PATH" add -A -- \
  . \
  ':(exclude).ai/**'

PURE_TREE="$(
  GIT_INDEX_FILE="$TMP_INDEX" \
    git -C "$WORKTREE_PATH" write-tree
)"

BASE_TREE="$(git -C "$WORKTREE_PATH" rev-parse "$BASE_COMMIT^{tree}")"

if [ "$PURE_TREE" = "$BASE_TREE" ]; then
  echo "没有发现需要合入 main 的业务改动。"
  echo "MERGE_STATUS: NO_BUSINESS_CHANGES"
  exit 0
fi

# ============================================================
# 6. 创建纯业务 commit
#
# commit-tree 只创建 Git object：
# - 不移动 Cezar branch
# - 不修改 Cezar worktree
# - 不污染 .ai/team runtime
# ============================================================

COMMIT_MESSAGE="full-task: $CURRENT_TASK"

PURE_COMMIT="$(
  printf '%s\n' "$COMMIT_MESSAGE" |
    git -C "$WORKTREE_PATH" commit-tree \
      "$PURE_TREE" \
      -p "$BASE_COMMIT"
)"

echo "=== Pure business commit ==="
echo "$PURE_COMMIT"
echo "$COMMIT_MESSAGE"
echo

echo "=== Business changes ==="
git -C "$WORKTREE_PATH" diff-tree \
  --no-commit-id \
  --name-status \
  -r \
  "$PURE_COMMIT"

echo

# 双保险：纯业务 commit 中绝不能出现 .ai/
if git -C "$WORKTREE_PATH" diff-tree \
  --no-commit-id \
  --name-only \
  -r \
  "$PURE_COMMIT" |
  grep -q '^\.ai/'; then

  echo "ERROR: 纯业务 commit 意外包含 .ai/ 文件。"
  echo "拒绝合入 main。"
  echo "MERGE_STATUS: ERROR"
  exit 1
fi

# ============================================================
# 7. 再次确认 main 干净
#
# 防止创建 pure commit 期间用户恰好修改 main。
# ============================================================

MAIN_STATUS_AFTER="$(git -C "$MAIN_WORKTREE" status --porcelain --untracked-files=all)"

if [ -n "$MAIN_STATUS_AFTER" ]; then
  echo "ERROR: 合入前 main 状态发生变化。"
  echo "拒绝 cherry-pick。"
  echo
  printf '%s\n' "$MAIN_STATUS_AFTER"
  echo
  echo "MERGE_STATUS: BLOCKED_MAIN_DIRTY"
  exit 3
fi

# ============================================================
# 8. Cherry-pick 到本地 main
#
# 不 push。
# 冲突时不自动解决，并自动 abort，恢复干净 main。
# ============================================================

echo "========================================"
echo "Cherry-pick to local main"
echo "========================================"
echo

if git -C "$MAIN_WORKTREE" cherry-pick "$PURE_COMMIT"; then
  :
else
  CHERRY_PICK_STATUS="$(git -C "$MAIN_WORKTREE" status --short || true)"

  echo
  echo "ERROR: cherry-pick 发生冲突。"
  echo "不会自动解决冲突。"
  echo
  echo "=== conflict status ==="
  printf '%s\n' "$CHERRY_PICK_STATUS"
  echo

  git -C "$MAIN_WORKTREE" cherry-pick --abort || true

  echo "已自动 abort cherry-pick，main 已恢复到合入前状态。"
  echo "MERGE_STATUS: BLOCKED_CONFLICT"
  exit 4
fi

# ============================================================
# 9. 最终检查
# ============================================================

FINAL_MAIN_STATUS="$(git -C "$MAIN_WORKTREE" status --porcelain --untracked-files=all)"

if [ -n "$FINAL_MAIN_STATUS" ]; then
  echo "WARNING: cherry-pick 成功，但 main 工作区出现未提交状态："
  printf '%s\n' "$FINAL_MAIN_STATUS"
  echo "MERGE_STATUS: MERGED_WITH_DIRTY_MAIN"
  exit 5
fi

NEW_MAIN_HEAD="$(git -C "$MAIN_WORKTREE" rev-parse HEAD)"

echo
echo "========================================"
echo "FULL TASK DELIVERY COMPLETE"
echo "========================================"
echo "Source branch: $BRANCH"
echo "Pure commit:   $PURE_COMMIT"
echo "Main commit:   $NEW_MAIN_HEAD"
echo
echo "没有执行 git push。"
echo "请先在本地 main 验收页面和功能。"
echo
echo "MERGE_STATUS: MERGED"
