# 第一章学生界面逐页核验

## 范围与证据边界

在 `/tmp/uply-student-ui-integration.bUmZfS` 验证，不回写运行候选，不访问真实数据库/对象存储，不部署。使用 UI/UX 清单检查桌面 1440px、窄屏 375px、内容溢出、选中态和导航。

两类测试不能混淆：

- `smart-textbook-runtime-4a9-browser.test.mjs`：冻结教材内容、隔离领域传输的开发组合页。适合检查学习交互、几何与 hover，不证明完整正式入口。
- `smart-textbook-runtime-4b1b.test.mjs`：真实 PublishedRuntimeEntry、application HTTP、publisher/Loader、durable session、隔离 PostgreSQL，strict complete Runtime。认证和媒体传输隔离，**不是正常账号线上 E2E**。

截图启用变量仅在测试代码中读取：`UPLY_UI_SCREENSHOTS`。正式应用不读取此变量。截图必须等待正文及子活动就绪，不能以 networkidle 或标题出现替代内容就绪。

## 本轮发现与修复

1. 当前 Step 的白字深色背景被更高优先级的通用 hover 浅色背景覆盖。新增选中 Step 的明确 hover 规则，仍使用原语义颜色，不改变 Step identity/navigation。浏览器断言覆盖八 Step、两个宽度的选中态背景保持。
2. `runtime-content.server.ts → projectLearningContent()` 曾按任何非 orientation activity 无条件添加“复杂活动尚待完成、本投影仅显示教学内容”。这是 Phase 4A 早期遗留判断，不能表达当前 executor 状态。移除该活动名称推断；保留 Runtime capability validator、required unsupported 拒绝及各服务错误处理，未把 unsupported 强制清空以绕过门禁。
3. 发布隔离场景图的测试 PNG 原可返回 MIME，但实际图片解码失败。替换为已有通过浏览器解码的隔离 PNG，增加 naturalWidth 正向断言。仍非真实教材插图，不是资源修复或生产媒体验收。

## 八 Step 核对项目

| Step | 核对内容 | 验收边界 |
|---|---|---|
| orientation | 内容、目标、对话分组、三题、情景图字节 | 原场景画面的美术效果仍待实际素材对照 |
| vocabulary | 词汇卡、词义活动与逐项恢复 | 沿用现有点读能力，不制造预生成音频 |
| grammar | 语法卡、例句、六页流程 | 仍使用原服务判题 |
| patterns | 句型、选择/排序/表达连续流程 | 不调整原完成规则 |
| dialogue | 情景对话、角色扮演及证据 | 图片为隔离字节；真实录音账户验收未做 |
| listen_speak | 听力、两轨十四句跟读、口语 | 不把播放/练习标记当正式完成 |
| read_write | 阅读、写作与恢复 | 不增加第二套 grader |
| review | 自查、多选与导航约束 | 不放宽章节测试权限 |

## 尚不能宣称完成

八 Step 的几何和真实服务隔离验收不等于旧版视觉完全等价。当前仍需旧版/新页面使用同一真实素材逐页对照；尤其旧版情景大图、内容首屏优先级、教师呈现与正文信息密度。不能将隔离 1px PNG 截图作为美术验收或拿开发组合页的 Teacher 空白作为线上故障结论。

线上没有更新。本轮产出仅为隔离代码、测试和累计补丁，不触发发布或重启。

## 最终验证

- 全仓回归 **1204/1204 通过**，失败/取消/跳过为 0，约 463 秒。日志 `/tmp/uply-student-ui-visual-full2.log`。包含正式应用入口逐页就绪、语言重建、SQL 录音事务、Teacher 和 legacy。
- 隔离纯构建 `next build --webpack`（含 TypeScript）通过，日志 `/tmp/uply-student-ui-visual-build2.log`；占位配置构建不可部署。
- 正式入口的桌面/窄屏共 16 张截图保存于 `docs/evidence/student-ui-20260911/`。`1440-step-N.png` / `375-step-N.png`，N=1…8。媒体是显式隔离 PNG，不能展示真实原画；其中白色图片占位不是生产素材缺失证明。
- 逐页检查未见页面级横向溢出，当前 Step 信息与八项导航一致；正文与子活动均等待就绪后截图。选中 Step hover 仍保持对比度。
- 对比用户旧版截图，尚未达到旧版视觉等价：非首步教学区首屏留白、说明卡片挤占首屏、实际大图效果仍待处理。后续应先收口信息层级与教师区域呈现，不再追加后端架构，也不直接部署宣称完成。
- UI/UX 技能的几何、可访问状态检查促成本轮 hover 修正及“就绪后截图”验收；未新建视觉系统。
