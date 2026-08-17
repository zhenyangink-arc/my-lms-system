# Coming-soon student app home

- Route: `/[space]/apps/english`, `/[space]/apps/math`, `/[space]/apps/university` (all render `StudentApplicationHome` with `appSlug` set accordingly)
- Audience: Student
- Archetype: Learning overview (minimal / under-construction variant)
- Primary job: 明确说明该应用正在独立建设，且不会复用韩语学习数据；提供清晰返回路径。
- Primary action: 返回应用门户（Portal）。
- Information hierarchy: 单一说明卡片（应用状态 → 简短说明 → 返回操作），无次要内容。
- Layout and density: 与其他 Student OS 页面共享 shell（Student sidebar/topbar），内容区为单张 `app-card`，桌面宽度 1024–1920px 内自适应。
- Special components: 无——复用与 Study-abroad 首页相同的 `StudentApplicationHome` 组件（`isStudyAbroad` 为 false 时走此分支），因此继承该组件的令牌、焦点和图标处理，不建立独立视觉方向。
- Allowed deviations: 无——三个应用共用同一组合，不为单个应用定制内容或颜色。
- Accessibility risks: 已在 Batch 4 对 `StudentApplicationHome.tsx` 的审核中一并修复：图标已标记 `aria-hidden`，返回链接具备 `focus-visible` 焦点环，语义令牌替换了所有原生色，卡片内仅一个语义副标题（H2），与 Shell 提供的 H1 不冲突。
- Acceptance criteria: 三个 slug（english/math/university）渲染结果一致；返回门户链接键盘可达且有可见焦点；无原生 hex/rgba；无 `--app-*` 遗留令牌；单一 H2，无标题跳级。

## Audit note (Batch 5, 2026-08-17)

`StudentApplicationHome.tsx` 已在 Batch 4（Study-abroad primary packet）完整审核并修复，其 `!isStudyAbroad` 分支（第 169–195 行）正是本页面的实现。直接复核确认：`focus-visible` 环、`aria-hidden` 图标、语义令牌（`var(--status-warning)`、`var(--accent)` 等）、单一 H2、清晰返回路径均已到位，无需额外代码改动。Batch 5 判定为 Approved，基于对已完成实现的独立复核，未下发新的 Codex 任务包。
