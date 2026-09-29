# 隔离验证记录

日期：2026-09-13。非生产账号 E2E。

实际源码：`/home/yangzhen/releases/uply-first-enable-20260910/source`。
隔离副本：`/tmp/uply-authoring-closure.J324oo`，没有复制 `.env*`，不连接生产服务。

执行：

```sh
node --test tests/smart-textbook-legacy-adapter.test.mjs tests/digital-textbook-workbench.test.mjs tests/textbook-grammar-consistency.test.mjs
```

进程 exit 0，63 tests / 63 pass / 0 fail / 0 skipped，58142 ms。
包括 Chromium 编辑题干/答案、语法文字保存/刷新/正式再发布；SQL 并发冲突和权限拒绝。

执行新增诊断（先将本目录测试副本放入隔离源码 tests）：

```sh
node --test tests/authoring-closure-audit.test.mjs
```

exit 0，3 tests / 3 pass / 0 fail / 0 skipped，992 ms。
诊断断言“错误确实被拒绝”，不是断言词汇/新脚本编辑已可发布。

关键被测文件 SHA256：

| 发布源码相对路径 | SHA256 |
| --- | --- |
| src/features/digital-textbook/workbench/service.server.ts | 3c78fbb62f8e0eb3fcd7a506f44a6ae14764d62168b1d4a473085604ca2ef3f2 |
| src/lib/smart-textbook-legacy-adapter/adapter.server.ts | 60ccdfd1d64f442b93d79285c694ef11281159256cb99afa3d0e511003de23f7 |
| src/lib/smart-textbook-legacy-adapter/identity.server.ts | 2a676789a1c1dc48666e62272e71aacf7388f174110ca0a90c56122e79bd39ab |
| src/lib/smart-textbook-publishing/publisher.server.ts | 05434fe2097f6b7568bc0e455aa5d589fb829b5bef1eecc99534196476e58fdf |
| src/features/smart-textbook-runtime/server/audit-source.server.ts | 3588e1d8dda0e6d4d2215b78f8dae604bc5c7b53d208e9aa4305fd8c4655f534 |
| src/app/dashboard/admin/digital-textbook/actions.ts | 144e824442bc1ae525ceec3b831ef4bf05ae7970a589b4f69f87489f64b56614 |

注意主开发目录并非此发布基线：其中没有 workbench/service.server.ts，publisher 和旧词汇 actions SHA 也不同。没有将发布目录覆盖回主目录。后续修复必须基于发布源码的隔离副本并制作可审查 patch。

主工作区 `git diff --check` 通过。此次只增加报告和诊断证据，不改业务文件；未重跑全量构建/回归。该记录为工具执行摘要，不是原始日志。
