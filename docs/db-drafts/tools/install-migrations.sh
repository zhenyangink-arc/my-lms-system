#!/usr/bin/env bash
# 把 D5、D7、D8 的 up 脚本复制成 supabase/migrations 下的正式迁移文件。
# 默认只打印将要做什么（dry-run）；加 --write 才真正写入。**Gate 通过、并确定排在 Codex 迁移之后再用。**
# 用法：docs/db-drafts/tools/install-migrations.sh <12位起始编号> [--write]
#   例：install-migrations.sh 202610010001  → 202610010001_math_grading_storage.sql、…0002_…、…0003_…
# 安全检查：编号必须是 12 位数字且大于现有最大迁移编号；目标文件已存在则拒绝。
set -eu
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
START="${1:-}"; MODE="${2:-}"
[[ "$START" =~ ^[0-9]{12}$ ]] || { echo "需要 12 位起始编号，如 202610010001" >&2; exit 2; }
LATEST="$(ls "$ROOT/supabase/migrations" | sed -E 's/^([0-9]{12})_.*/\1/' | sort | tail -1)"
[ "$START" -gt "$LATEST" ] || { echo "起始编号 $START 必须大于现有最大迁移编号 $LATEST" >&2; exit 2; }
i=0
for pair in "D5-math-grading-storage:math_grading_storage" "D7-math-paper-layer:math_paper_layer" "D8-replace-math-paper-draft:replace_math_paper_draft"; do
  src="$HERE/${pair%%:*}.up.sql"; name="${pair##*:}"
  dest="$ROOT/supabase/migrations/$((START + i))_${name}.sql"
  [ ! -e "$dest" ] || { echo "目标已存在：$dest" >&2; exit 2; }
  if [ "$MODE" = "--write" ]; then cp "$src" "$dest"; echo "已写入 $dest"; else echo "[dry-run] $src -> $dest"; fi
  i=$((i + 1))
done
[ "$MODE" = "--write" ] || echo "（dry-run，未写入任何文件；确认后加 --write）"
