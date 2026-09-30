# TASK — Bounded current-test local revalidation packet
## Identity
TASK ID: SESSION-LOCAL-REVALIDATION-PREP-01
STATUS: SPECIFIED
## Routing
IMPLEMENTATION PROFILE: worker_high (GPT-6 Sol high)
VERIFICATION PROFILE: verifier (GPT-6 Sol high)
ARCHITECT GATE: separateSESSION-CONTEXT-TRANSITION-GATE-01 ownsformaladmission; nochangehere
MODEL ROUTING REASON: Assemble concretefinite test selection/argv/resources/cleanup withoutrepeatingpriorobservererrors
DISPATCH RECORD REQUIRED:YES
## Objective
Prepare a concrete reviewable one-run local30SESSION-focused revalidation packet forcurrentfixedtest, noexecution. Avoidextradiagnosticrun iforiginaltestsprovide evidence. Full915revalidationcomesonlyafterfocusedresults; do notrunorprepareunneededfullrepeatnow.
## Scope
WRITE newprivate/tmp/session-local-revalidation-prep-* only. READ currenttest/source/dependencies, previousactualtestselection/driverreports and constraints onlyasneeded.
## Requirements
1. Recoverexact30 currentSESSIONIDs/class/testframework and runtime-owningmethods. Closedfixtures/keyfix/testassertionsmustremainunchanged. Planonefreshprocess executingall30once, no retry. Ifprerequisitefirstfixturefails, retainactualerrorandcleanup; don'tturn itintoanothertrial. Explain unittestsubtest/setup behavior andresourceupperbounds fromactualcalls.
2. Preferoriginalrepositorytestentrypoint/unittestselection withnoninvasiveresultlogging. Drivermustnotpatchoperationalsubprocess/safe_file/fixtures/helpers/envsemantics. Keepactualtestdefinedmocks. Exactstdout/stderr/status/resultsperID, noobserverthatcanchangeassertions. Rawsecretslocalprivateonly/publicsafehashedcodes.
3. No old retainedcontainer query/removal. Localcachedpinnedimagesonly,nopull; provenownershipcleanupviaoriginalfixture, read-onlydockerimageinspectallowedONLY futureapprovedexecution, notnow. SourcePG1GiBpooler2GiBrolesclient512MiBstockclient512MiB fromsource; deriveactualmaxsimultaneouscontainers/network/hostports/mounts/timebudget, don'tguess. Finitetimeoutsand cleanupbudget, resourceslabels/directcreationproof, neverremoveunknowncontainer.
4. Determine exactlywhetherlocalfocusedtestsneedcanonicalI/Brefreshorcanrunfromcurrenttestwitholdformalqualificationpending. Noeditingreceiptsormockingadmission toforcegreen. CoordinatefactswithGateagent(session_context_transition_gate). Ifpacketcan'tbelaunchedwithoutcontractdecision, prepare everythingindependent andmarkexactgate.
5. Bind currenttest/source17/main10/nativeoutputs/fixtureconfigs/runnerinterpreter andexact30selection inprivatePacket.json, exactcommandandfreshrunoutputdir. Ensure no symlinkELOOP repetition:bindinterpreteralias+resolvedregularactualfile ifneeded, reuseclosedcompatdesign withoutbroadnewobserver.
6. Write launchcodeonlyifmeaningfullyneeded tosaveoutputs/results; no replacementtests orresearchshim. Dryvalidation AST/static +purepacketchecks permitted, NO testmoduleimport/fixtures/Docker/processrun. Avoidbuildingcomplexauditor forunobservablecounters; markNOT_OBSERVABLE.
7. PacketmustclearlyNONQUALIFYING_LOCAL_FOCUSED_REVALIDATION unlessrealformalcontractadmits; neverV/completion/authorityartifact. ExactruntimeauthorizationNOT_CONSUMED, nochanges/newrununtilSupervisorapprovedconcretepacketanduserauthorizationasrequired.
## Acceptance
Reviewablefiniteone-runpacketwithexactcommand, selection, bounds,inputhashes,safeoutputandcleanup,noexecutedruntime. Noinventedcounts, nofallback/automaticretry. Existingpreparationchecksnotrerun.
## Validation
Static/syntax/privatepurepacketchecks only. No tests/fixtureimports/runtime. Reportconcreteblockedpieces rather thanbuildmoreinfrastructure.
## Parallelism
YES withGate, privateoutputsnonoverlap; no sourcewriter.
## Escalation
Source/contract/publicationneeded =>report, nochanges. Runtimebudgetunbounded =>stopandreportactualreason.

## Frozen Context
Currenttest tests/teaching_agent_source_provenance_acquisition_test.py SHA33416171a335aab3b6934a5b410086c48ae161a216f39e1827430b6c3c52ce90. Fix WorkerReport /tmp/session-bounded-test-fix-_22w6fix/WorkerReport.md SHA8beb73873918e73705323f4726577c8f002c10148b444e157f8118bc9753518d; verifier /tmp/session-bounded-test-fix-verify-gusss0ai/VerificationReport.md SHAb28d9ed7031c2615f38a6a9d717d38f89089e621c96d53369835f69d4be0db50. ClosedpreparationPASS only; don'tredo.
State /tmp/session-revalidation-state-v_jns_f3/WorkerReport.md SHAe6c525eaac72c688e50f5bc23ab9320015996c327211716c9b423b846177633d.
Current I docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-session-source-acquisition-implementation.json SHA8398500483ff770c8e8e70f01bb5acd14c2f2062073bbd684c931890648bb6d1 bytes11148; B r7d-c3b-session-roles-exporter-build-receipt.json SHAe5a9f9b73a094e65be501591f46778803422086e35eb923dbcf6ab262546f852 bytes9487. Botholdtest3b9bf9205fc71422643889adece6f425ee51ea74055920f098bd38b529d073fb, contextdoc6cc29943403ef7ec3eb5a46c72ec05ad5a381b43fb87da493a3cdd0765972d3e. Source17/main10/nativeinputs/BUILToutputsunchanged. Prior /tmp/session-context2-binding-design-review-gj38acxe/review-proof.json SHAcbb3a41e4efde928272d069e9172ba13cd0540fb520097c9446baaa7f40c8d7e hasearlierone-timearchive/rebindexception, NOT reusableauthorization.
UseractualnonsecretHost aws-1-ap-northeast-2.pooler.supabase.com, User postgres.jubdbsjsalpecfvseskz, project jubdbsjsalpecfvseskz verifiedoffline. No missinguserinfo and no runtime/productionauthorization from thisdata.
## Common Boundaries
No repo/source/test/schema/design/evidence/I/B/authority/completion/lock edits or publication; no env/credentials/privateproductionapprovalreads, sensitiveapproval-b2-provisioning.before-initial-ban-workflow.json; noDockerincludinginspect, DB/SQL/network/fixtureimports/tests/builds/gitmutation; nooldretainedcontainerquery. Newprivate/tmp only. No purchasedservices. Do not repeat915tests, fixedrelease research or closedforensics. Youarenotalone; dorevert nothing.
## Report
Use applicable CODEX_WORKER/CODEX_VERIFICATION reporting, exactinputs/commands/rc/outputsSHA/counters/remaininglimitations. SupervisorhandlesTaskmetadata. UnknownNOT_VALIDATED; nofakePASS.
