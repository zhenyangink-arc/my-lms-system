# UPLY Teaching Agent — Provider Policy Approval Package

Provider Policy Status：**BLOCKED / APPROVAL REQUIRED**。Technical / Project Owner 与 Teaching Content Owner 已由用户确认为杨震；Data / Policy Approver 仍为 **TBD**，未取得合同/政策批准。本次仅整理政策文档事实，不构成政策批准。

| 已确认角色 / 状态 | 当前值 |
|---|---|
| Technical / Project Owner | 杨震 |
| Teaching Content Owner | 杨震 |
| Data / Policy Approver | TBD — APPROVAL REQUIRED |
| Provider Technical Scope | READY FOR REVIEW |
| Provider Policy | APPROVAL REQUIRED |
| Live Provider Requests | 0（用户确认；本次未调用 Provider） |

**Technical Owner 不等于 Data / Policy Approver。** READY FOR REVIEW 仅表示源码技术范围已整理，可供审查，不表示获准发送数据或开放 Pilot。本文描述当前源码的数据流，不声称生产部署配置已核验，也不声称 Provider retention/training/region/DPA 已符合要求，不以代码测试代替政策批准。

### 首轮 proposed scope（待政策审查）

- 仅限一个明确批准的 internal/test user、一个 tenant、一个 course、一个 verified lesson；具体名单、资源及 revision 仍待确认和批准。**不批准普通学生开放。**
- single-turn，不注入历史聊天；同一 Run 内的 Tool 调用及后续模型推理不属于历史聊天注入。
- 只发送当前代码已定义的最小 Prompt / Tool safe projection，具体字段见第 1 节；Optional State 是否纳入首轮仍待逐项批准，不因源码可用而自动获准。
- 不发送其他学生数据、姓名、email、raw tenant ID、raw student UUID。
- 不发送成绩、完整 progress、raw node configuration、answer key、JWT、Cookie、DB credential。

以上是提案边界，不是已批准名单或运行时新增限制。结构化字段排除已有源码依据；自由文本可能携带个人信息的限制见第 2 节，不能将 safe projection 解释为自动脱敏保证。Retention、training usage、DPA、cross-border、用户告知/同意均继续 UNKNOWN / PENDING / APPROVAL REQUIRED。

## 1. 实际数据流

Browser 选句 → 服务端身份/tenant/资源/Selection 校验 → Prompt assembler → DeepSeek planning → 模型选择只读 Tool → 授权 Domain safe projection → ToolResult → 后续 DeepSeek 推理 → 验证后输出。single-turn，没有历史聊天注入。

Provider **DeepSeek**；endpoint `https://api.deepseek.com/chat/completions`；model **deepseek-v4-flash**；configVersion `deepseek-tools-disabled-v1`，`thinking.type=disabled`。该配置名称不表示 function tools 被关闭；实际 adapter 发送当前允许的 tool schemas。源码核实链为 [student-ai-teacher.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/profiles/student-ai-teacher.ts) 引用 [capabilities.ts](/home/yangzhen/projects/my-lms-system/src/features/agent-core/providers/deepseek/capabilities.ts:3) 的 `DEEPSEEK_BASELINE`，由 [adapter.ts](/home/yangzhen/projects/my-lms-system/src/features/agent-core/providers/deepseek/adapter.ts:28) 构造请求；本次未执行请求。

| 阶段 | 可能进入 Provider 的字段/内容 | 限制/证据 |
|---|---|---|
| 请求配置 | model、thinking、max_tokens、stream、stream_options.include_usage、tools 的 function name/description/input JSON schema、tool_choice | adapter 显式白名单，未追加用户 metadata |
| System | base evidence/safety instructions、Student role、Kim displayName/style、Explain Skill procedure、Runtime constraints、Empty single-turn history 声明 | [student-prompt-assembler.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/runtime/student-prompt-assembler.ts:23) |
| Verified context DATA | binding=verified_selection、lessonRef、segmentRef、revision、locale、sourceLocale | opaque refs；首次 planning 不含 originalSentence/完整 profile/state |
| User question | request.message | 当前 UI 固定“请解释这句话”；API 支持有界自由问题，因此审批不能只看固定 UI |
| Lesson Tool Data | lessonTitle、moduleTitle、originalSentence、objectives、contentVersion、segmentRef、locale、sourceLocale | 原文只在授权 Tool 结果出现；非全教材 |
| Lesson evidence metadata | evidenceRefs（kind/sourceRef/revision）、revision、asOf、completeness、truncated、omittedFields、truncatedFields | sourceRefs 与 status/data 包装同样会进入 Tool message |
| Optional State Data | semantic=last_saved_teaching_position、teachingSessionRef、scriptVersionRef、lastSavedNodeRef、lastSavedSegmentRef、lastSavedSegmentIndex、phase、stateRevision、status、omissions，以及 evidence metadata | 仅绑定授权 teaching session 且工具可执行时；不是视觉 current、不是完整 progress。当前正式 UI 未绑定 session，不保证会发送 |
| 后续回合 | 模型先前 assistant text、tool call ID/name/arguments、序列化 Tool result、Runtime corrective/final constraints | 最多当前 Run 的模型回合；不是历史 memory，无 Provider reasoning 回传到上下文 |

字段来源 [contracts.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/tools/contracts.ts)、[current-lesson-read-port.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/domain-ports/current-lesson-read-port.ts)。Domain port 以 Unicode code points 截断：title/moduleTitle 各 200、sentence 4000、objectives 最多 6×400；schema 的 UTF-16 上限分别 400/8000/6×800。实际页面 Pin 入口还要求句段长度 ≤2000 UTF-16 units，通常更严格。这些是技术上限，不是获准发送的额度。

## 2. 明确排除的结构化数据

当前 Prompt/Tool 白名单不注入：student name、email、raw tenant ID、raw student UUID、其他学生、完整 progress、成绩、raw node configuration、answer key、全教材、JWT、Cookie、DB credentials。internal auth authority / tenant / resource IDs 用于服务端授权，不作为模型身份字段。完整 Profile/教学状态不传；State 仅为表中最小位置投影。

**Provider secrets 不进入 Prompt、Tool、业务日志或审批文件。** 但 `DEEPSEEK_API_KEY` 必须用于 HTTPS API 的服务认证，Provider 接口必然接收该认证凭证；因此“Provider 完全收不到任何 secret”并不符合源码。本文不显示其值或完整认证头。Provider key 认证用途与发送给模型的教学数据需要分开审批/管理。

以上是显式字段排除，不是自由文本内容绝对不含姓名的保证：用户问题可能包含个人信息；教材例子可能含人物姓名；opaque refs 可关联请求，不能声称法律意义匿名。Provider 还可观察连接来源、时间等服务端网络元数据。未评估合同层保留、训练用途、子处理者和跨境条件。

## 3. 责任方必须回答的问题

| # | 审批问题 | 当前答案 |
|---|---|---|
| 1 | 是否批准 DeepSeek API 处理此 Pilot 教学数据？ | 待批准 |
| 2 | 允许哪些字段、文本长度、Tool 投影？optional state 是否排除？ | 待填写 |
| 3 | 允许哪些内部用户？是否有未成年人/特殊数据要求？ | 提案仅一个明确批准的 internal/test user；具体人选及特殊要求 PENDING，不读取真实名单，不批准普通学生开放 |
| 4 | 允许哪个 tenant/course/lesson 与教材版本？ | 提案仅一个 tenant、一个 course、一个 verified lesson；具体范围 PENDING / APPROVAL REQUIRED |
| 5 | 数据跨境处理是否批准、适用区域要求是什么？ | UNKNOWN / APPROVAL REQUIRED |
| 6 | Provider retention 与删除/日志条件是什么，有何可核验证据？ | UNKNOWN / APPROVAL REQUIRED |
| 7 | 是否用于训练，如何确认/约束？ | UNKNOWN / APPROVAL REQUIRED |
| 8 | 合同/DPA/子处理者安排处于什么状态？ | UNKNOWN / PENDING；未确认签署 |
| 9 | 用户告知/同意需要什么，谁记录执行？ | UNKNOWN / PENDING / APPROVAL REQUIRED；未确认完成 |
| 10 | 哪些变化/事件触发撤回、停用和重新审查？ | 待填写 |

未引用或猜测网上通用政策来代替此组织/账号的合同。技术数据最小化 PASS 不等于 Policy APPROVED。

## 4. Approval Record Template（未签署）

| 字段 | 值 |
|---|---|
| Provider | DeepSeek |
| Endpoint | https://api.deepseek.com/chat/completions |
| Model / config | deepseek-v4-flash / deepseek-tools-disabled-v1 |
| Technical / Project Owner | 杨震 |
| Teaching Content Owner | 杨震 |
| Data / Policy Approver | TBD — APPROVAL REQUIRED |
| Approval date / reference | 待填写 |
| Effective scope | 提案仅 internal/test pilot：一个明确批准的 internal/test user、一个 tenant、一个 course、一个 verified lesson；single-turn，无历史聊天；不批准普通学生开放 |
| Allowed tenant/course/users | PENDING / APPROVAL REQUIRED；具体名单未在本次确认，人员名单存受限系统；本文无真实学生信息 |
| Allowed lesson/content revisions | PENDING / APPROVAL REQUIRED；具体 verified lesson 与 revision 待填写，本次不核验生产内容发布链 |
| Allowed fields / excluded optional state | 待逐项确认第1节 |
| Retention restrictions | UNKNOWN / APPROVAL REQUIRED |
| Training restrictions | UNKNOWN / APPROVAL REQUIRED |
| Region / cross-border decision | UNKNOWN / APPROVAL REQUIRED |
| Contract / DPA reference | UNKNOWN / PENDING；未确认签署 |
| User notice / consent | UNKNOWN / PENDING / APPROVAL REQUIRED；未确认完成 |
| Expiry / review date | 待填写 |
| Revocation process | 待批准：通知 Incident + Release Operator 停新 admission，按 R3A drain 收敛已有 Run，停止后续 Provider 请求；已发送数据由合同下的删除/撤回流程处理，不能保证技术“收回” |
| Provider Technical Scope | READY FOR REVIEW |
| Provider Policy Status / signature | BLOCKED / APPROVAL REQUIRED，未签署 |
| Live Provider Requests | 0（用户确认；本次未调用 Provider） |

任何 model/endpoint/字段/教材范围/用户范围变化均需要责任方判断是否重新批准。R3B 没有发送审批消息、代签或用代码绕过审批。
