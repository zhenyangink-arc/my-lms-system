# Stage 1F-R6E — Teaching Script Revision

## 1 Executive Summary

Revision COMPLETE。六个授权节点已完成精确修订；3/3 MUST_FIX、4/4 SHOULD_FIX 已解决，OPTIONAL 0/2 应用、剩余2项。当前为 version1 DRAFT、8个节点；READY FOR FINAL REVIEW。Overall：GO。

## 2 Scope

目标：韩文字母入门 / 第0章 / 课前导航；canonical alias：hangul-introduction。仅修改Node1、2、4、5、6、8的既有台词及官方镜像scriptSegments。Node3、7未修改；不新增、删除、重排或改类型，不创建新版本。

## 3 R6D Revision Inputs

R6D报告与原revision-proposal.json完整保留，原applied=false没有改写。R6E使用本阶段用户给出的精确修订文本；M1/M2在Node2一次合并修订。输入文件锁见source-contract.json；逐项应用结果见revision-application.json。

## 4 Authorization Boundary

在只读预检、前快照与替换计划准备后，用户明确回复“批准”。授权记录见authorization-scope.json。使用原有本人Platform Owner会话和现有Chrome/CDP，未启动新浏览器、未读取Cookie/JWT、未重新登录或冒用账号。只执行一次/节点的正常表单autosave；每步之后新READ ONLY连接验证成功才继续。

## 5 Production Preflight

PG17.6；ledger457；latest202609140007；Build 6IhDHN8Dm1nCewiCEZnV5；PM2 online。canonical chain1、Teaching Lesson1、version1 draft、nodes8/order1–8。Feature OFF、Allowlists EMPTY、Agent五表0、active inconsistent fences0。当前RPC函数体与锁定migration合同一致，updated_at CAS及1800ms autosave生效。

## 6 Before Snapshot

before-snapshot.json保存8节点的安全ID哈希、标题、正式类型、排序、主/ko-KR/teacher_script哈希、updated_at、完整行哈希；execution-before.json额外锁定不可修改字段、审计日志、无关内容及schema指纹。无raw UUID或认证信息。

## 7 Node1 Revision

S1：仅将“한글은 자음과 모음으로 만들어요.”替换为“한글에는 자음과 모음이 있어요.”，其它文字不变。

结果：REVISED / PASS。主字段与ko-KR均精确匹配；官方update_node审计新增1条。完整before/after行哈希、updated_at与字段哈希见node-01-revision.json。

## 8 Node2 Revision

M1 + M2：删除辅音制造声音开头/元音延续声音的概括，采用用户指定整段文本；明确把ㄱ与ㅏ放在同一个가字形里。左右位置仅描述가。

结果：REVISED / PASS。主字段与ko-KR均精确匹配；官方update_node审计新增1条。完整before/after行哈希、updated_at与字段哈希见node-02-revision.json。

## 9 Node4 Revision

S2：把长比较句换成三句简短台词，保留原辅音列表与其它文字。

结果：REVISED / PASS。主字段与ko-KR均精确匹配；官方update_node审计新增1条。完整before/after行哈希、updated_at与字段哈希见node-04-revision.json。

## 10 Node5 Revision

S3：保留四组组合示例及原台词，追加가/나/다/마与라/바/사/아跟读、아中起始ㅇ无声说明。未调用TTS或播放音频。

结果：REVISED / PASS。主字段与ko-KR均精确匹配；官方update_node审计新增1条。完整before/after行哈希、updated_at与字段哈希见node-05-revision.json。

## 11 Node6 Revision

M3：去除用“가운데”定义중성的表述，增加角色说明及가/고中元音位置对比。完整保留초성、종성和한的正确示例。

结果：REVISED / PASS。主字段与ko-KR均精确匹配；官方update_node审计新增1条。完整before/after行哈希、updated_at与字段哈希见node-06-revision.json。

## 12 Node8 Revision

S4：明确초성和중성存在，종성可以有也可以没有。其它总结及下一课结语保持原样。

结果：REVISED / PASS。主字段与ko-KR均精确匹配；官方update_node审计新增1条。完整before/after行哈希、updated_at与字段哈希见node-08-revision.json。

## 13 Node3 / Node7 Protection

两个节点的完整行哈希及updated_at均前后一致，update_node审计增量均0。O1/O2 NOT APPLIED。Node7保持instruction、两题完整Draft文本和原反馈；Answer Correctness Runtime DEFERRED。

## 14 Bilingual Field Consistency

六个授权节点的主teacher_script与ko-KR均与精确计划匹配。表单产生CRLF，与计划LF仅等价换行；不执行trim或内容重写。Node1第一次校验因此报告不匹配，暂停后用新只读连接定位并修正比较规则，未重复fill/save。各节点除teacher_script、对应scriptSegments及updated_at外的完整字段指纹不变。最终GET刷新后8个节点的UI、类型、标题、顺序和文本均与DB一致，无乱码或截断。

## 15 Revision Proposal Resolution

| Item | Node | Result |
| --- | --- | --- |
| S1 | 1 | RESOLVED |
| M1 | 2 | RESOLVED |
| M2 | 2 | RESOLVED |
| M3 | 6 | RESOLVED |
| S2 | 4 | RESOLVED |
| S3 | 5 | RESOLVED |
| S4 | 8 | RESOLVED |
| O1 | 3 | NOT APPLIED — OPTIONAL |
| O2 | 7 | NOT APPLIED — OPTIONAL |

MUST_FIX remaining0；SHOULD_FIX remaining0；OPTIONAL remaining2。

## 16 Learning Objective Coverage After Revision

| Objective | Before | After | Evidence |
| --- | --- | --- | --- |
| 1 字母与视觉音节块 | PARTIAL | FULL | Node2同一가字形内组合与位置解释 |
| 2 辨认与朗读接触 | PARTIAL | FULL（文本教学覆盖） | Node3六元音跟读，Node5八个简单音节跟读 |
| 3 初声/中声/终声 | PARTIAL | FULL | Node6角色与视觉位置区分，Node8终声可选 |
| 4 简单组合 | FULL | FULL | Node2/5组合及Node7原练习 |

FULL仅表示Draft文本中的教学覆盖，不表示已验证音频、学生实际发音或掌握程度。四条Learning Objectives本身未修改；音频、TTS、学生表现及Runtime均未测试。

## 17 Draft / Publication Boundary

唯一Script Version仍为1 DRAFT，published_at为空，完整version行指纹不变。节点仍8个，顺序1–8；类型opening / explanation / explanation / explanation / example / explanation / instruction / summary。Publish0、Runtime0、Preview0。

## 18 Canonical Content Protection

Catalog Lesson、Textbook、Textbook Version、Chapter、Module、Teaching Lesson及四条Objectives保持原完整行指纹。无关内容的数量、关联、安全metadata指纹不变；schema的columns/functions/constraints/policies/relations指纹不变。R6B版本基础信息未改变。

## 19 Agent / Provider Boundary

Feature OFF；Allowlists EMPTY；Agent五表各0；本任务Agent Run0、Provider请求0、Pins创建0、Definition publication0、Auth Writes0。未进入Runtime或Stage1G，未修改政策批准状态。

## 20 Production End-State

Authorized Node Writes：UPDATE 6（六次官方保存，每节点1次），官方update_node日志INSERT 6。Node INSERT0/DELETE0；Unauthorized Writes0。日志从24增至30，所有新增审计的安全nodeHash恰好对应六个批准节点；add_node8和create_draft1不变。

最终PG17.6/ledger457/latest202609140007/批准Build保持不变；PM2 PID/restart及配置、runtime/launcher/Tailscale哈希全部不变。Migration0、Deploy0、PM2 mutation0、基础设施mutation0。Chrome保持打开。

## 21 Gate Matrix

| Gate | Check | Status |
| --- | --- | --- |
| G-R6E-1 | R6D Review Complete | PASS |
| G-R6E-2 | Revision Scope Exact | PASS |
| G-R6E-3 | Authenticated Platform Owner | PASS |
| G-R6E-4 | Target Context Exact | PASS |
| G-R6E-5 | Script Version1 Draft | PASS |
| G-R6E-6 | Node Count Eight | PASS |
| G-R6E-7 | Write Authorization | PASS |
| G-R6E-8 | S1 Node1 | PASS |
| G-R6E-9 | M1 Node2 | PASS |
| G-R6E-10 | M2 Node2 | PASS |
| G-R6E-11 | S2 Node4 | PASS |
| G-R6E-12 | S3 Node5 | PASS |
| G-R6E-13 | M3 Node6 | PASS |
| G-R6E-14 | S4 Node8 | PASS |
| G-R6E-15 | Node3 Unchanged | PASS |
| G-R6E-16 | Node7 Unchanged | PASS |
| G-R6E-17 | Node Types Unchanged | PASS |
| G-R6E-18 | Node Order Unchanged | PASS |
| G-R6E-19 | Main/ko-KR Consistency | PASS |
| G-R6E-20 | Objective1 Improved | PASS |
| G-R6E-21 | Objective2 Improved | PASS |
| G-R6E-22 | Objective3 Improved | PASS |
| G-R6E-23 | Objective4 Remains Full | PASS |
| G-R6E-24 | All MUST_FIX Resolved | PASS |
| G-R6E-25 | All SHOULD_FIX Resolved | PASS |
| G-R6E-26 | Optional Items Not Applied | PASS |
| G-R6E-27 | Script Still Draft | PASS |
| G-R6E-28 | No Publish | PASS |
| G-R6E-29 | No Runtime | PASS |
| G-R6E-30 | Feature OFF | PASS |
| G-R6E-31 | Allowlists EMPTY | PASS |
| G-R6E-32 | Agent Zero | PASS |
| G-R6E-33 | Provider Zero | PASS |
| G-R6E-34 | Pins Zero | PASS |
| G-R6E-35 | Canonical Content Unchanged | PASS |
| G-R6E-36 | Auth Writes Zero | PASS |
| G-R6E-37 | Runtime Unchanged | PASS |
| G-R6E-38 | Tailscale Unchanged | PASS |
| G-R6E-39 | Evidence Boundary | PASS |

## 22 Next Stage

Content Revision Status：READY FOR FINAL REVIEW。下一阶段为R6F — FINAL TEACHING SCRIPT REVIEW & CONTENT FREEZE；本任务未进入。Stage1G NOT READY。

## 23 Final Recommendation

保持Draft并停止。七项授权修订已完成，两个OPTIONAL保留，不扩大范围。节点、版本、关联、双语文本及基础设施安全检查通过；最终JSON解析、脚本语法、敏感信息、文件范围及git diff --check通过，Overall GO。
