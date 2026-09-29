# Stage 1F-R6D — Teaching Script Review & Validation

## 1 Executive Summary

**Overall: GO；Review: COMPLETE；Teaching Nodes Reviewed: 8/8。**

当前内容需修订：**MUST_FIX 3、SHOULD_FIX 4、OPTIONAL 2；Revision Required YES；READY FOR REVISION**。四目标均有涉及，但FULL仅1项、PARTIAL3项；不报告为4/4完整覆盖。两道练习答案均正确。所有节点/版本写入0，Stage1G仍NOT READY，未进入R6E。

GO表示审稿及证据闭环完成，不表示内容已经修订、发布或通过学生运行验收。

## 2 Scope

本阶段始终为READ-ONLY PEDAGOGICAL REVIEW。目标仅“韩文字母入门 / 第0章 / 课前导航”，唯一version1 Draft、8个既有节点。只更新当前R6D报告/evidence；不修改R6A/B/C文档或生产内容。不因发现MUST_FIX直接修复。

## 3 Review Method

完整读取R6C报告、node-plan与8份节点receipt；通过独立READ ONLY连接读取当前真实teacher_script、标题、类型、order、updated_at、全行hash及四条objectives；用既有Chrome读取每个目标节点的表单值和导航标题，完成INTENDED↔PERSISTED↔RENDERED。只将CRLF标准化为LF，不改措辞、不做Unicode兼容折叠。

**Context Recovery（历史保留）：**第一次R6D尝试为 **BLOCKED — TARGET_UI_CONTEXT_MISMATCH**。当时Chrome停在“韩国语1级 / 第1章 / version24 draft”，数据库目标正确；没有任何输入、节点点击、保存或生产写入。用户随后明确授权同阶段只读上下文恢复。通过错误tab中现有正式“定位章节”GET表单，按既有chapter安全hash精确筛选选项，在同一Chrome context打开新tab；未猜UUID或操作version24内容。目标chapter/version hash与R6B/C一致，Teaching Lesson通过DB version.lesson_id与canonical关系再次核对。状态 **RESOLVED**，然后继续原R6D。

目标tab验证为本人正常登录Platform Owner，未读Cookie/JWT/密码/认证头。仅点击已审计的节点导航及显示编排轴按钮，不使用类型控件、selectOption、输入事件、Save或Preview。监测到非GET/HEAD/OPTIONS请求0。Chrome及错误tab保持打开。首次记录保存在first-attempt-blocked-report.md、first-attempt-ui-context.json和first-attempt-gates.json。

## 4 Production Preflight

初次与恢复后独立复核均PASS：PG17.6、ledger457/latest202609140007、Build `6IhDHN8Dm1nCewiCEZnV5`、PM2 online；canonical链1、Teaching Lesson1、唯一version1/draft、node8/order1–8、active inconsistent fences0。Feature OFF、三项allowlists EMPTY、Agent五表0。恢复后的重复只读观测与初次目标行hash一致；浏览器问题不是数据库漂移。

## 5 Current Script Snapshot

| Node | Title | Formal Type | Review |
| --- | --- | --- | --- |
| 1 | 今天认识韩文字母 | `opening` | NEEDS_REVISION |
| 2 | 韩文字母怎么组成？ | `explanation` | NEEDS_REVISION |
| 3 | 先认识基础元音 | `explanation` | PASS |
| 4 | 再认识基础辅音 | `explanation` | NEEDS_REVISION |
| 5 | 把辅音和元音放在一起 | `example` | NEEDS_REVISION |
| 6 | 一个音节里面有什么？ | `explanation` | NEEDS_REVISION |
| 7 | 一起试一试 | `instruction` | PASS |
| 8 | 今天学了什么？ | `summary` | NEEDS_REVISION |

版本仍1 Draft；8个正式类型未改变。系统生成node_key不改变，logical alias仍为报告映射。主字段和韩语字段是当前真实持久内容；Node7主字段含完整两题，韩语字段仅含两组反馈，此既有设计不作为数据丢失。

## 6 Learning Objective Alignment

| Objective | 原目标 | 覆盖Node | Status | 实际证据与限制 |
| --- | --- | --- | --- | --- |
| 1 | 认识韩文字母由辅音、元音和音节块组成的基本结构。 | 1, 2, 5, 6, 8 | PARTIAL | 自音/母音及合体字形已有；视觉块内布局只隐含在가/한等例字，未明确讲解且无保存的黑板slides。 |
| 2 | 能辨认并朗读基础元音和常用基础辅音。 | 3, 4, 5, 7 | PARTIAL | 6元音有跟读；8辅音主要辨形，4组合示例未明确带读；两题不考朗读。文本无法证明实际发音示范或学习者掌握。 |
| 3 | 理解初声、中声、终声组成韩语音节的基本方式。 | 6, 8 | PARTIAL | 초성/중성/종성及한拆分都有且拆分正确；中声视觉歧义、终声可选表述影响可靠理解。 |
| 4 | 能将基础辅音与元音组合成简单韩语音节。 | 2, 5, 7 | FULL | 4个正确C+V组合和题2对가的辨认构成入门讲解与练习覆盖；FULL指内容覆盖，不是学生已能独立掌握所有组合。 |

**4/4有涉及；FULL1、PARTIAL3、NONE0。** FULL仅表示预备课讲解/示例/练习的内容覆盖，不等于学习者已掌握；两道选择题不验证发音或全部目标。

## 7 Node 1 Review

| Field | Review |
| --- | --- |
| Node Number | 1 |
| Title | 今天认识韩文字母 |
| Formal Type | opening |
| Purpose | 温和导入辅音、元音及组合预期。 |
| Korean Grammar | PASS |
| Korean Naturalness | NEEDS_REVISION |
| Beginner Difficulty | PASS |
| Pedagogical Accuracy | PASS |
| Terminology | PASS |
| Length | PASS |
| Objective Alignment | PARTIAL |
| Classification | SHOULD_FIX |

**Issue:** 没有明显语法错误；한글은…만들어요可理解为话题前置和主语省略，但构成介绍不如있어요自然。이루어져 있어요准确却更书面/复杂，不优先采用。其余问候、같이 배워요和볼까요自然，篇幅合适。

**Length:** 按一次一个概念评估；无朗读时长测试。Node4总篇幅不长，但末句过长。Node6需分段停顿，非要求扩展术语。

**Recommended Revision（仅提案）：**

S1 — SHOULD_FIX

```text
한글에는 자음과 모음이 있어요.
```

证据：persisted-nodes.json、ui-render-validation.json中的order=1；node-review-01.json。

## 8 Node 2 Review

| Field | Review |
| --- | --- |
| Node Number | 2 |
| Title | 韩文字母怎么组成？ |
| Formal Type | explanation |
| Purpose | 解释两类字母如何组成一个可见的音节块。 |
| Korean Grammar | PASS |
| Korean Naturalness | PASS |
| Beginner Difficulty | PASS |
| Pedagogical Accuracy | NEEDS_REVISION |
| Terminology | PASS |
| Length | PASS |
| Objective Alignment | PARTIAL |
| Classification | MUST_FIX |

**Issue:** 两句音的比喻不是可靠定义：辅音并非只在开头，元音也不只是接续声音。ㄱ+ㅏ=가完全正确。当前实例已展示合体结果，不能据此把明确的视觉音节块教学目标判FULL。

**Length:** 按一次一个概念评估；无朗读时长测试。Node4总篇幅不长，但末句过长。Node6需分段停顿，非要求扩展术语。

**Recommended Revision（仅提案）：**

M1 — MUST_FIX

```text
자음과 모음을 함께 써요.
한 글자를 만들어요.
```

M2 — MUST_FIX

```text
ㄱ과 ㅏ를 한 글자 안에 모아 써요.
“가”를 보세요.
ㄱ은 왼쪽에 있어요.
ㅏ는 오른쪽에 있어요.
이렇게 한 글자 모양으로 써요.
```

证据：persisted-nodes.json、ui-render-validation.json中的order=2；node-review-02.json。

## 9 Node 3 Review

| Field | Review |
| --- | --- |
| Node Number | 3 |
| Title | 先认识基础元音 |
| Formal Type | explanation |
| Purpose | 接触并跟读六个基础元音。 |
| Korean Grammar | PASS |
| Korean Naturalness | PASS |
| Beginner Difficulty | PASS |
| Pedagogical Accuracy | PASS |
| Terminology | PASS |
| Length | PASS |
| Objective Alignment | PARTIAL |
| Classification | OPTIONAL |

**Issue:** ㅏ/ㅓ、ㅗ/ㅜ、ㅡ/ㅣ六个先行字母及顺序合理。明确不必全背，따라 읽어 보세요自然、礼貌。未声称只有六个元音；本node对目标2的元音子目标有支持，对目标2整体仍PARTIAL。

**Length:** 按一次一个概念评估；无朗读时长测试。Node4总篇幅不长，但末句过长。Node6需分段停顿，非要求扩展术语。

**Recommended Revision（仅提案）：**

O1 — OPTIONAL

```text
오늘은 모음 여섯 개를 먼저 볼까요?
```

证据：persisted-nodes.json、ui-render-validation.json中的order=3；node-review-03.json。

## 10 Node 4 Review

| Field | Review |
| --- | --- |
| Node Number | 4 |
| Title | 再认识基础辅音 |
| Formal Type | explanation |
| Purpose | 辨认八个基础辅音并降低记忆压力。 |
| Korean Grammar | PASS |
| Korean Naturalness | PASS |
| Beginner Difficulty | NEEDS_REVISION |
| Pedagogical Accuracy | PASS |
| Terminology | PASS |
| Length | TOO_LONG |
| Objective Alignment | PARTIAL |
| Classification | SHOULD_FIX |

**Issue:** 八个字母作为Exposure合理，不能要求立即Mastery。最后一句语法正确但嵌套过长，换行不会消除语法加工负担。ㅇ的初声无声特性不能被Node2“所有辅音制造开头声音”覆盖。

**Length:** 按一次一个概念评估；无朗读时长测试。Node4总篇幅不长，但末句过长。Node6需分段停顿，非要求扩展术语。

**Recommended Revision（仅提案）：**

S2 — SHOULD_FIX

```text
지금 다 외우지 않아도 괜찮아요.
자음과 모음은 달라요.
모양을 천천히 보세요.
```

证据：persisted-nodes.json、ui-render-validation.json中的order=4；node-review-04.json。

## 11 Node 5 Review

| Field | Review |
| --- | --- |
| Node Number | 5 |
| Title | 把辅音和元音放在一起 |
| Formal Type | example |
| Purpose | 用四个例子展示辅音+元音组合。 |
| Korean Grammar | PASS |
| Korean Naturalness | PASS |
| Beginner Difficulty | PASS |
| Pedagogical Accuracy | PASS |
| Terminology | PASS |
| Length | PASS |
| Objective Alignment | FULL |
| Classification | SHOULD_FIX |

**Issue:** 가/나/다/마全部组合正确，承接元音→辅音很自然；모아서 한 글자를 만들어요自然、适合入门。目标4已覆盖，NEEDS_REVISION仅来自目标2的朗读支撑建议S3，不是四个例子有错。

**Length:** 按一次一个概念评估；无朗读时长测试。Node4总篇幅不长，但末句过长。Node6需分段停顿，非要求扩展术语。

**Recommended Revision（仅提案）：**

S3 — SHOULD_FIX

```text
이렇게 자음과 모음을 모아서
한 글자를 만들어요.

한 번 따라 읽어 보세요.
가, 나, 다, 마.
라, 바, 사, 아.
“아”의 ㅇ은 소리가 나지 않아요.
지금은 한 번씩 읽어 봐요.
```

证据：persisted-nodes.json、ui-render-validation.json中的order=5；node-review-05.json。

## 12 Node 6 Review

| Field | Review |
| --- | --- |
| Node Number | 6 |
| Title | 一个音节里面有什么？ |
| Formal Type | explanation |
| Purpose | 借한初步认识初声、中声、终声。 |
| Korean Grammar | PASS |
| Korean Naturalness | PASS |
| Beginner Difficulty | NEEDS_REVISION |
| Pedagogical Accuracy | NEEDS_REVISION |
| Terminology | NEEDS_REVISION |
| Length | PASS |
| Objective Alignment | PARTIAL |
| Classification | MUST_FIX |

**Issue:** 한的ㅎ=초성、ㅏ=중성、ㄴ=종성准确。앞对初声可作先后简化；가운데易造成固定中央误解。下面可再有一个辅音是对本课单终声例子的可接受简化，不应推广为所有终声永远一个字母；不展开复合终声。ㅎ虽未在Node4列举，但在本例被明确显示，可先指认这一字母，不要求新增记忆表。

**Length:** 按一次一个概念评估；无朗读时长测试。Node4总篇幅不长，但末句过长。Node6需分段停顿，非要求扩展术语。

**Recommended Revision（仅提案）：**

M3 — MUST_FIX

```text
한 글자에서 모음을 중성이라고 해요.
모음의 자리는 모양에 따라 달라요.
“가”에서 ㅏ는 ㄱ의 오른쪽에 있어요.
“고”에서 ㅗ는 ㄱ의 아래에 있어요.
```

证据：persisted-nodes.json、ui-render-validation.json中的order=6；node-review-06.json。

## 13 Node 7 Review

| Field | Review |
| --- | --- |
| Node Number | 7 |
| Title | 一起试一试 |
| Formal Type | instruction |
| Purpose | 练习元音辨认和已教组合，给予鼓励。 |
| Korean Grammar | PASS |
| Korean Naturalness | PASS |
| Beginner Difficulty | PASS |
| Pedagogical Accuracy | PASS |
| Terminology | PASS |
| Length | PASS |
| Objective Alignment | FULL |
| Classification | OPTIONAL |

**Issue:** 题1 B.ㅏ、题2 A.가均唯一正确，所有选项来自前文；两个干扰项均同维度且合理。难度适合预备课，不能据两题推断掌握全部字母。韩语反馈自然敬语；题2可选增强具体性。文本答案公开/两组反馈并存是已批准的作者草稿，不是本次自动判分缺陷。

**Length:** 按一次一个概念评估；无朗读时长测试。Node4总篇幅不长，但末句过长。Node6需分段停顿，非要求扩展术语。

**Recommended Revision（仅提案）：**

O2 — OPTIONAL

```text
题1反馈：
잘했어요.
자음과 모음을 잘 구분했어요.

题2反馈：
잘했어요.
ㄱ과 ㅏ를 모으면 “가”가 돼요.
```

证据：persisted-nodes.json、ui-render-validation.json中的order=7；node-review-07.json。

## 14 Node 8 Review

| Field | Review |
| --- | --- |
| Node Number | 8 |
| Title | 今天学了什么？ |
| Formal Type | summary |
| Purpose | 回顾结构与可选终声，结束课前导航。 |
| Korean Grammar | PASS |
| Korean Naturalness | PASS |
| Beginner Difficulty | PASS |
| Pedagogical Accuracy | PASS |
| Terminology | PASS |
| Length | PASS |
| Objective Alignment | PARTIAL |
| Classification | SHOULD_FIX |

**Issue:** 总结符合前文，종성이 올 수 있어요已带可选含义，并未说每字必有终声。建议拆开并列串以减歧义。다음에는 글자를 하나씩 더 자세히 배워 볼게요自然礼貌，不必强改为另一句尾。

**Length:** 按一次一个概念评估；无朗读时长测试。Node4总篇幅不长，但末句过长。Node6需分段停顿，非要求扩展术语。

**Recommended Revision（仅提案）：**

S4 — SHOULD_FIX

```text
한 글자에는 초성과 중성이 있어요.
종성은 있을 수도, 없을 수도 있어요.
```

证据：persisted-nodes.json、ui-render-validation.json中的order=8；node-review-08.json。

## 15 Korean Language Review

| Rubric | Status |
| --- | --- |
| Grammar Accuracy | PASS |
| Natural Korean | NEEDS_REVISION |
| Simple Vocabulary | NEEDS_REVISION |
| Short Sentences | NEEDS_REVISION |
| Polite Style | PASS |
| Beginner Comprehension | NEEDS_REVISION |
| Pedagogical Clarity | NEEDS_REVISION |

没有明显语法错误或반말。Node1话题结构可以成立，SHOULD_FIX是自然度判断；不应为了形式正确而换成更难的이루어져 있어요。Node4换行后仍是同一个长比较/名词化句。보세요、볼까요等属于礼貌教学引导，无需机械统一为单一어요字面句尾。未打分或给数字评级。

## 16 Pedagogical Accuracy

M1：Node2的辅音/元音功能概括容易误导，且与终声知识冲突。国立国语院解释韩文按音节单位合写，并指出初声ㅇ可只占位而无声；这支持不能把所有辅音统一说成制造开头声音。[国立国语院：한글의 구성](https://www.korean.go.kr/hangeul/principle/001.html)

M3：중성是音节结构中的元音角色，不是视觉上固定中央。字形直接观察可见가的ㅏ在右、고的ㅗ在下；只用已教字母的局部例子足以消除误解。[국어원 한국어기초사전：중성](https://krdict.korean.go.kr/jpn/dicSearch/SearchView?ParaWordNo=76629&nation=jpn&nationCode=7&viewTypes=on)

한=ㅎ/ㅏ/ㄴ及가/나/다/마四个组合均正确；没有练习答案错误。语言事实参考官方资料，MUST/SHOULD等级及改写难度是本报告的教学判断。

## 17 Teaching Sequence Review

**PASS，建议保留1–8原序，不reorder。** 整体→元音→辅音→组合→内部结构→练习→总结没有倒序。重复主要用于导入与回顾。Node6的ㅎ不在Node4八字母表中，但已在当前例字被显示；就例指认即可，不要求提前扩展辅音表。S3若采纳，应在Node5解释组合后带读，而不是在Node4未说明组合时提前堆例。

## 18 Terminology Review

**NEEDS_REVISION（M3），不要求增加术语表。** `한글`指文字系统；`자음/모음`作为本课字母类别简称可用；`한 글자`在가/한这类例子中指一个合体音节字形。韩语台词没有使用음절，并非因此有错；预备课宜以具体字形统一所指，不为了术语完整增加记忆负担。

초성/중성/종성的结构角色需与左右上下视觉位置区分。Node6单终声例子的“下面再有一个辅音”可以保留为局部简化，但不能宣称所有终声永远只有一个字母；本课不扩展겹받침或音变。

## 19 Syllable Block Coverage

**PARTIAL COVERAGE；M2 MUST_FIX。** 不能说完全没有音节块：가/나/다/마/한已经展示合体结果。缺少的是把这些字母放在同一个可见块内的明确说明；“一起写成为一字”不足以排除分别横向排开这一初学者理解。当前Node2/5/6的display.slides均为空，不能假定已有动画或黑板补足。

学习目标1明确要求块的基本结构，故建议用既有가例子说明同一字内左/右位置，再在Node6用가/고说明位置随元音而变。不要将네모난说成所有字形严格为几何正方形。参见objective-and-display-source.json及syllable-block-review.json。

## 20 Cognitive Load Review

**NEEDS_REVISION。** 6元音、8辅音、3个结构术语、4组合和2练习，作为分段Exposure/Recognition可以成立；不适合作为一次全部记牢/准确发音的Mastery要求。Node3减压清楚，Node4也有减压意图但说法本身太难。

主要改善是缩短Node4嵌套句、Node6每次只指认一个角色并停顿。S3提议用已教辅音+ㅏ两组带读，每个只读一次；没有新增19辅音/21元音全集或复杂发音知识。没有音频/Runtime测试，因此不签署语速、停顿效果或实际发音PASS。

## 21 Practice Review

**PASS。** 题1唯一正确B.ㅏ，ㄱ/ㄴ均非元音；题2唯一正确A.가，나/다是已教且同维度的干扰项。难度适合预备课低门槛检查；内容来自Node1–6。韩语鼓励及错误提示自然、敬语，O2仅为可选具体化反馈。

保持instruction、DRAFT_TEXT_ONLY、Answer Correctness Runtime DEFERRED。两题主字段中连同答案和反馈保存是作者草稿设计；不据此签署学生呈现或自动判分，也不因没实现结构化互动判FAIL。ko-KR仅反馈的限制已明确，未把它误报为完整韩语题面。

## 22 Revision Classification

| Classification | Count | Items |
| --- | --- | --- |
| MUST_FIX | 3 | M1 Node2功能定义；M2 Node2音节块目标缺口；M3 Node6中声角色/视觉位置 |
| SHOULD_FIX | 4 | S1 Node1自然度；S2 Node4长句；S3 Node5朗读支撑；S4 Node8终声可选范围 |
| OPTIONAL | 2 | O1 Node3范围提示；O2 Node7按题反馈 |

按独立问题计数，不按节点数量；Node2两项分别是误导性定义和视觉块目标缺口，不能合并后隐去其中一个验收点。OPTIONAL不使Node3/7变为NEEDS_REVISION。

## 23 Proposed Revisions

完整机器可读条目见[revision-proposal.json](evidence/teaching-agent-stage-1f-r6d/revision-proposal.json)，每条含nodeNumber/title/formalType/currentText/issueType/classification/reason/proposedText/objectiveImpact，全部applied=false。第7–14节列出了对应韩语提案。

M1与M2应在未来同一次Node2修订中整合，避免重复句；S3仅建议增加已教字母组合的带读支撑，不宣称文字提案本身已经提供真实发音示范。若后续修订涉及双语字段，应显式核对主字段与韩语字段，不能只改其中一份。当前不实施任何一项。

## 24 UI / Persisted Validation

**PASS，8/8三方比对完成。** 每个节点主标题、正式类型、导航顺序、主台词及韩语版字段值与DB一致；DB又与R6C intended计划一致。Hangul字符、题目、选项、答案和反馈未丢失；仅CRLF/LF等价。

检查范围是Script Studio authoring DOM，不是student runtime。实际编辑器仅挂载所选node，因此通过已审计的只读节点导航依次读取，不改input/textarea/select。导航按钮必须匹配“选择第N小节”，若处于绑定模式则不会匹配、会停止。读取期间非只读HTTP请求0，末态“草稿已保存”。错误version24 tab未操作。

## 25 Canonical Content Protection

R6A Catalog Lesson、Textbook、Textbook Version、Chapter、Module、Teaching Lesson全行hash前后完全一致，四条objectives通过独立DB读取及所属行hash双重确认。R6B版本全行hash不变；R6C8节点全行hash和updated_at不变；历史审计仍create_draft1/add_node8/update_node24。参见canonical-content-diff.json。

## 26 Agent / Provider Boundary

本R6D Node INSERT/UPDATE/DELETE/reorder0；Script Version Writes0；Publish0、Runtime0、Agent0、Provider0、Pins0、Definition publication0、Auth Writes0。Feature OFF、三项allowlists EMPTY、Agent五表均0。Provider0为本任务范围；没有声称查询全站所有历史Provider活动。

## 27 Production End-State

结束再次READ ONLY确认：PG17.6、ledger457/latest202609140007；唯一version1 Draft、nodes8/order1–8；Build `6IhDHN8Dm1nCewiCEZnV5`、PM2 online。Runtime、launcher、Tailscale hashes及PM2进程元数据与R6D开始相同。Migration0、Deploy0、PM2 Mutation0、Runtime Mutation0、Launcher Mutation0、Tailscale Mutation0。所有生产内容未变化。

## 28 Gate Matrix

| Gate | Check | Status | Note |
| --- | --- | --- | --- |
| G-R6D-1 | R6C Draft Ready | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-2 | Script Version One | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-3 | Script Still Draft | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-4 | Node Count Eight | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-5 | Node Order Valid | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-6 | Formal Types Match | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-7 | Persisted/UI Match | PASS | Context Recovery RESOLVED；8/8 INTENDED/PERSISTED/RENDERED MATCH；首次FAIL历史保留 |
| G-R6D-8 | Objective1 Coverage | NEEDS_REVISION | 见专项review及revision-proposal；审稿完成不等于内容免修订 |
| G-R6D-9 | Objective2 Coverage | PARTIAL | 目标2辨认有覆盖，辅音跟读支撑不足；实际音频未测试 |
| G-R6D-10 | Objective3 Coverage | NEEDS_REVISION | 见专项review及revision-proposal；审稿完成不等于内容免修订 |
| G-R6D-11 | Objective4 Coverage | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-12 | Node1 Review | NEEDS_REVISION | Node review COMPLETE; SHOULD_FIX |
| G-R6D-13 | Node2 Review | NEEDS_REVISION | Node review COMPLETE; MUST_FIX |
| G-R6D-14 | Node3 Review | PASS | Node review COMPLETE; OPTIONAL |
| G-R6D-15 | Node4 Review | NEEDS_REVISION | Node review COMPLETE; SHOULD_FIX |
| G-R6D-16 | Node5 Review | NEEDS_REVISION | Node review COMPLETE; SHOULD_FIX |
| G-R6D-17 | Node6 Review | NEEDS_REVISION | Node review COMPLETE; MUST_FIX |
| G-R6D-18 | Node7 Review | PASS | Node review COMPLETE; OPTIONAL |
| G-R6D-19 | Node8 Review | NEEDS_REVISION | Node review COMPLETE; SHOULD_FIX |
| G-R6D-20 | Korean Grammar | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-21 | Korean Naturalness | NEEDS_REVISION | 见专项review及revision-proposal；审稿完成不等于内容免修订 |
| G-R6D-22 | Beginner Appropriateness | NEEDS_REVISION | 见专项review及revision-proposal；审稿完成不等于内容免修订 |
| G-R6D-23 | Pedagogical Accuracy | NEEDS_REVISION | 见专项review及revision-proposal；审稿完成不等于内容免修订 |
| G-R6D-24 | Terminology Consistency | NEEDS_REVISION | 见专项review及revision-proposal；审稿完成不等于内容免修订 |
| G-R6D-25 | Syllable Block Coverage | NEEDS_REVISION | 见专项review及revision-proposal；审稿完成不等于内容免修订 |
| G-R6D-26 | Cognitive Load | NEEDS_REVISION | 见专项review及revision-proposal；审稿完成不等于内容免修订 |
| G-R6D-27 | Practice Correctness | PASS | 两题答案正确；DRAFT_TEXT_ONLY不是失败，自动判分DEFERRED |
| G-R6D-28 | No R6D Node Writes | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-29 | No Publish | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-30 | No Runtime | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-31 | Feature OFF | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-32 | Allowlists EMPTY | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-33 | Agent Zero | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-34 | Provider Zero | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-35 | Pins Zero | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-36 | Canonical Content Unchanged | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-37 | Auth Writes Zero | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-38 | Runtime Unchanged | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-39 | Tailscale Unchanged | PASS | 独立只读DB/三方内容比对/本任务操作记录 |
| G-R6D-40 | Evidence Boundary | PASS | 独立只读DB/三方内容比对/本任务操作记录 |

教学Gate的NEEDS_REVISION不等于本次审稿未完成；首次G-R6D-7 FAIL已按独立Context Recovery关闭，历史文件保留。

## 29 Next Stage

**R6E — TEACHING SCRIPT REVISION**，仅作为待另行授权的下一阶段。R6D没有进入R6E，没有改节点。Stage1G仍NOT READY。

## 30 Final Recommendation

**Overall GO；Review COMPLETE；Revision Required YES；READY FOR REVISION。** 先保留并审阅3项必须修订及4项建议修订；当前Draft仍为原始8节点。不得将本结论当作Publish、Runtime、Provider、Pins或Feature授权。
