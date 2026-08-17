<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Notes

- 4%， 形态 5% ，例句展示语音 5%, 注意事项 20%，来源 5%， 都改一下吧

## 学习界面文案与信息层级

- 默认不要生成纯装饰性的英文眉题、栏目标签或技术类型标签，例如 `KOREAN LEVEL ONE · 1A + 1B`、`LEARNING JOURNEY`、`COURSE OUTCOMES`、`READY TO START`、`INTERACTION · SINGLE CHOICE`。
- 智能教材的数据源不得保存 `eyebrow`、`typeLabel`、`interactionLabel` 等装饰性标签字段；渲染器也不得根据活动类型自动拼接英文类型标签。只保留对学习有直接作用的自然语言标题。
- 不要为了营造视觉氛围自行添加全大写英文说明。界面文案使用当前界面的自然语言；实际外语教学内容不受此限制。
- 学习卡片默认只直接显示简洁标题。用于解释标题的场景、背景或操作说明应放在标题右侧的简洁圆形叹号图标中，不要在卡片正文重复展示。
- 圆圈是叹号图标自身的组成部分；图标外面不要再增加按钮背景圆、外框或装饰底色。提示必须支持鼠标悬停、键盘聚焦和触屏点击，并提供可访问名称；详细说明只在触发提示后显示。
- 凡学习卡片存在“标题 + 补充说明”，必须复用 `@/components/ui/card-title-with-hint`；不要在业务页面内重复实现叹号按钮或 Tooltip。当前卡片和以后新增的卡片均遵循此规则。
- 导航和概览只保留定位所需的信息，详细内容放在正文或提示中。
