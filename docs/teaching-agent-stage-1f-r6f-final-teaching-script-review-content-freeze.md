# Stage 1F-R6F — Final Teaching Script Review & Content Freeze

## 1 Executive Summary

**Final Review PASS；Content Freeze PASS。** 目标version1 DRAFT、8/8节点通过最终独立文本审核。R6D三项MUST_FIX及四项SHOULD_FIX均已解决；新增MUST_FIX0、SHOULD_FIX0；O1/O2仍为两项非阻断OPTIONAL。四目标均达到文本教学覆盖，音频和Student Mastery均NOT TESTED。**Overall GO；53项Gate全部PASS。**

## 2 Scope

仅当前“韩文字母入门 / 第0章 / 课前导航”，alias hangul-introduction。READ ONLY最终审查后生成仓库中的冻结证据；没有Node/Version/Canonical内容修改。冻结不是Publish、数据库状态变更或自动不可变机制。

## 3 Review Inputs

重新完整读取R6E报告、R6D原始报告和revision-proposal；读取R6E精确计划、应用receipt及最终节点快照。使用新的READ ONLY连接读取真实8节点、四目标、canonical/版本完整行hash，独立审查现有文本而非复用R6E PASS标签。review-source-lock.json锁定历史输入与UI源码，历史文件未修改。

语言事实还参考[国立国语院：한글의 구성](https://www.korean.go.kr/hangeul/principle/001.html)：字母按音节合写，初声ㅇ可只占位而无声，中声由元音字母承担。这支持本课字形块、아和中声角色的判断；教学适切性与冻结结论来自本次审稿，不把外部完整字母表加入课程。

## 4 Production Preflight

独立复核PASS：PG17.6、ledger457/latest202609140007、Build 6IhDHN8Dm1nCewiCEZnV5、PM2 online；canonical链1、Teaching Lesson1、唯一version1 draft、nodes8/order1–8、active inconsistent fences0。Feature OFF、三项allowlists EMPTY、Agent五表0。当前完整节点及updated_at与R6E最终证据一致，无目标漂移。

## 5 Final Script Snapshot

| Node | Title | Formal Type | Status |
| --- | --- | --- | --- |
| 1 | 今天认识韩文字母 | opening | PASS |
| 2 | 韩文字母怎么组成？ | explanation | PASS |
| 3 | 先认识基础元音 | explanation | PASS |
| 4 | 再认识基础辅音 | explanation | PASS |
| 5 | 把辅音和元音放在一起 | example | PASS |
| 6 | 一个音节里面有什么？ | explanation | PASS |
| 7 | 一起试一试 | instruction | PASS |
| 8 | 今天学了什么？ | summary | PASS |

安全persisted快照见final-nodes.json。版本行指纹与R6E相同，published_at为空。

## 6 Node-by-Node Final Review

**Node1 — PASS**

存在句한글에는…있어요自然、语法正确；后续모아서 한 글자를 만들어요保留组合目标。问候和볼까요礼貌，信息量小；原不自然表述没有残留。

Grammar / Naturalness / Beginner / Pedagogical Accuracy / Terminology：PASS。

**Node2 — PASS**

先介绍两类字母，再明确한 글자 안에 모아 써요；가是同一字形而非分开的ㄱㅏ。左右两句紧随“가”를 보세요，仅解释该例，后续Node6提供下置元音反例。删除原声音开头/延续定义，没有误导性概括或新增难术语。

Grammar / Naturalness / Beginner / Pedagogical Accuracy / Terminology：PASS。

**Node3 — PASS**

ㅏ/ㅓ、ㅗ/ㅜ、ㅡ/ㅣ顺序合理；未声称元音总共只有六个。지금은 전부 외우지 않아도 괜찮아요明确不要求全背；따라 읽어 보세요自然敬语。모양과 소리를…봐요在课堂中表示一起观察学习，不是把声音定义为可见物。O1仍仅可选范围提示。

Grammar / Naturalness / Beginner / Pedagogical Accuracy / Terminology：PASS。

**Node4 — PASS**

三句替代连续名词化/比较句，减轻理解负担；原八字母未增加。前后的모양을…보세요属短促复习提醒，间隔一条减压说明，没有新命题矛盾，也未达到需要再次修改的重复程度。

Grammar / Naturalness / Beginner / Pedagogical Accuracy / Terminology：PASS。

**Node5 — PASS**

四组组合全部正确；两行가 나 다 마 / 라 바 사 아对应已展示的八个辅音与ㅏ。未把字母名称等同读音。“아”의 ㅇ无声限定该字的初声位置，不把终声ㅇ错误地说成无声。引导每个读一次，保留Exposure，未加入音变。文本包含读音示范指令，但没有证明音频正确性或学生掌握。

Grammar / Naturalness / Beginner / Pedagogical Accuracy / Terminology：PASS。

**Node6 — PASS**

中声以모음角色说明，가中ㅏ在ㄱ右侧、고中ㅗ在ㄱ下方，明确位置随形态变化，原가운데定义已消失。앞可理解为音节顺序的前部而非固定左侧；终声下面可再有一个辅音限定入门单终声例子，并未宣称所有终声只能含一个字母。한=ㅎ/ㅏ/ㄴ完全正确。ㅎ在例字中直接指出，未要求提前背会它；无必要的前置知识缺口。三角色是本目标必要术语，以短句分段，不扩展받침规则。

Grammar / Naturalness / Beginner / Pedagogical Accuracy / Terminology：PASS。

**Node7 — PASS**

两题唯一正确答案分别B.ㅏ与A.가；干扰项全来自已教内容。反馈礼貌自然、难度合适，第二题反馈泛化但未给出错误评价。主字段保存两题/选项/答案/反馈，ko-KR只保存反馈是既有合同，不能当成内容丢失；也不视为学生呈现或自动判分已验证。O2非阻断。

Grammar / Naturalness / Beginner / Pedagogical Accuracy / Terminology：PASS。

**Node8 — PASS**

초성과 중성이 있어요与종성은 있을 수도, 없을 수도 있어요分句明确必需/可选范围。在当前가/한这类合体字形语境中准确，并非宣称每个独立字母符号都含这些部分。总结与Node6一致，最后的배워 볼게요自然礼貌。

Grammar / Naturalness / Beginner / Pedagogical Accuracy / Terminology：PASS。

## 7 R6D Findings Resolution

| Item | Node | Final Result |
| --- | --- | --- |
| M1 | 2 | RESOLVED |
| M2 | 2 | RESOLVED |
| M3 | 6 | RESOLVED |
| S1 | 1 | RESOLVED |
| S2 | 4 | RESOLVED |
| S3 | 5 | RESOLVED |
| S4 | 8 | RESOLVED |

原错误句在当前对应台词中消失；七项当前替换内容均逐项实际读取。M1/M2在同一个Node2中完整覆盖，未将它们合并为一个验收项。

## 8 New Issue Scan

New MUST_FIX0；New SHOULD_FIX0。检查了事实、拼写、Hangul、语法、自然度、重复、前置知识、顺序、矛盾和目标缺口。Node2左右仅描述가，Node6的고明确展示下置元音，不存在相互矛盾。Node4的看形状短句重复服务于复习；Node6的ㅎ在한中直接指认，不要求新增背诵列表。没有提出新的内容修改，也不因纯风格偏好重启修订循环。

## 9 Learning Objective Final Coverage

| Objective | Status | Current Evidence |
| --- | --- | --- |
| 1 | FULL | Node2明确字母放入同一个가字形，局部左右位置解释与Node6下置元音形成一致的块内布局说明。 |
| 2 | FULL TEXT COVERAGE | Node3六元音辨形与跟读，Node4八辅音辨形、减压，Node5八个简单音节跟读；FULL只签署文本指导覆盖。 |
| 3 | FULL | Node6初声/中声/终声角色与한拆分正确，中声位置不固定；Node8清楚说明终声可选。 |
| 4 | FULL | Node2组合说明、Node5四个正确组合、Node7对가的辨认检查形成入门覆盖。 |

**Audio Verification NOT TESTED；Student Mastery NOT TESTED。** FULL指Draft讲解/示例/练习支持，不等于学生已能准确发音或独立掌握；未执行TTS、音频播放、学生Runtime或Provider。

## 10 Korean Final Review

| Rubric | Result |
| --- | --- |
| Grammar Accuracy | PASS |
| Natural Korean | PASS |
| Simple Vocabulary | PASS |
| Short Sentences | PASS |
| Polite Style | PASS |
| Beginner Comprehension | PASS |
| Pedagogical Clarity | PASS |

해요体为主，보세요/볼까요等常用敬语教学指令自然，无반말。零基础适切性针对分段、示例支持的入门Exposure，不是无需教师引导的听力理解保证。没有数字评分。

## 11 Teaching Sequence

Node2先给整体例子，再分别认识字母，Node5回到组合；Node6位置对照与Node2局部左右说明不矛盾。한里的ㅎ就例指认，不要求记忆新的辅音列表。导入/总结重复承担预告与回顾功能。

顺序1–8 PASS；没有reorder。

## 12 Cognitive Load

8节点分段，Node3/4明确无需全背；Node5分两组各读一次；Node6必要的三角色以短句和例字分解。较长的Node6没有长嵌套句。实际呈现停顿、音频节奏和学生接受程度未测试。

结论PASS，Exposure/Recognition；不要求本课一次Mastery。

## 13 Practice Review

PASS。题1唯一正确B.ㅏ；题2唯一正确A.가。选项均为前文所教的字母或简单音节，题目、答案、反馈完整。Formal Type instruction；DRAFT_TEXT_ONLY；Answer Correctness Runtime DEFERRED。ko-KR仅反馈是既有字段职责；没有把它误报为完整韩语题面，也不签署学生端答案隐藏或自动判分。

## 14 Optional Items

O1 Node3：NONBLOCKING OPTIONAL / NOT APPLIED，没有声称韩语只有六个元音。O2 Node7：NONBLOCKING OPTIONAL / NOT APPLIED，通用鼓励不会改变正确答案或造成错误概念。两项保留合理，不升级为MUST/SHOULD，不触发R6G。

## 15 UI / Persisted Validation

PASS，8/8 EXPECTED AFTER R6E ↔ PERSISTED DB ↔ RENDERED UI。复用既有本人登录Chrome的精确chapter tab，chapter/version安全hash匹配；错误version24 tab未操作。GET刷新后只读节点导航，逐项读取title/type/order、主字段、ko-KR和updated_at，正文无乱码/截断；仅CRLF/LF等价，时间戳比较保留微秒精度。Node3/7全部行及updated_at仍与R6E前快照相同。

浏览器期间非GET/HEAD/OPTIONS请求0、字段输入事件0、Save0。原Chrome保持打开，不读取认证秘密、不重新登录、不启动新Profile。

## 16 Content Freeze Decision

**Content Freeze PASS — FROZEN FOR DOWNSTREAM INTEGRATION。** R6D未解决MUST/SHOULD均0，新增MUST/SHOULD均0，四目标文本覆盖FULL，8节点结构稳定，UI/DB一致。数据库status继续draft。冻结为本阶段工程/内容验收记录，未创建frozen字段或修改任何数据库状态。

## 17 Freeze Baseline

冻结时间UTC：2026-09-17T01:36:21.026410+00:00。文件：evidence/teaching-agent-stage-1f-r6f/content-freeze-baseline.json。

包含target alias、version安全hash及行hash、8节点安全ID哈希、顺序、类型、标题、updated_at、全行/台词map/raw UTF-8/ko-KR/等价换行hash，四目标hash及审稿结果。payload SHA256：`55a2b81ed6912e392ab17d502e5d2ffce3e0ddce330ae45d09ba79ccadcd43b8`。所有后续内容改变必须开新的明确revision task；此文件没有自动阻止数据库编辑的功能。

## 18 Interactive Video Readiness

READY FOR INTERACTIVE VIDEO INTEGRATION PLANNING。当前8个Teaching Nodes继续作为教学设计/编排层，未来Teaching Blocks、Activities、Timeline Cues、Lesson Manifest应建立在该脚本之上。这里只记录兼容方向与文字冻结约束，没有设计实现、创建上述对象或进入R7A。

## 19 Canonical Content Protection

R6A Catalog Lesson、Textbook、Textbook Version、Chapter、Module、Teaching Lesson和四目标完整行指纹/字段不变；R6B版本行不变；R6E8节点全行hash及updated_at不变。无关content的数量与关联metadata hash、Foundation schema指纹不变。create_draft1/add_node8/update_node30保持原值。

## 20 Agent / Provider Boundary

Feature OFF；Allowlists EMPTY；Agent五表各0。本任务Node Writes0、Script Version Writes0、Publish0、Runtime/Preview0、Provider0、Agent0、Pins创建0、Definition Publication0、Auth Writes0。Provider/Agent操作计数仅指本任务范围，不伪造全站历史活动审计。Stage1G NOT READY。

## 21 Production End-State

结束独立READ ONLY检查PASS：PG17.6、ledger457/latest202609140007、批准Build、PM2 online、唯一version1 draft、8节点/order1–8均不变。Runtime/Launcher/Tailscale hashes、PM2进程元数据与R6E及本阶段开始一致。Migration0、Deploy0、PM2 Mutation0、Runtime Mutation0、Launcher Mutation0、Tailscale Mutation0。只有仓库中的R6F报告/evidence新增。

## 22 Gate Matrix

| Gate | Check | Status |
| --- | --- | --- |
| G-R6F-1 | R6E Complete | PASS |
| G-R6F-2 | Target Exact | PASS |
| G-R6F-3 | Script Version1 Draft | PASS |
| G-R6F-4 | Node Count Eight | PASS |
| G-R6F-5 | Node Order | PASS |
| G-R6F-6 | Node Types | PASS |
| G-R6F-7 | UI/Persisted Match | PASS |
| G-R6F-8 | Node1 Final Review | PASS |
| G-R6F-9 | Node2 Final Review | PASS |
| G-R6F-10 | Node3 Final Review | PASS |
| G-R6F-11 | Node4 Final Review | PASS |
| G-R6F-12 | Node5 Final Review | PASS |
| G-R6F-13 | Node6 Final Review | PASS |
| G-R6F-14 | Node7 Final Review | PASS |
| G-R6F-15 | Node8 Final Review | PASS |
| G-R6F-16 | M1 Resolved | PASS |
| G-R6F-17 | M2 Resolved | PASS |
| G-R6F-18 | M3 Resolved | PASS |
| G-R6F-19 | S1 Resolved | PASS |
| G-R6F-20 | S2 Resolved | PASS |
| G-R6F-21 | S3 Resolved | PASS |
| G-R6F-22 | S4 Resolved | PASS |
| G-R6F-23 | O1 Nonblocking | PASS |
| G-R6F-24 | O2 Nonblocking | PASS |
| G-R6F-25 | Objective1 Full | PASS |
| G-R6F-26 | Objective2 Full Text Coverage | PASS |
| G-R6F-27 | Objective3 Full | PASS |
| G-R6F-28 | Objective4 Full | PASS |
| G-R6F-29 | Korean Grammar | PASS |
| G-R6F-30 | Korean Naturalness | PASS |
| G-R6F-31 | Beginner Appropriateness | PASS |
| G-R6F-32 | Pedagogical Accuracy | PASS |
| G-R6F-33 | Terminology | PASS |
| G-R6F-34 | Teaching Sequence | PASS |
| G-R6F-35 | Cognitive Load | PASS |
| G-R6F-36 | Practice Correctness | PASS |
| G-R6F-37 | New MUST_FIX Zero | PASS |
| G-R6F-38 | New SHOULD_FIX Zero | PASS |
| G-R6F-39 | No R6F Content Writes | PASS |
| G-R6F-40 | Script Still Draft | PASS |
| G-R6F-41 | No Publish | PASS |
| G-R6F-42 | No Runtime | PASS |
| G-R6F-43 | Feature OFF | PASS |
| G-R6F-44 | Allowlists EMPTY | PASS |
| G-R6F-45 | Agent Zero | PASS |
| G-R6F-46 | Provider Zero | PASS |
| G-R6F-47 | Pins Zero | PASS |
| G-R6F-48 | Canonical Content Unchanged | PASS |
| G-R6F-49 | Runtime Unchanged | PASS |
| G-R6F-50 | Tailscale Unchanged | PASS |
| G-R6F-51 | Freeze Baseline Created | PASS |
| G-R6F-52 | Interactive Video Planning Ready | PASS |
| G-R6F-53 | Evidence Boundary | PASS |

## 23 Next Stage

R7A — INTERACTIVE VIDEO INTEGRATION FOUNDATION，仅列为后续阶段，本任务未开始。O1/O2不触发R6G；Stage1G仍NOT READY。

## 24 Final Recommendation

教学文本已达到可以结束本轮内容改善循环的状态。保留version1 DRAFT与本次冻结基线，停止。下游不得随意修改台词；新内容修订需明确新任务。最终文件范围、JSON/脚本语法、敏感信息检查、冻结hash验证及git diff --check均PASS。R6D/R6E历史和产品源码保持不变。
