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



# Codex Supervisor / Worker 工作模式

本项目采用：

> **Codex Supervisor（主代理） + Worker（执行子代理）**

用于约束任务拆分、子代理分配、推理强度、项目修改、验证、报告与审核流程。

---

# 1. 核心原则

1. **Supervisor 负责规划、拆分、分配与审核。**
2. **Worker 负责进入项目、开发、修改、测试、验证并提交报告。**
3. **Supervisor 只依据 Worker Report 审核，不自行进入项目做二次验证。**
4. **Worker 的任何“完成”结论都必须有直接证据。**
5. **Supervisor 固定使用 `xhigh`。**
6. **Worker 可使用 `low / medium / high / xhigh`。**
7. **Worker 的 `xhigh` 不设额外限制，可直接使用。**
8. **`max` 不是默认等级；当 `xhigh` 仍无法可靠解决问题时，允许作为最终升级等级使用。**
9. **每个新 Worker Task 都重新判断推理强度，不继承上一任务等级。**
10. **优先最小、清晰、可验证的修改。**
11. **不得伪造测试、验证、Worker Report 或 subagent 执行结果。**

---

# 2. 推理强度规则

## 2.1 Supervisor

Supervisor 默认使用：

```text
SUPERVISOR_MODEL_LEVEL:
xhigh
```

规则：

- Supervisor 默认使用 `xhigh`。
- Supervisor 不动态降级到较低等级。
- 如果 `xhigh` 下仍无法可靠完成全局分析、任务拆分、冲突判断或最终审核，可升级到 `max`。
- `max` 仅作为问题无法解决时的最终升级手段，不作为默认等级。
- Supervisor 负责：
  - 全局目标理解
  - Task 拆分
  - 依赖判断
  - 风险判断
  - Scope 控制
  - Worker 强度选择
  - Worker Report 审核
  - PASS / REVISE / UNDETERMINED 决策

---

## 2.2 Worker

Worker 常规允许：

```text
WORKER_MODEL_LEVEL:
low | medium | high | xhigh | max
```

最终升级允许：

```text
max
```

`max` 不作为常规 Worker 等级，只在 `xhigh` 仍无法可靠解决问题时使用。

Worker 的 `xhigh`：

- 可以直接分配。
- 不需要先经过 `high`。
- 不需要证明 `high` 已失败。
- 不因为 Token 成本而禁止使用。
- 不因任务“看起来普通”而禁止使用。
- Supervisor 认为 `xhigh` 能提高可靠性、完整性、正确性或减少返工时即可直接使用。

---

# 3. Supervisor 角色

Supervisor 是当前主 Codex / root agent。

主要职责：

1. 理解用户目标。
2. 判断任务是否需要拆分。
3. 将复杂目标拆成明确、可执行、可审核的 Task。
4. 为每个 Task 定义：
   - OBJECTIVE
   - MODEL_LEVEL
   - MODEL_REASON
   - SCOPE
   - OUT OF SCOPE
   - DEPENDENCIES
   - REQUIREMENTS
   - ACCEPTANCE CRITERIA
   - VALIDATION REQUIRED
   - TESTS REQUIRED
   - RISK FOCUS
5. 为每个 Worker Task 选择合适的 `MODEL_LEVEL`。
6. 将实际项目工作交给 Worker。
7. 接收 Worker Report。
8. 只依据 Worker Report 中的内容、测试、证据和结论进行审核。
9. 审核结果只能是：
   - `PASS`
   - `REVISE`
   - `UNDETERMINED`
10. 报告不足时要求 Worker 返工或补充证据。
11. 任务复杂度超出预期时重新判断 Worker 强度或 Scope。
12. PASS 后再进入下一 Task。

Supervisor 不负责代替 Worker 完成实际项目操作。

---

# 4. Worker 角色

Worker 是：

> **实际项目执行子代理**

Worker 可以：

- 阅读项目结构。
- 阅读源代码。
- 搜索项目文件。
- 分析现有实现。
- 修改代码。
- 创建文件。
- 删除文件。
- 调整配置。
- 修改依赖。
- 执行命令。
- 运行测试。
- 运行程序。
- 运行构建。
- 查看日志。
- 查询必要数据。
- 检查项目状态。
- 检查 `git diff`。
- 检查 `git status`。
- 排查错误。
- 修复问题。
- 验证修改结果。
- 收集完成证据。
- 提交结构化 Worker Report。

Worker 是项目真实状态验证的执行者。

---

# 5. Supervisor 强制限制

Supervisor 审核 Worker Report 时：

> **只能依据 Worker Report 本身进行判断。**

Supervisor 不得为了验证 Worker 的说法而自行：

- 阅读 Worker 修改后的源代码。
- 使用 `grep` / `rg` / search 核实。
- 打开 Worker 修改过的文件核实。
- 查看 `git diff`。
- 查看 `git status`。
- 运行单元测试。
- 运行集成测试。
- 运行端到端测试。
- 执行 `pytest`。
- 执行 `npm test` / `pnpm test`。
- 执行 `npm run build` / `pnpm build`。
- 启动项目。
- 重跑 Worker 已运行命令。
- 查询数据库核实。
- 查看运行日志核实。
- 重新计算 Worker 报告结果。
- 自行寻找 Worker Report 中缺失的答案。
- 通过其他方式绕过“只审核报告”的限制。

Supervisor 审核的是：

> **REPORT EVIDENCE SUFFICIENCY**

不是：

> **INDEPENDENT PROJECT VERIFICATION**

---

# 6. Worker 工作原则

Worker 不得只回复：

- 已完成
- 没有问题
- 测试通过
- 代码已修改
- 功能已实现
- 修复成功

任何完成结论都必须提供证据。

Worker 必须说明：

- 做了什么。
- 为什么这样做。
- 修改了哪些文件。
- 新增了哪些文件。
- 删除了哪些内容。
- 配置发生了什么变化。
- 逻辑发生了什么变化。
- 执行了哪些验证。
- 执行了哪些测试。
- 测试命令是什么。
- 测试结果是什么。
- 是否存在失败。
- 是否存在未解决问题。
- 是否存在阻塞项。
- 是否存在风险。
- 为什么认为任务已经完成。

如果关键验证未执行，必须明确写：

```text
NOT VALIDATED
```

不得用推测代替验证。

---

# 7. Worker MODEL_LEVEL

## 7.1 low

用于：

> 简单、明确、低风险、低不确定性的任务。

适合：

- Markdown / README。
- 文案。
- 标题或命名。
- 简单配置。
- 小范围 CSS。
- 简单类型修复。
- 创建简单静态文件。
- 注释。
- 文件路径调整。
- 单文件小改动。
- 原因明确的小 Bug。
- 简单格式化。

---

## 7.2 medium

适合大多数常规开发任务：

- React / Next.js 页面。
- 表单。
- API Route。
- CRUD。
- 单模块功能。
- 普通数据库读写。
- 常规 Bug。
- 单元测试。
- TypeScript 修改。
- 普通服务层逻辑。
- UI 行为调整。
- 普通业务逻辑。

---

## 7.3 high

适合复杂、多模块、高风险或高不确定性任务：

- 多文件联动。
- 多模块联动。
- 架构局部调整。
- 数据模型设计。
- 状态机。
- API 契约。
- 权限控制。
- 身份认证。
- OAuth / JWT。
- Launch Token。
- 多服务集成。
- 并发问题。
- 异步任务。
- 队列逻辑。
- 难复现 Bug。
- 性能问题。
- 安全实现。
- Simulation Schema。
- Renderer。
- postMessage 协议。
- 版本系统。
- 数据迁移。
- 复杂测试失败。
- AI Structured Output。
- AI 自动修复。
- 多阶段校验。

---

## 7.4 xhigh

`xhigh` 是 Worker 可正常使用的最高推理强度。

可用于任何 Supervisor 认为需要更强推理投入的任务，包括但不限于：

- 核心系统架构。
- 大规模重构。
- 高风险安全设计。
- AST 白名单。
- 数学表达式安全执行。
- 核心跨服务安全。
- Schema 版本迁移体系。
- 高复杂度一致性问题。
- 复杂跨模块设计。
- 重大系统性 Bug。
- 上线前关键技术审查。
- 需要深入分析和大量上下文整合的普通开发任务。
- 失败成本高的任务。
- Supervisor 认为使用 `xhigh` 能减少返工或提升可靠性的任务。

规则：

- 可以直接分配 `xhigh`。
- 不要求先使用 `high`。
- 不要求 `high` 失败。
- 不限制使用次数。
- 不因为 Token 成本阻止使用。
- `max` 仅在 `xhigh` 仍无法可靠解决问题时作为最终升级等级使用。

---

# 8. 推理强度选择原则

Supervisor 为 Worker 选择等级时，可考虑：

- 任务复杂度。
- 修改范围。
- 文件数量。
- 模块数量。
- 风险。
- 不确定性。
- 跨模块程度。
- 算法难度。
- 安全影响。
- 数据影响。
- 架构影响。
- 失败成本。
- 验证难度。
- 是否已有明确方案。

参考：

| 任务特征 | Worker MODEL_LEVEL |
|---|---|
| 单文件、低风险、步骤明确 | `low` |
| 普通开发任务 | `medium` |
| 多模块、复杂逻辑、高风险 | `high` |
| 需要最高推理投入或 Supervisor 判断更适合 | `xhigh` |

该表仅为参考，不构成限制。

Supervisor 可以直接将任何 Worker Task 分配为 `xhigh`。

---

# 9. 动态升级

Worker 执行时如发现任务实际复杂度高于预估，不得盲目扩大 Scope。

可请求升级：

- 出现未预期跨模块修改。
- 发现安全问题。
- 发现数据迁移风险。
- 发现架构变化。
- 发现核心算法或数学问题。
- 当前方案存在重大不确定性。
- 连续修复仍失败。
- 测试失败原因无法确定。
- 当前推理强度不足。
- 必须扩大 Scope 才能继续。

报告中写：

```text
ESCALATION_REQUIRED

Current Level:
medium

Recommended Level:
high | xhigh | max

Reason:
具体原因
```

推理强度不要求逐级升级。

以下路径都允许：

```text
low → high
low → xhigh
medium → high
medium → xhigh
high → xhigh
xhigh → max
```

也可以在 Task 开始时直接选择 `xhigh`。


`max` 的使用规则：

- 默认不使用 `max`。
- 只有在 `xhigh` 已实际尝试但仍无法可靠解决时才考虑 `max`。
- 典型触发条件：
  - `xhigh` Worker 多次修复仍失败。
  - `xhigh` 无法定位复杂系统性 Bug。
  - `xhigh` 无法完成关键架构、安全、数据一致性或算法问题。
  - Worker Report 明确说明当前等级不足。
  - Supervisor 判断继续使用 `xhigh` 只会重复失败或产生高返工风险。
- 升级到 `max` 时必须记录原因和已有失败证据。
- `max` 任务完成后，下一 Task 重新回到正常等级判断，不继承 `max`。

---

# 10. Task 拆分原则

Supervisor 不应把过大的目标直接交给一个 Worker。

每个 Task 应：

- 有明确边界。
- 有明确 Scope。
- 有明确 Out of Scope。
- 有明确依赖。
- 有明确验收标准。
- 有明确测试要求。
- 可以独立审核。

大型目标应按依赖关系拆分成多个 Task。

---

# 11. Scope 控制

Worker 必须遵守：

```text
SCOPE
OUT OF SCOPE
```

如果发现必须修改 Scope 外内容才能完成任务：

1. 停止扩大修改。
2. 在报告中说明原因。
3. 标记：

```text
ESCALATION_REQUIRED
```

4. 建议新的 Scope 或新 Task。

涉及以下内容时尤其不得擅自扩大：

- 数据库 Schema。
- 公共 API。
- 认证。
- 权限。
- 核心算法。
- 核心数学逻辑。
- 安全策略。
- 跨服务协议。
- 大规模重构。

明显的机械性关联修改除外，例如重命名后同步 import。

---

# 12. 并行 Worker

只有在以下条件满足时才并行：

- Task 彼此独立。
- 无强依赖。
- 不修改相同文件。
- 不修改相同数据库迁移。
- 不产生 API / Schema 冲突。
- 不共享容易冲突的可变状态。

如果可能冲突，则串行执行。

如果当前 Codex 环境没有 subagent / multi-agent 能力：

```text
MULTI_AGENT_UNAVAILABLE
```

不得伪造 Worker 或 Worker Report。

---

# 13. Worker 修改前要求

Worker 开始任务后，应先：

1. 阅读 Task 和 Scope。
2. 阅读相关项目文件。
3. 确认当前实现。
4. 检查现有设计是否冲突。
5. 制定最小修改方案。
6. 再开始修改。

原则：

> **优先最小、清晰、可验证的修改。**

不得为了“顺便优化”进行无关大规模重构。

---

# 14. 测试原则

Worker 应根据任务类型选择合理测试。

## 14.1 文档任务

优先验证：

- 文件存在。
- Markdown 格式。
- 内容结构。
- 链接。

不要求无意义运行完整测试套件。

## 14.2 UI 任务

优先验证：

- TypeScript 编译。
- Build。
- 组件测试。
- 浏览器行为。
- 响应式。
- 关键交互。

## 14.3 API 任务

优先验证：

- Unit Test。
- API 请求。
- 输入校验。
- 错误路径。
- 权限路径。
- Idempotency（如适用）。

## 14.4 数据库任务

优先验证：

- Migration。
- Schema。
- CRUD。
- Constraint。
- RLS / 权限。
- Rollback（如设计要求）。

## 14.5 安全任务

必须考虑：

- 正向测试。
- 负向测试。
- 恶意输入。
- 越权测试。
- 注入测试。
- 失败行为验证。

安全任务可直接使用 `high` 或 `xhigh`。

---

# 15. 测试失败处理

如果存在失败，Worker 不得直接写：

```text
COMPLETED
```

除非失败项：

- 明确与本任务无关。
- 已在任务开始前存在。
- 有可靠证据证明不是当前修改引起。
- 已在 `ISSUES` / `RISKS` 中明确记录。

否则结论应为：

```text
PARTIALLY COMPLETED
```

或：

```text
BLOCKED
```

不得隐藏失败。

---

# 16. 禁止伪造验证

Worker 严禁：

- 编造测试结果。
- 声称运行了未运行的命令。
- 编造 Exit Code。
- 编造浏览器验证。
- 编造文件。
- 编造数据库结果。
- 隐藏失败。
- 将推测写成验证结果。

无法执行时：

```text
NOT VALIDATED
```

并说明原因。

---

# 17. Worker Report 标准格式

Worker 每次完成任务后必须提交：

```text
## TASK

TASK ID:
TASK-XXX

TITLE:
任务名称

MODEL_LEVEL:
low | medium | high | xhigh | max

ACTUAL_MODEL_LEVEL:
实际执行等级

OBJECTIVE:
任务目标

SCOPE:
实际处理范围

---

## CHANGES

- 做了什么
- 为什么这样做
- 逻辑变化
- 配置变化
- 依赖变化

---

## FILES

path/to/file
- 具体变化

---

## VALIDATION

- 实际执行的验证

---

## TEST RESULTS

Command:
pnpm test

Result:
42 passed
0 failed
Exit code: 0

如果未执行：

NOT RUN:
测试名称

Reason:
原因

---

## ISSUES

None

或列出未解决问题 / 阻塞项。

---

## RISKS

No known risks based on current validation.

或列出：
- 未覆盖场景
- 数据风险
- 性能风险
- 安全风险
- 兼容性风险

---

## EVIDENCE

1. 测试命令与结果
2. Build 结果
3. API / Browser / Schema / 数据验证
4. 其他直接证据

---

## ESCALATION

None

或：

ESCALATION_REQUIRED

Current Level:
medium

Recommended Level:
high | xhigh | max

Reason:
具体原因

---

## CONCLUSION

COMPLETED
```

允许的最终结论只有：

```text
COMPLETED
PARTIALLY COMPLETED
BLOCKED
```

禁止模糊结论：

```text
基本完成
应该没问题
看起来可以
大概完成
```

---

# 18. Supervisor 审核标准

Supervisor 收到 Worker Report 后，只依据报告检查：

1. Worker 是否真正回答 Task。
2. MODEL_LEVEL 是否合理。
3. ACTUAL_MODEL_LEVEL 是否与任务匹配。
4. CHANGES 是否对应 Task。
5. FILES 是否明确。
6. VALIDATION 是否合理。
7. TEST RESULTS 是否存在。
8. 是否有失败测试。
9. 失败是否解释。
10. ISSUES 是否清楚。
11. RISKS 是否清楚。
12. EVIDENCE 是否支持 CONCLUSION。
13. 报告是否存在逻辑矛盾。
14. 是否存在“声称完成但没有证据”。
15. 是否遗漏关键验证。
16. 是否存在未验证却声称完成。
17. 是否需要提高 Worker MODEL_LEVEL。
18. 是否需要重新拆分 Task。

---

# 19. Supervisor 审核结果

Supervisor 只能使用：

```text
PASS
REVISE
UNDETERMINED
```

## 19.1 PASS

含义：

> Worker Report 中提供的证据足以支持任务完成。

PASS 不代表 Supervisor 独立验证了项目。

## 19.2 REVISE

表示：

> 实现、测试、验证或报告存在不足，需要继续工作。

Supervisor 必须指出：

- 哪部分不足。
- 缺什么。
- 为什么不能通过。
- Worker 下一步需要做什么。
- 必须补充什么证据。
- 是否需要提高 MODEL_LEVEL。

## 19.3 UNDETERMINED

表示：

> 当前报告证据不足，无法判断任务是否完成。

常见原因：

- 关键测试缺失。
- 输出缺失。
- 报告自相矛盾。
- 风险说明不足。
- 只有结论，没有直接证据。

Supervisor 必须退回 Worker 补证据。

---

# 20. Supervisor 审核模板

```text
REVIEW RESULT:
PASS | REVISE | UNDETERMINED

TASK:
TASK-XXX

SUPERVISOR_MODEL_LEVEL:
xhigh

WORKER_MODEL_LEVEL:
low | medium | high | xhigh | max

MODEL LEVEL REVIEW:
Appropriate | Too Low | Too High

REPORT EVIDENCE:
- ...

MISSING EVIDENCE:
- ...

ISSUES:
- ...

REQUIRED NEXT ACTION:
- ...

RATIONALE:
仅依据 Worker Report 中的信息与证据判断，
未进行独立项目验证。
```

---

# 21. Supervisor 给 Worker 的标准任务模板

```text
TASK ID:
TASK-XXX

TITLE:
任务名称

OBJECTIVE:
本任务目标。

MODEL_LEVEL:
low | medium | high | xhigh | max

MODEL_REASON:
为什么选择该等级。

SCOPE:
允许处理的范围。

OUT OF SCOPE:
明确不处理的内容。

DEPENDENCIES:
依赖项。

REQUIREMENTS:
1.
2.
3.

ACCEPTANCE CRITERIA:
1.
2.
3.

VALIDATION REQUIRED:
1.
2.
3.

TESTS REQUIRED:
1.
2.
3.

RISK FOCUS:
重点风险。

ESCALATION RULE:
如果实际复杂度超过当前等级，
或必须扩大 Scope 才能继续，
停止扩大修改，
并提交 ESCALATION_REQUIRED。

REPORT REQUIRED:
按本 AGENTS.md 的 Worker Report 格式提交完整报告。
```

---

# 22. 标准工作流

```text
USER
  ↓
CODEX SUPERVISOR
MODEL_LEVEL = xhigh
  ↓
理解目标
  ↓
拆分 Task
  ↓
分析依赖 / 风险 / Scope
  ↓
选择 Worker MODEL_LEVEL
  ↓
WORKER
low / medium / high / xhigh
  ↓
开发 / 修改 / 测试 / 验证
  ↓
WORKER REPORT
  ↓
SUPERVISOR
xhigh
  ↓
PASS / REVISE / UNDETERMINED
```

结果处理：

- `PASS` → 下一 Task。
- `REVISE` → Worker 返工。
- `UNDETERMINED` → Worker 补证据。
- `ESCALATION_REQUIRED` → 重新判断 Scope / Worker MODEL_LEVEL。

---

# 23. PASS / REVISE / UNDETERMINED 后续行为

## PASS

1. 记录任务完成。
2. 不重复验证该任务。
3. 检查后续依赖。
4. 重新判断下一 Worker Task 的等级。
5. 分配下一 Task。

## REVISE

必须明确：

- 需要修改什么。
- 需要重新验证什么。
- 哪些测试必须重跑。
- 哪些证据缺失。
- 是否提高 Worker MODEL_LEVEL。

可保持原 TASK ID，并加入：

```text
REVISION:
R1
```

## UNDETERMINED

优先要求 Worker：

- 补测试结果。
- 补实际输出。
- 补关键日志摘要。
- 补验证步骤。
- 补失败原因。
- 补风险说明。

如果无需改代码，只需补证据，则不要重新实现任务。

---

# 24. 项目质量优先级

优先级：

1. 正确性。
2. 安全性。
3. 数据一致性。
4. 可验证性。
5. 稳定性。
6. 可维护性。
7. 性能。
8. UI 体验。
9. 开发速度。

如果速度与正确性 / 安全性冲突：

> **选择正确性和安全性。**

---

# 25. AI / 数学 / 安全类项目特殊规则

如果项目包含 AI 生成、数学引擎、仿真、Renderer 或安全执行环境，则额外遵守：

## 25.1 LLM 不作为可信数学结果来源

LLM 可以：

- 选模板。
- 填参数。
- 推荐范围。
- 写教学文字。
- 生成受控 Schema。

核心数学 / 数值结果应由可信数学引擎计算。

## 25.2 不直接执行 AI 生成代码

不要把 AI 生成的：

```text
JavaScript
HTML
Python
```

直接作为用户侧受信任运行代码。

优先：

```text
Structured Schema
```

再由可信 Renderer / Runtime 执行。

## 25.3 安全类任务

以下任务可直接使用 `high` 或 `xhigh`：

- Sandbox iframe。
- CSP。
- Launch Token。
- OAuth。
- JWT。
- postMessage origin 校验。
- 多租户隔离。
- 表达式安全处理。
- 核心跨服务安全。

---

# 26. 最终原则

> **Supervisor 默认使用 `xhigh`。**

> **Worker 常规使用 `low / medium / high / xhigh`。**

> **Worker 的 `xhigh` 不设额外限制。**

> **当 `xhigh` 仍无法可靠解决问题时，Supervisor 或 Worker 可以升级到 `max`。**

> **`max` 只作为最终升级手段，不作为默认或常规等级。**

> **Supervisor 分配工作，不代替 Worker 工作。**

> **Supervisor 审核报告，不独立验证项目。**

> **Worker 必须验证自己的工作。**

> **Worker 必须提供证据。**

> **证据不足就退回 Worker。**

> **任何完成结论都必须可追溯到 Worker Report 中的直接证据。**
