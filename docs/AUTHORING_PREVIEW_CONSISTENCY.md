# 已保存内容预览与发布诊断修复

2026-09-13。范围：第一章负责人制作闭环的首项修复；不扩展词汇编辑、Teacher 版本制作、模板编辑器或新 Runtime。

## 1. 交付与基线

- 被核验的部署源码：`/home/yangzhen/releases/uply-first-enable-20260910/source`。
- 实施副本：`/tmp/uply-authoring-preview.vdCvP1`，没有真实 `.env.local`，没有运行服务连接该目录。
- 持久补丁：`docs/AUTHORING_PREVIEW_CONSISTENCY.patch`。
- 持久代码：`docs/evidence/authoring-preview-consistency-20260913/candidate/`。
- 修改前文件与逐文件 SHA：同目录 `baseline/`、`patch-manifest.json`。
- 这是**当前已部署四板块导航版本之上的增量补丁**。不重复叠加四板块累计补丁，不直接套用到尚未同步部署代码的主开发目录。
- 主目录 HEAD `b1672390ae96357a2143358235cc10edeff8d488`，用户原有六个业务修改保留；本轮业务代码只在隔离副本修改。

## 2. 修复内容

### 同一编译与准入链

原预览：两个独立 Reader → 固定身份表 → finalizer。

现在预览：负责人授权 → `compileChapterOnePublication` → 一致 SQL capture → `publicationIdentities` 合并已保存语法身份 → finalizer → 现有媒体准入策略和快照完整性校验 → `assertPublishableSnapshot` → 隔离审计会话 → 原 `AuditRuntimeClient` → strict complete `LessonRuntime`。

预览不调用 publisher 的 publish 操作，不改 pointer、不创建正式学习记录；不是另建 Preview Renderer。相同保存内容的 Manifest、私有 bindings 与正式 compiler 完全一致。旧的已消费 grant/不匹配的录音审计 continuation 不因本次修复复用。

预览上下文明示 `sourceState='draft'`、`trackingDisabled=true`。页面说明“打开本页时已保存内容”，区别未保存表单和学生已发布版本；移除“兼容执行器尚未通过验收”的过期文案。

证据：`src/features/smart-textbook-runtime/server/audit-source.server.ts`、`src/lib/smart-textbook-publishing/publisher.server.ts`、`src/app/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/runtime-v1-preview/page.tsx`。

### 真实审计服务传参修复

联调实际发现 `audit-learning-boundary.server.ts` 的 local request 把 snapshotId 传入只接受 sessionId/capsuleRef/locale 的四个严格 action（learning、activities、pages、patterns），导致 Zod 拒绝。

修复只去除服务内部多余参数，**不放宽 action schema**。snapshot 仍由 server-owned session 解析和绑定；其他本来需要 snapshotId 的 flow/recording/repeat 请求保留。

### 可定位且不泄露私密数据的诊断

- 发布 compiler 保留非 UI unsupported 的分类，投影成 owner-only 的 code、固定 Step 标题/ID、类别、说明和处理入口。
- 支持区分：内容身份、内容结构、教学脚本、媒体、运行绑定、capture 与格式问题。
- 媒体重新审计错误根据服务器 binding 定位对应 Step，不回传媒体 key、私有 URI 或原始异常。
- 未识别异常仍失败关闭，只显示一般安全提示；不猜测“已修好”，不跳过检查。
- 工作台显示可聚焦错误摘要，允许定位合法学习步骤；预览编译失败时给出安全提示和返回工作台入口，不启动半成品预览。
- 不直接输出原始 JSON path、异常 reason、SQL、answer_key 或脚本私有配置。单选题正确项仍只通过既有负责人编辑 DTO 显式提供，没有扩大到学生 DTO。

证据：`src/lib/smart-textbook-publishing/diagnostics.ts`、`diagnostics.server.ts`；`src/features/digital-textbook/workbench/{publication-issues.tsx,service.server.ts,contracts.ts,chapter-workbench.tsx}`。

## 3. 安全与产品边界

- `platform_owner` 在预览读数据与每个工作台操作重新授权；机构负责人、教师、学生不能读取诊断或管理内容。
- 没有修改 Manifest schema、稳定 ID、语音选择、grader、录音事务、发布 CAS 或依赖 fence。
- 词汇未重绑定、新脚本 v24、变化的媒体依然被拒绝；**本轮只让错误可定位，没有把这些制作能力变成可发布**。
- 没有 migration、生产 SQL/对象存储调用、发布教材、gate 修改、PM2/代理操作、旧代码删除或测试学生作答。

## 4. 验证

### 新增专项

`tests/chapter-authoring-preview.test.mjs` + `tests/fixtures/authoring-preview.server.ts` 使用网络隔离的实际 PostgreSQL、正式应用 compiler/publisher/Loader、现有 owner audit learning boundary 和实际 AuditRuntimeClient。

已验证：

1. 语法保存后预览/发布 Manifest 与 bindings 完全一致，8 Step、19 Activity、orientation 三题、v23 保持。
2. 修改后旧审计 continuation 明确拒绝；预览没有更新 pointer、attempt/evidence。
3. Chromium strict complete 实际预览显示修改后的语法，页面 reload 恢复。
4. 非 owner 无法调用预览编译或查看工作台诊断，恶意异常字符串不回显。
5. 词汇修改同时阻断 check 与预览，错误摘要获得焦点并能定位 Step。
6. 媒体改动、新脚本版本同时阻断预览和发布，原校验保持。
7. 重新发布后正式 Loader 得到相同 digest；预览没有写正式学习记录。

浏览器只隔离认证/传输与媒体字节，不是假 Runtime、Inspection 或合成领域完成。不是用户真实账号的生产 E2E；本轮没有负责人登录操作。

专项初次联调发现的测试 harness 输出配置、浏览器 process.env 构建替代、Loader 返回包层级均已修正；随后发现并修正上述真实 audit request 问题。最终结果以同目录最终回归日志为准，不把失败轮次计为通过。

### 最终结果

- 新增专项：**7/7 通过**。最终全量也包含相同专项和 1440/375 宽度检查，错误摘要可见、焦点正确、无横向溢出。
- 完整回归：**1233 项，1229 通过，0 失败，4 跳过**，236.0 秒。日志：`docs/evidence/authoring-preview-consistency-20260913/regression.log`。
- 四个既有可选 PGlite 测试未配置 `LMS_PGLITE_MODULE`，涉及章节引用 SQL、策略版本、教学运营、来源复核；不把跳过算作通过。本轮发布/预览/录音/会话的其他真实隔离 PostgreSQL 测试均通过。
- 生成 Next 路由类型后，`tsc --noEmit --incremental false` 通过。第一次空构建副本没有 RouteContext 生成类型，运行 `next typegen` 后解决，不改业务类型来绕过检查。
- 纯 `next build --webpack` 隔离构建通过；未调用 npm prebuild。仅使用 `isolated-build.invalid` 与明确的占位配置，不持有真实 Supabase/R2 配置。**该占位构建不能拿去生产运行**；未来获批部署时需重新真实配置构建。
- 主目录 `git diff --check` 通过；增量 patch 在修改前隔离基线上 `git apply --check` 通过；12 个变更文件的部署基线 SHA 再次核对未变化。
- patch SHA256：`d42d2ec92273a04f77cebe4f7ca2673af45d584ed24511611c4696bbe1cff15f`。
- 视觉证据：同目录 `diagnostics-1440.png`、`diagnostics-375.png`；已实际查看手机图，未重新设计页面。

## 5. 尚未完成与下一步

### 本次部署前核验：暂停，未变更服务

2026-09-13 用户批准部署后，候选 patch 与发布源码逐文件 SHA 核验通过，但进程基线不一致，部署脚本以 `UPLY_PROCESS_MISMATCH` 拒绝继续。

- 当前 PM2 没有预期的 `uply-first-enable`；存在 `uply-dev`，命令为 `npm run dev`，工作目录为主开发目录。
- 实际 3000 端口的 Next 进程工作目录也是 `/home/yangzhen/projects/my-lms-system`；8443 仍代理 `127.0.0.1:3000`。
- 当前系统启动时间为 2026-09-13 17:59:06；是否因重启恢复了旧 PM2 清单尚未确认，不据此自动修改清单。
- 尚未真实构建、停止服务、应用补丁、迁移或发布教材。主开发目录业务代码和其他服务未修改。
- 需确认是否停止当前占用 3000 的 `uply-dev`，恢复发布目录的 production 启动服务并部署本补丁；不把补丁套用到不同基线的主开发目录。

- 本补丁已于下述授权恢复步骤部署；此前“未部署”记录为交付时状态。
- 安全词汇编辑、单选题选项编辑、新教学脚本版本制作与复杂活动编辑仍是后续独立缺口。
- 建议先审查/部署本次最小修复并由负责人验收“改语法 → 预览 → 校验发布”；随后再做词汇文字的身份/媒体/发布闭环，不继续改布局。
- UI/UX skill 影响：采用可聚焦错误摘要、自然语言原因和操作入口，保持原有语义配色及页面结构，没有引入装饰标签或新组件体系。

## 6. 授权恢复正式服务及部署结果

用户明确允许停止 `uply-dev`、恢复发布目录正式服务后，2026-09-13 完成：

- 再次核对增量 patch SHA、12 个候选文件与发布源码基线，无冲突；未向主目录回写业务代码。
- 独立目录使用受限真实配置执行纯 `next build --webpack`，成功；没有调用 npm prebuild 或在真实配置下运行测试。
- 停止 `uply-dev` 并确认 3000 无监听后，保存旧源码与完整 `.next`，安装候选，使用原受限 `start.mjs` 启动 `uply-first-enable`。
- 部署目录：`/home/yangzhen/releases/uply-first-enable-20260910/authoring-preview-2026-09-13T10-11-59-344Z`；包含私有 `deployment.json`、`build.log`、`before/`、`previous-next/` 和 staged 源码。未删除旧构建。
- 旧 Build ID：`z3R-kXi6vrpDHJLLoR9GM`；新 Build ID：`LuAZe2VMY32YjOo1WvtrC`。
- localhost:3000 和 Tailscale HTTPS8443 的首页、负责人工作台、Runtime 预览入口共六项匿名检查均为 200，并检测到登录响应；不是负责人真实登录 E2E。
- 原开发服务工作台 404 已消失。其余 PM2 服务 PID/status 与切换前一致；Tailscale 代理、受限运行配置摘要未变。
- 没有数据库迁移、教材发布、gate/cohort 调整、测试学生数据操作。未修改 PM2 开机恢复清单；本次确认的是当前正式进程在线，不声明重启后的自动恢复已验证。

负责人待验收：正常登录工作台 → 打开“预览已保存内容” → 核对保存的内容和错误定位。不需要为了应用本次代码修复重新发布教材。
