# Hangul Introduction — Production Content Owner Checklist

状态：**READY FOR CONTENT OWNER（工程工作流与交接准备就绪）**。Stage 1F-R3D 已完成从零正式 authoring → publication → server Pins → Hangul Explain 的 disposable Full Supabase 验证。**生产尚未部署本轮代码或应用007迁移，真实Candidate仍0。本文不是生产执行、部署、迁移或Agent enable授权。**

验证报告：[Stage 1F-R3D](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r3d-authoring-workflow-closure.md)。R3B/R3C历史报告保留原结论。

## 正式 from-zero 路径

合法完整发布者沿用 **Platform Owner**。教学内容负责人是业务审核责任人，需与具备该权限的发布者配合；机构manageContent/普通Teacher不自动获得Script Studio权限。不得借service role直接插行或更新发布状态。

| 步骤 | 正式产品操作 | 结果/检查 |
|---|---|---|
| 环境前置 | 后续获准发布流程安装本轮代码及所需增量迁移 | 本轮未在生产执行；不可把下列按钮视为已经部署 |
| 选择课时 | 平台管理 → 应用中心 → 韩语课程 → 教材制作；章节选择“全部章节” | `/platform/dashboard/admin/apps/korean/textbooks` |
| 创建骨架 | “创建教学内容”中选已有lesson；填写预备章节名称、审核后的学习目标（可选，每行一条）；明确点击“创建教学内容草稿” | 原子创建textbook、version1、预备chapter0、orientation模块、teaching lesson；全部相关状态draft，无脚本或自动发布 |
| Profile核对 | 系统从Korean app解析published `uply-korean-teacher` | 与Agent Core `student-ai-teacher@1.0.0` definition不同；不能传入任意profile UUID |
| 进入编辑器 | 成功后点击“进入教学脚本” | 定位实际新建chapter；使用原Script Studio |
| 编写草稿 | “新建教学脚本” → 工具栏“新增小节” | 不需要先存在第一条node；复用原Actions |
| 审核正文 | 逐条填写老师台词；同时审核“韩语版台词（选填）”，清除/替换占位句；保存 | 不把合成测试句导入生产；两种locale均需审核 |
| 内容/媒体/路径 | 使用已有界面选择呈现方式、真实素材与教学流程；只有最后一节设结束 | 不伪造音视频资产；遵循实际发布校验 |
| 教材与脚本复核 | 展开“复核与发布检查” → “读取复核内容”，核对后勾选并“确认复核” | 修改后必须重新复核，不能跳过 |
| 发布脚本 | “发布学习步骤” → “校验并发布” | 原snapshot/checked publisher，记录实际actor |
| 发布教材 | 回“教材制作”，定位该chapter → “发布章节” → “确认发布” | 原RPC同时发布root/version/chapter；与script发布分开 |
| 学生验收 | 在获准实际Pilot身份下验证server Pins与正式Hangul Explain | 生产尚未执行；须通过真实Policy/授权与最终scope检查 |

创建入口面向当前Hangul预备课：首章是第0章，不假装已实现一般章节CMS。其他章节保留已有章节测试要求。Module/node按父章节/发布脚本可见性处理，无独立status。完整视频流程预览仍仅支持第1章，不能把本次第0章Agent验收说成视频预览已扩展。

重复或并发创建返回安全冲突；已有/partial教材不会被覆盖或自动修复。遇到残缺旧骨架应交工程核查，不能重新点创建强行覆盖。学习目标在本次创建表单中由作者填写；不声称新增了通用目标编辑器。

## 待内容负责人填写的生产清单

目标 course `korean-beginner` / lesson `hangul-introduction`。Production course ID `2f79a679-6e25-4cf9-9f71-455905584787`，lesson ID `6ad20a2b-2306-4173-9d3f-73eb9691ff58`。保持现有 published/immediate/解锁规则；不为Agent修改课程范围。

- [x] 工程已验证正式from-zero入口、原子性、并发/重复保护、Script Studio、review/publish及实际Agent消费链，仅限disposable synthetic环境。
- [ ] 后续独立授权的代码发布/迁移已完成，并核对版本及回滚安排。
- [ ] Authoring Owner、工程协作人、实际平台发布者、审核日期、内容权利记录：待填写。
- [ ] 选择正确lesson，作者填写章节名与学习目标；核对真实course/app/content scope/Profile。
- [ ] 逐节点填写并审核两种语言台词、segments、教材一致性、媒体与教学流程。不得保留占位正文或直接复制测试fixture。
- [ ] 完成正式source review与脚本校验发布；完成教材root/version/chapter发布并核对全部状态。
- [ ] 实际授权Pilot身份通过tenant/app/feature/enrollment/资源权限检查；本轮没有读取真实学生数据。
- [ ] 验证server `expectedRevision`、`segmentRef`及重发布后的刷新；displayText不是authority。
- [ ] 正式 `/<space>/apps/korean/courses/korean/korean-basic/korean-beginner/hangul-introduction` 显示“解释这句话”，金老师Panel、Tool/Evidence/Output/来源验收通过。
- [ ] 内容匹配本课教学目标；入口解释本课数据库已发布片段，不声称知道静态Hangul教材的视觉当前页。
- [ ] 复查所有子lesson的真实Policy与已发布内容；只有实际恰好1 eligible lesson时签署单lesson范围证明，冻结后再评估。
- [ ] Tailscale实际验证、Provider Policy批准、operator/备班、窗口与最终production scope均就绪后，再独立评估Stage1G。

## 外部签署状态

| 项目 | 状态 | 责任方 |
|---|---|---|
| 正式从零工程工作流 | READY FOR CONTENT OWNER；production未安装 | Engineering + Teaching Content Owner |
| Production内容/Pins | 未创建/未验证；Candidate0 | 内容负责人 + 获批Pilot身份 |
| Production代码/迁移 | 未部署/未应用，待独立授权 | Release Operator |
| Tailscale | APPROVAL REQUIRED；未修改 | 基础设施批准人 |
| Provider Policy | APPROVAL REQUIRED | Data/Policy Approver |
| Operator Personnel | NOT ASSIGNED | Release/Pilot/Incident Operators与备班 |
| Stage1G | NOT READY | 最终放行责任方 |

[现有Tailscale批准包](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-tailscale-verification-request.md)、[Provider政策批准包](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-provider-policy-approval.md)、[人员模板](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-pilot-operations-roles.md) 均保留未批准/未指派状态。没有代签、发送消息、生产内容写入或live Provider请求。
