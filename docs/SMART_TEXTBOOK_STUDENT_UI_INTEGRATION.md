# 第一章学生 UI 隔离整合

## 工作副本与边界

- 隔离整合目录：`/tmp/uply-student-ui-integration.bUmZfS`。
- 起点：`/home/yangzhen/releases/uply-first-enable-20260910/source` 的当前源码复制，不含 `.env*`、构建产物、Git 或真实配置；仅链接开发依赖。
- 将开发目录已完成的场景图、对话分组/播放、工具栏、返回课程组件逐文件合入副本。没有将开发目录整体覆盖运行候选。
- 保留候选专有的 production boundary guard、内容读取去重与 boundary diagnostic。主开发目录仍缺正式入口，不能作为部署来源直接覆盖候选。
- 本轮不部署、不重启、不启用开关、不操作远端数据库或对象存储。

## 已接线

1. 课程页 `courseDirectoryHref` → `PublishedRuntimeEntry.backHref` → `LessonRuntime` → 顶部返回链接。
2. 语言选择仅通过正式入口注入；通用 Renderer 未提供宿主能力时仍只显示实际语言。
3. 用户确认未提交输入丢失后，入口卸载当前 Runtime、关闭 Teacher，再发送 opaque session + locale。
4. `changeRuntimeLanguage` 重新解析当前授权会话、检查入场条件，调用原 `saveSmartTextbookPreferenceAction`；成功后撤销旧会话。客户端删除旧 locator，刷新并由原 bootstrap 建立新会话，不原地修改 context。
5. 不改变 Activity、录音、判题、学习完成或 published snapshot。语言偏好为既有表的原服务操作；本轮只在隔离数据库验证。

## 验证记录

- Next 本地 typegen 后 TypeScript 通过（新复制目录最初缺 RouteContext 生成文件，不是业务类型错误）。
- 界面、会话、场景图和语言服务测试 29 项通过。
- 原正式入口/隔离 PostgreSQL 联合链 10 项通过；该次尚不包含语言切换正向断言。
- 新增语言正向浏览器断言后发现 select 可访问名称不明确，已补显式 aria-label。最终正式应用入口 + 隔离 PostgreSQL + Chromium 联合测试 10/10 通过（约 170 秒）：正常页面切换韩语、新 opaque session、旧会话 bootstrap 返回 409、返回课程真实 href、刷新、关闭新入场均已验证。不是线上账号 E2E。
- 隔离测试的偏好表新增与原服务相匹配的 support_mode、updated_at、唯一键，SQL transport 只允许这张表的指定 upsert；没有新增生产 migration。
- `git diff --no-index --check` 检查相关源码差异无空白错误（返回 1 表示存在差异）。

## 尚未完成

真实图片视觉验收和候选部署尚未完成。场景图独立的真实 frozen binding + 隔离 PNG 测试通过；隔离 PNG 不是线上真实插图，不得把页面成功激活写成真实场景图验收通过。

## 全仓回归与构建补充

隔离 `next build --webpack` 已通过，包含 TypeScript 与页面生成。使用 localhost 不可用地址/明确占位 key，直接构建而非触发 prebuild；该构建不得部署或作为真实配置构建。日志：`/tmp/uply-student-ui-integration-build.log`。

首次全仓回归暴露以下测试接线问题，原失败日志保留在 `/tmp/uply-student-ui-integration-regression.log`：

- 初次复制排除了 `.env*`，导致验证公开配置示例的测试找不到 `.env.example`。仅补回与主目录相同的公开 example，没有复制任何真实环境文件；该测试组重新运行 9/9 通过。
- 发布闭环测试和录音 SQL 联合测试未提供新增图片字节传输，分别报告缺 R2 配置及图片 port。补充隔离 PNG 传输，仍调用真实 source/binding/权限与 MIME/大小校验；不使用真实 R2 凭据解决测试问题。
- Teacher 停止测试原先断言页面全部 Blob 清零；学习情景图现在独立挂载，停止 Teacher 不应销毁它。改为所有残留 Blob 必须由当前情景图持有，后续 Step 切换仍断言全部释放。Teacher 生命周期重跑 7/7 通过，未放宽教师音频/角色释放要求。

最终全仓回归 **1203/1203 通过，失败/取消/跳过均为 0**（约 288 秒），日志：`/tmp/uply-student-ui-integration-regression-final.log`。命令为 `node --no-warnings --experimental-strip-types --test --test-concurrency=4 tests/*.test.mjs`，指定现有隔离 PGlite 模块。涵盖实际 published Loader → durable session → strict complete Chromium、Teacher 生命周期、录音 mounted → PostgreSQL 原子事务 → Reader → UI、正式应用入口/语言切换，以及现有 legacy 回归。

独立 `tsc --noEmit --incremental false` 通过。源码和测试相对候选的 `git diff --no-index --check` 无空白错误。构建自动添加的 `.next-ui-isolated` tsconfig include 已移除，不进入补丁。

累计补丁 1080 行，SHA256：`8ba9e46cd9f67d172694f4840ffd1dc3760869f0881d9ca0b2c8d4e004695bec`。该补丁包含前轮 UI 整合及本轮测试接线修正，不应再叠加前轮同名旧补丁。基线为上述运行候选 source 的 src/tests；没有应用到运行目录。

结论：隔离代码整合、全回归和隔离构建完成；真实场景素材与八 Step 逐页视觉对照、线上账号验收、正式配置构建及部署仍未完成。当前线上界面不会因这次隔离修改自动变化。

## 后续逐页验收更新

详见 `SMART_TEXTBOOK_STUDENT_UI_VISUAL_REVIEW.md`。新增八 Step 桌面/窄屏就绪截图，修正选中 Step hover 低对比及投影器过期“尚未实现”提示；能力门禁不变。最新完整回归 1204/1204、隔离构建（含 TypeScript）通过。最新累计补丁 SHA256 为 `d5a9198841fe048703bfaa12a20f81eea9c7bbeb26f4f0dd4bf762c363c26e61`，取代上方旧摘要，不重复叠加。尚未部署，旧版视觉等价仍有明确待办。

当前用户线上页面未更新。本目录在 /tmp，不能称为持久发布交付目录。最终 TypeScript 通过。累计整合补丁保存为同目录文档旁的 `SMART_TEXTBOOK_STUDENT_UI_INTEGRATION.patch`，基于本轮复制时的运行候选 source；只含 src/tests 差异，不含配置、密钥或构建产物。应用前仍需核对运行候选之后的变更，不可直接叠加到不同基线。
