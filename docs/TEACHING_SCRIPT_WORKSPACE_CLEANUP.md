# 教学脚本工作台整理

日期：2026-09-13。开发基线：`b167239`。入口：`/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts`。

## 完成的整理

| 原来 | 现在 |
| --- | --- |
| 整章状态卡重复列出左侧已有的全部步骤 | 删除重复卡片，页头只保留当前章节和正式脚本覆盖数量 |
| 学生检查和教材复核全部占据编辑器上方 | 收入“复核与发布检查”，按需要打开 |
| 检查表单默认要求关注学生查询 | 默认检查章节；指定学生的开放条件核验作为可选项 |
| 六轨教学编排轴默认展开 | 默认直接编辑台词，“流程总览”打开原编排轴 |
| 小节设置为多排大卡片和重复说明 | 四项紧凑入口，保留键盘切换、状态和辅助说明 |
| 开场过渡一次铺开全部预设 | 默认收起，原有未匹配台词或校验错误时自动展开 |
| 人物与站位编辑器直接占据内容页 | 收入高级设置，保留原输入、模板和画面预览 |
| 归档小节也显示“已发布 · 只读” | 按实际版本显示“已归档 · 只读” |
| 发布按钮容易与整章教材发布混淆 | 明确发布当前步骤的脚本，教材快照更新仍需教材工作台 |

使用 ui-ux-pro-max 的渐进展示、导航层级规范及 ui-styling 的响应式与可访问性规范；复用现有样式 token 和 CardTitleWithHint。未重新定义配色系统。

## 编辑问题修复

Chromium 的真实组件测试复现：首次替换台词，表单 `onInputCapture/onChangeCapture` 的 dirty 更新触发受控文本框重绘，首个输入会被旧值覆盖。

改为表单冒泡阶段的 `onChange={markDirty}`，让子文本框先更新值。测试覆盖逐字输入、未保存切换取消、完整表单提交，确认保存的台词与输入一致，人物与过渡台词的折叠字段未丢失。自动保存、版本 CAS 和服务端校验仍复用原实现。

## 保留与权限

保留编排轴、流程连接、循环检测、路径预演、小节排序/新增/删除、草稿创建、历史版本查看、预览、脚本发布、教材复核、黑板、学生任务/反馈、语音预设、人物与视频配置。

这些功能存在真实调用，不能因为默认收起就认定为废弃代码。本轮删除的是重复展示和冗余正文，不删除数据库记录、脚本、人物素材或学生运行代码。

`service.ts → getTeachingScriptStudioData → requirePlatformOwner` 与 `actions.ts` 的平台负责人校验未改动。复核和开放条件核验同样保留原 Server Action 权限。机构负责人和成员没有新增管理入口。

## 修改文件

- `src/features/learning-agent-script-studio/TeachingScriptStudio.tsx`
- `src/features/learning-agent-script-studio/TeachingScriptNodeForm.tsx`
- `src/features/learning-agent-script-studio/ChapterReleaseCheckPanel.tsx`
- `scripts/verify-teaching-script-workspace.mjs`：独立 Chromium 组件测试；真实组件与 CSS，模拟 Server Action 传输。

上述三个业务文件修改前 SHA 与 release source 一致；随后经用户“部署”授权，将限定补丁部署到该 release source。

## 验证

- TypeScript：通过。
- 修改文件 ESLint：通过。
- 教学脚本、视频、黑板、角色、课程工作流相关测试：56/56 通过。
- 管理路由测试：15/15 通过。
- 教材复核数据库用例：因未提供 `LMS_PGLITE_MODULE` 跳过 1 项；本轮没有数据库代码变更，不把此项计入通过。
- Chromium：真实组件挂载、首字输入、未保存切换取消、保存字段、人物高级设置、路径预演、步骤/小节/版本切换、归档只读、检查/复核/发布 Action 参数、375/768/1440 宽度无页面横向溢出、深色模式截图、无 JavaScript 异常。
- `git diff --check`：通过。

截图及运行结果：`docs/evidence/teaching-script-workspace-20260913/`。

浏览器数据是隔离的编辑器样本，Server Actions 使用显式测试传输。未登录负责人账号、未调用生产数据库、未验证生产发布成功。未重新运行上一轮已有三个失败点的全项目回归，不将局部验证称为全项目通过。

## 交付状态

代码整理完成，已按用户后续授权部署。仅更新三个界面文件并重启 `uply-first-enable`，没有数据库迁移、素材操作或教材内容发布。

- 补丁：`docs/TEACHING_SCRIPT_WORKSPACE_CLEANUP.patch`
- SHA256：`2874302c3e7fac036c74967293ca9bac917eff7d50b106eddbf8918d98513e61`
- 候选与恢复目录：`/home/yangzhen/releases/uply-first-enable-20260910/teaching-script-cleanup-2026-09-12T16-54-58-774Z/`
- 原 Build ID：`qX34cUVT8awF_Ub2SwWQv`
- 新 Build ID：`tzDuUQsyt9UoOEYH-3enB`
- 生产构建：直接执行 Next webpack build，不在真实配置下执行 npm prebuild 测试。
- 激活前源码和配置摘要复核通过；保留原 `.next` 与三个文件备份。
- 本机首页健康检查 HTTP 200；Tailscale HTTPS 8443 教学脚本入口 HTTP 200。
- 其他服务进程 PID/状态无变化。
- 已登录负责人页面交互仍需正常登录查看；HTTP 健康检查不代表生产编辑/发布验收通过。
