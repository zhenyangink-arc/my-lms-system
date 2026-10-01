# 来源

从 EduMath 仓库 `packages/math-core/src/expression/` 固定拷贝（最后修改提交 `a7458dd`，2026-10-01）。
只改了一处：相对导入的后缀 `.js` → `.ts`，以便本项目直接运行。**不要在这里手改逻辑**；
需要升级时重新拷贝并核对 `files.sha256`，同时同步 `mathjs` 版本（当前 15.2.0）。

## 本地改动清单（共两处，均不改变行为）

1. 相对导入后缀 `.js` → `.ts`。
2. `validate.ts` 的 `Converter` 构造函数：参数属性（`private readonly` 写在参数里）展开为显式字段赋值，
   因为 Node 的 `--experimental-strip-types` 不支持参数属性。

因此 `files.sha256` 是**本地改动后**的指纹，用于发现意外手改；与上游对比时需先还原这两处。
