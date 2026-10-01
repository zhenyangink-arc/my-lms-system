# 合并前只读预检：feat/subject-slots → main

> 日期：2026-10-01。只读：用 `git merge-tree`、`git diff` 与 Codex 源码锁文件做比对，没有合并、没有改任何分支。
> 分支提示：`feat/subject-slots` 比 `main` 多 57 个提交，226 个文件有改动（+12925 / −1805）。

## 1. 文本冲突

- `main` 自分叉以来**没有新提交**（合并基点就是 `main` 当前提交 `d43564f`），所以合并是快进，`git merge-tree --write-tree` 没有报告任何冲突。
- 只要 `main` 在合并前不再前进，就不会有文本冲突；如果 Codex 恢复后向 `main` 提交，需要重新预检。

## 2. Codex 红区

分支改动的 226 个文件中，**没有任何文件**位于红区路径（`src/features/teaching-agent`、`agent-core`、`smart-textbook*`、`src/lib/smart-textbook-*`、`scripts/teaching-agent-*`、`docs/evidence/teaching-agent-*`、`.codex`、`AGENTS.md`、`CODEX_*.md`）。

另外按导入关系把红区代码的传递依赖闭包算了一遍（279 个文件），**分支改动与该闭包的交集为 0**，也就是没有改红区代码依赖的非红区文件。

## 3. Codex 源码指纹锁

`docs/evidence/teaching-agent-stage-1f-r7c-b/b3a-candidate-source-lock.json` 记录了约 1344 个文件的哈希。分支改动的 226 个文件中有 **117 个在锁清单里**（此前记录为 92 个；这段时间的数学改动又增加了几个），其中包括根目录的 `package.json` 与 `package-lock.json`（新增 `mathjs`、`katex`）。

后果不变：合并会让 Codex 的锁校验失败，需要 Codex 在合并后重新生成锁。**合并前提：Codex 收尾，或与其协调。**

## 4. 合并时还需要处理的事

1. **数据库**：D5、D7（见 `docs/db-drafts/`）尚未整理成正式迁移，也没有执行到真实库；它们需要先过 Architecture Gate，迁移编号排在 Codex 线迁移之后。**合并代码不会自动应用数据库改动。**
2. **数学应用的开放顺序**：代码合并后，数学管理端“作业与考试”分区对已开放数学的机构可见，但没有 D5、D7，创建数学试卷会失败（数据库函数不存在）。需要先应用迁移，或合并时保持数学应用未对机构开放。
3. **新依赖**：`mathjs` 15.2.0、`katex` 0.18.9，已固定版本。
4. **机构布置面板**对韩语也生效（此前韩语机构视图没有布置入口），属于行为变化，合并说明里需要写明。
5. **需要重新跑的验证**：合并到 main 后用本机库同步迁移，再做一次浏览器验证（韩语页面对照）。目前所有浏览器验证都在隔离验证库完成。
