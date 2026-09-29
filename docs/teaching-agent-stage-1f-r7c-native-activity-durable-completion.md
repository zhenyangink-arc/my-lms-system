# Stage 1F-R7C — Native Activity / Durable Completion Binding

## 1 Executive Summary

**Overall: CONDITIONAL. Durable Completion: TEST-ENV VERIFIED. Execution Status: DURABLE BINDING LIMITATION.**

现有 single_choice Activity、真实 grader、正式 7 参数 SQL RPC、durable attempt / node progress、独立 readback、进程重启及 native Runtime pause/resume 已在隔离 PostgreSQL 验证。131/131 相关测试通过，Next build / TypeScript PASS，新增 lint 错误0。

当前运行数据库业务写入0，目标仍没有正式 execution node / Activity / private answer。没有执行当前 canonical Activity 的官方 authoring/binding，也没有验证 published student admission，不能签当前开发DB绑定 GO，不进入R7D。

一项范围偏差：初轮隔离负向测试额外 UPDATE 1 条自建 Activity prompt，未列入原审批写入类型。该隔离库已销毁，最终测试改为 read-port 故障注入。当前数据库无影响；G-R7C-4 如实记 PARTIAL。

## 2 Teaching Agent Mainline

主线保持 UPLY Teaching Agent / AI 韩语教师助手。此次完成的是 Teaching Agent 将来可依赖的 Activity / Attempt / Progress 执行事实，不是新题库、新进度系统或独立互动视频产品。视频与 mock cue 仍只是既有 LessonRuntime 的 presentation 能力。Agent、Provider、Definition、Pins 均未运行或写入。

## 3 Scope

仅处理 hangul-introduction / 第0章 / 课前导航的 Node7 第一题，alias `hangul-introduction-vowel-recognition`。Domain `single_choice`；renderer `multiple_choice`。第二题和 Cue DB 继续 deferred。

修改4个既有产品文件，新增3个 server-only 产品文件；没有新增业务表、RPC或项目migration。仅自建隔离测试数据库复现已有schema。R6F 8个冻结节点、版本和4条目标完全不变。

精确文件：[implementation-plan.json](evidence/teaching-agent-stage-1f-r7c/implementation-plan.json)。当前数据库生产入口、StudentPolicy、旧教材、legacy路径、PM2和Tailscale均未修改。

## 4 R7B Input

R7B report的 CONDITIONAL / FIXTURE LIMITATION 已接受。继续使用 LessonManifestV1、LessonRuntime、NativeMediaController、StepController generation lease、TargetRegistry、MultipleChoiceBlock、原开发视频、mock cue、Learning Area 和布局 owner。

R7B原有108项覆盖全部保留；增加1项“valid submit receipt不能覆盖独立INCOMPLETE readback”回归及22项R7C测试计数，共131/131。没有重写视频/Cue/seek核心逻辑。

## 5 Authorization

只读审计及精确计划完成后，通过审批工具提出代码和隔离DB范围；用户明确回复：“批准上述隔离测试及代码范围”。未复用历史R7B批准。

批准范围：当前DB写入0，隔离fresh fixture每份parent1 / Activity1 / private answer1；测试作答通过正式RPC写attempt和node progress；不创建当前Auth用户、不使用真实学生、不建立登录session。

初轮测试的1条隔离Activity prompt UPDATE不在列明类型内，已移除该负向测试写法并记录，未将偏差改写为从未发生。其余实际产品文件和测试文件均在批准范围；无需修改3条既有Hook lint问题。

详见 [authorization-scope.json](evidence/teaching-agent-stage-1f-r7c/authorization-scope.json)、[db-write-boundary.json](evidence/teaching-agent-stage-1f-r7c/db-write-boundary.json)。

## 6 Production Preflight

独立 READ ONLY 检查通过：PostgreSQL17.6、ledger457、latest202609140007、Build `6IhDHN8Dm1nCewiCEZnV5`、PM2 online且PID/restart计数与基线一致。Feature OFF、allowlists EMPTY、Agent五表0、active inconsistent fences0。

canonical chain1、Script Version1 draft、nodes8、顺序1–8。节点完整行hash、版本hash及objective map与R6F精确一致。当前目标 execution nodes0、Activities0、private answers0。

## 7 Existing Activity Domain

实际FK为 Activity → digital_textbook_nodes → module → chapter → textbook version，不能用 Teaching Script Node7 ID充当Activity parent。private answer独立存于 digital_textbook_activity_secrets。

当前catalog的7/8参数 record_smart_textbook_attempt 函数体与仓库迁移逐字匹配：7参数源202608180027，8参数源202608180008。选择7参数正式objective RPC。它使用service_role权限、activity级advisory锁分配attempt_number，再同事务维护node progress；authenticated不能直接执行。

single_choice复用 `gradeSmartTextbookActivity` 的已有index私有答案合同。新seam不调用旧 submitActivityInDomain：其Draft preview明确不持久化，非preview旧错误分支含PGRST202 fallback。此次复用其正式grader和原子RPC，缺少RPC即fail closed。

## 8 Target Activity Binding

当前运行DB未创建新对象，正式canonical binding仍 NOT VERIFIED。未发现适用于orientation的新建通用action/RPC：grammar helper用于grammar节点，chapter-practice管理不创建此Activity，已发布Activity editor只能编辑已有对象。

经用户批准，隔离test bootstrap每份建立1个合法practice execution node、1个single_choice Activity及1条私有答案。fixture parent链为synthetic catalog lesson → textbook/version draft → chapter0 → orientation module → practice node。synthetic tenant/actor仅满足隔离FK，不调用Auth服务、不复制真实身份。

新 `native-activity-binding.server.ts` 严格验证父链和公开内容，投影只接受白名单字段。Public alias映射到server-only真实Activity ID；没有伪造Teaching Node FK。它是existing-schema test binding，不冒充当前DB官方authoring。

## 9 Public / Private Answer Boundary

公开prompt为“哪个是元音？”，选项为 ㄱ / ㅏ / ㄴ。公开投影没有答案标记、private grader config、Node7完整作者正文、真实DB ID或私有definition digest。

private answer在既有secrets表，仅server grader读取。隔离DB验证authenticated直接读secret和执行原子RPC均被拒绝。Manifest、HTTP公开DTO、pre-submit DOM、client bundle dependency graph、facts和console日志扫描PASS。出现公开选项ㅏ本身不算泄漏，正确性标记和答案key才是隔离对象。

证据：[public-private-boundary.json](evidence/teaching-agent-stage-1f-r7c/public-private-boundary.json)、[answer-leakage-scan.json](evidence/teaching-agent-stage-1f-r7c/answer-leakage-scan.json)。

## 10 Durable Attempt

服务端先使用已有grader评分，再调用正式7参数RPC。response仍是既有JSONB列，本native路径保存 `native-choice-response/1` envelope：请求关联、execution binding digest、private definition digest、学生所选坐标及client generation。正确答案key不写入该envelope。

RPC实际 INSERT digital_textbook_attempts；错误与正确作答分别持久化并具有attempt_number、is_correct、score及数据库timestamp。安全evidence不输出原始response或数据库ID。最终完整suite共16条attempt INSERT，分散在独立synthetic场景；不存在生产attempt。

## 11 Durable Progress

原RPC同事务维护 digital_textbook_node_progress。最终完整suite产生13条progress row INSERT及3次后续UPDATE；这是已有progress体系。单选第一题不需要activity_page_progress写入，且未建立替代表。

本题Activity完成事实来自匹配scope和内容证据的correct attempt；node progress作为一致性校验。node/step/lesson completion仍分离：本单required-activity node可以completed，但Runtime不会据此推进Lesson或把MEDIA_ENDED当作完成。

既有系统没有该域CAS state revision，因此使用attempt sequence、数据库timestamps和readback digest，不把sourceRevision伪装成student revision。

## 12 Completion Authority

`activity-completion/2` 将证据声明为 `activity-domain / isolated-test-db / durable-attempt-sequence`，并绑定request、session/snapshot、step/block/activity、cue/media revision、generation。

COMPLETED：当前合法scope内存在correct durable attempt，绑定的private definition未漂移，且匹配progress证据一致。

INCOMPLETE：独立一致性读取成功，但不存在正确attempt。错误作答可持久化，不能resume。

UNKNOWN：读不可用、绑定/内容漂移、响应证据非法、progress缺失或不一致。保持暂停，不以ok或correct callback补全事实。

保留activity-completion/1用于原R7B fixture tests；不是双业务Runtime。新durable adapter只产生v2。

## 13 Independent Readback

repository每次read使用新连接、`REPEATABLE READ READ ONLY`事务，并重新读取父链、definition digest、attempt及node progress。不是submit回包缓存，也不是内存完成标志。

NativeMediaController现在对每次submit都执行独立readback，即便submit返回有效COMPLETED也不直接resume。独立INCOMPLETE/UNKNOWN会保持等待；旧generation readback不能控制新媒体。

服务端submit自身也可返回读取到的receipt供诊断，但它仍不能替代Runtime发起的独立readback。

## 14 Idempotency / UNKNOWN

原裸RPC只有序号锁，没有request幂等参数。新的trusted server transaction seam先获取与RPC完全相同的tenant/student/activity advisory lock，再在下一条READ COMMITTED语句读取request envelope；并锁定content rows核对definition digest，再有条件调用原RPC。

相同request且payload相同（generation可更新）重用持久化记录；同request不同payload拒绝；并发测试仅1个attempt / 1次progress更新。服务进程重建后同request仍不新增attempt。request字符串作为SQL数据转义，注入负向测试通过。

这个保证仅适用于新seam，不声称任意绕过seam的旧裸RPC caller具有幂等性。没有新增RPC、表、列或PGRST202 fallback。

丢response但DB已commit→新readback COMPLETED；未commit→INCOMPLETE；无法读取→UNKNOWN。都不自动重试submission。初轮开发SQL表达式错误是明确失败/回滚，修正后使用新的隔离fixture，不是对unknown commit盲重试。

## 15 Restart Persistence

真实终止隔离HTTP/domain服务子进程，保留独立PostgreSQL容器，再启动新服务PID。COMPLETED从同一DB重建，Cue不强制重复；同request再次提交不会产生第二个attempt。

等待状态恢复使用同scope的浏览器presentation hint加独立DB INCOMPLETE读取，保持AWAITING_ACTIVITY。hint既不是完成证据，也不允许跳过mandatory cue；没有创建durable Cue checkpoint表。无hint时视频从安全初始位置开始，仍受mandatory cue约束。

验证范围是服务进程重启，不是宿主机掉电、DB灾备或生产多副本admission测试。

## 16 Runtime Pause / Resume Binding

浏览器真实挂载原LessonRuntime / MultipleChoiceBlock / HTML5 video。Mock cue使视频暂停并显示Learning Area；错误attempt保持暂停，正确durable readback使视频恢复。

R7B time crossing、dedupe、backward/forward seek、refresh、single media owner、user pause、autoplay rejection和media error全部回归通过。新测试额外证明submit receipt不能越过readback，旧generation返回不会resume新视频或改变新layout。

## 17 Runtime Facts

继续使用只读 `lesson-runtime-facts/1` seam，增加attempt summary与v2 durable evidence。公开Activity alias在完成后仍可读取，future Lesson Tool可以看到completion、phase、allowed presentation actions以及证据freshness。

facts没有response、正确答案、grader config或原始student identity，也不提供控制方法。video position仍明确为client observation；content revision、attempt sequence和client generation分开。

未注册Agent Tool或Skill，未调用Provider。

## 18 R7B Regression

131/131测试通过，0 failure、0 skip；保留R7B基线108项覆盖，增加1项独立readback回归和22项R7C测试计数。

覆盖：合法existing-schema binding、私有答案、正确/错误durable attempt、COMPLETED/INCOMPLETE/UNKNOWN、丢response两种commit结果、重复request/callback、service restart completed/waiting、refresh、correct-resume / wrong-unknown-hold、stale generation、facts、泄漏扫描及R7B seek/dedupe/media。

测试按事件、状态条件、显式Promise和新DB读取等待；没有用固定sleep证明业务状态。短startup轮询只用于PostgreSQL就绪。

## 19 Frozen Content Protection

开始及结束均通过独立READ ONLY验证R6F baseline。canonical chain、catalog lesson、textbook/version/chapter/module/Teaching Lesson、script version row、8个node完整行hash及4条objective map精确一致。

Frozen Node Writes=0；Script Version Writes=0；Learning Objective Writes=0。当前目标仍为1 Draft / 8 nodes，execution node与Activity仍0。R6D/R6E/R6F及R7B历史报告/evidence未修改。

## 20 Agent / Provider Boundary

Agent五表仍0；本阶段Agent Run0、Provider请求0、Pins写入0、Definition publication0、Publish0。Feature OFF、allowlists EMPTY、StudentPolicy未修改。

测试只调用本地现有grader与隔离PostgreSQL；不调用旧Learning Agent responder/Edge function，不建立AI fallback。Stage1G NOT READY。

## 21 Production End-State

最终READ ONLY复核PASS：ledger457、latest202609140007、Build6IhDHN8Dm1nCewiCEZnV5、PM2 PID/restart、runtime/launcher/Tailscale hash、schema/RLS/FK/function hash、非目标内容metadata fingerprint均与before一致。

Current DB business writes0；Auth0；migration0；deploy0；生产PM2/runtime/launcher/Tailscale mutation0。隔离schema bootstrap和synthetic FK rows不属于当前DB迁移或真实Auth用户创建。

最终完整suite的3个隔离DB共有20份单Activity scenario fixture，20个execution node、20个Activity、20条private answer、16条attempt、13个progress row、3次progress更新；每份fixture仅1题。另有开发调试用fresh fixture运行。所有owned test容器均在验证后清理；不清理当前教材或legacy对象。

初轮额外test-only prompt UPDATE1已单独记录。精确范围与safe row ledger见db-write-boundary.json。

本地隔离Next build和TypeScript PASS，7个本阶段产品文件lint0；重查原scope仍是3条既有错误、2条既有warning，没有新增lint问题。

## 22 Gate Matrix

| Gate | Result | Scope / note |
|---|---|---|
| G-R7C-1 R7B Conditional Input Accepted | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-2 R6F Freeze Verified | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-3 Activity Domain Audited | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-4 Write Authorization | PARTIAL | 审批范围偏差见第5节 |
| G-R7C-5 Official Activity Binding | PARTIAL | 隔离绑定PASS；当前canonical官方绑定未执行 |
| G-R7C-6 Existing Activity System Reused | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-7 Existing Progress System Reused | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-8 No New Activity Schema | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-9 No New Progress Schema | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-10 Public Prompt Safe | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-11 Private Answer Isolated | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-12 Existing Grader Reused | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-13 Durable Correct Attempt | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-14 Durable Wrong Attempt | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-15 Durable Progress | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-16 Completion Authority Durable | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-17 Independent Readback | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-18 COMPLETED Receipt | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-19 INCOMPLETE Receipt | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-20 UNKNOWN Receipt | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-21 Lost Response Safe | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-22 No Blind Retry | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-23 Idempotency | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-24 Restart Completed Restores | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-25 Restart Waiting Restores | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-26 Correct Completion Resumes | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-27 Wrong Answer Holds | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-28 UNKNOWN Holds | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-29 Runtime Facts Durable Evidence | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-30 Runtime Facts No Answer Leak | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-31 R7B Cue Dedupe Regression | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-32 R7B Seek Regression | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-33 R7B Refresh Regression | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-34 R7B Stale Generation Regression | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-35 Native Video Regression | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-36 Mock Cue Still Fixture Only | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-37 Frozen Script Unchanged | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-38 Script Version Unchanged | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-39 Node Writes Zero | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-40 No Publish | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-41 No Agent Run | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-42 No Provider | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-43 Feature OFF | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-44 Allowlists EMPTY | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-45 No Migration Unless Separately Approved | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-46 No Legacy Fallback | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-47 New Lint Errors Zero | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-48 Build Pass | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-49 Tests Pass | PASS | 当前DB只读或隔离验证；非published student E2E |
| G-R7C-50 Evidence Boundary | PASS | 当前DB只读或隔离验证；非published student E2E |

## 23 Remaining Agent Execution Gap

当前canonical Activity还没有正式authoring入口与父链创建；当前运行DB没有合法durable测试scope/admission绑定。本次授权只覆盖隔离数据库，不能将其签为当前DB正式绑定验证。

还需在新的精确批准范围下完成当前canonical Activity创建/绑定、受控current-DB execution context及正式transport的durable验证，继续尊重Draft/published-only边界。现有Supabase HTTP裸RPC接口不提供本次transaction seam的全部幂等保证，部署前必须明确受控transaction transport；不能静默退回旧fallback。

本阶段不为此新增migration或偷偷接生产入口。

## 24 Next Stage

Execution Status: **DURABLE BINDING LIMITATION**。

先补足当前canonical官方Activity / durable binding验证，再考虑R7D — LESSON TOOL & TEACHING AGENT EXECUTION BINDING。当前不开始R7D，不运行Agent/Provider，不进入Stage1G。

## 25 Final Recommendation

按已批准的隔离范围，durable execution合同已完成并验证，整体签 **CONDITIONAL**。可以复用这套测试和readback seam继续补当前canonical binding；不能声称Production Student E2E或当前DB durable binding已通过。

保持Frozen Script和Feature/allowlist边界。当前停止，不自动扩展到生产Activity authoring、Agent binding、Publish或legacy清理。

