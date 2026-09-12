import assert from "node:assert/strict";
import test from "node:test";
import { buildInsightReport, emptyFacts, parseInsightFilters, formatHours } from "../src/features/platform-learning-insights/model.ts";

const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-09-08T03:00:00Z");
const filters = parseInsightFilters({ days: "7" }, now);
const at = "2026-09-07T03:00:00Z";
function facts() { return { ...emptyFacts(), tenants: [a,b].map((id,index) => ({id,name:`机构${index}`,slug:`tenant-${index}`,status:"active"})) }; }
function event(tenant_id, student_id, extra = {}) { return { tenant_id, student_id, event_type: "conversation_practiced", source_id: "scene-1", duration_seconds: 0, occurred_at: at, ...extra }; }

test("time and tenant filters reject arbitrary expressions and use bounded comparison windows", () => {
 const value = parseInsightFilters({days:"100000",tenant:"x),id.gt.0",source:"invalid"},now);
 assert.equal(value.days,30);assert.equal(value.tenant,"");assert.equal(value.source,"all");
 assert.equal(Date.parse(value.start)-Date.parse(value.previousStart),30*86400000);
 assert.equal(parseInsightFilters({days:["90","7"],tenant:a},now).tenant,a);
});
test("one student in multiple scenes counts once while separate institutions remain distinct", () => {
 const data = facts();data.activities=[event(a,"one"),event(a,"one",{source_id:"scene-2"}),event(b,"one")];
 const report=buildInsightReport(data,filters,"conversation");
 assert.equal(report.current.participants,2);assert.equal(report.current.practices,3);assert.equal(report.rows[0].current.participants,1);
});
test("completed scene counts are deduplicated without equating them with unique students", () => {
 const data=facts();data.activities=[event(a,"one",{metadata:{status:"completed"}}),event(a,"one",{metadata:{status:"completed"}}),event(a,"one",{source_id:"scene-2",metadata:{status:"completed"}})];
 const result=buildInsightReport(data,filters,"conversation");assert.equal(result.current.completed,2);assert.equal(result.current.participants,1);
});
test("seconds are aggregated before display rounding across institutions", () => {
 const data=facts();data.activities=[event(a,"one",{event_type:"learning_time_recorded",duration_seconds:179}),event(b,"two",{event_type:"learning_time_recorded",duration_seconds:179})];
 const result=buildInsightReport(data,filters,"records");assert.equal(result.current.seconds,358);assert.equal(formatHours(result.current.seconds),"0.1");
});
test("missing scores are null, while a real zero remains a failed score", () => {
 const data=facts();assert.equal(buildInsightReport(data,filters,"grades").current.average,null);
 data.grades=[{tenant_id:a,student_id:"one",source:"chapter",sourceId:"test",at,score:0,passed:false}];
 const result=buildInsightReport(data,filters,"grades");assert.equal(result.current.average,0);assert.equal(result.current.passRate,0);assert.deepEqual(result.current.distribution,[1,0,0,0]);
});
test("retries use latest score per student and source, comparison periods are independent", () => {
 const data=facts();const grade={tenant_id:a,student_id:"one",source:"chapter",sourceId:"test",at,score:90,passed:true};
 data.grades=[{...grade,at:"2026-09-06T00:00:00Z",score:30,passed:false},grade,{...grade,at:"2026-08-29T00:00:00Z",score:50,passed:false}];
 const result=buildInsightReport(data,filters,"grades");assert.equal(result.current.samples,1);assert.equal(result.current.average,90);assert.equal(result.previous.average,50);
});
test("all grades are weighted by results rather than institution means and source filters apply", () => {
 const data=facts();data.grades=[{tenant_id:a,student_id:"a",source:"exam",sourceId:"exam",at,score:100,passed:true},{tenant_id:b,student_id:"b",source:"homework",sourceId:"hw",at,score:0,passed:false},{tenant_id:b,student_id:"c",source:"homework",sourceId:"hw",at,score:50,passed:false}];
 assert.equal(buildInsightReport(data,filters,"grades").current.average,50);
 assert.equal(buildInsightReport(data,{...filters,source:"exam"},"grades").current.average,100);
});
test("inactive students use current enrollment and teacher grading does not mark them active", () => {
 const data=facts();data.enrollments=[{tenant_id:a,student_id:"one"},{tenant_id:a,student_id:"two"}];data.activities=[event(a,"one",{event_type:"assignment_graded"}),event(a,"two",{event_type:"lesson_completed"})];
 const result=buildInsightReport(data,filters,"records");assert.equal(result.current.inactive,1);assert.equal(result.current.participants,1);assert.equal(result.current.completed,1);
});
test("tenant filter excludes every foreign fact and empty registered institutions remain visible", () => {
 const data=facts();data.activities=[event(b,"foreign")];data.skills=[{tenant_id:b,skill:"reading",earned_points:5,total_points:10,question_count:1}];
 const result=buildInsightReport(data,{...filters,tenant:a},"conversation");assert.equal(result.rows.length,1);assert.equal(result.current.practices,0);assert.equal(result.skills[2].value,null);
});
test("current attention includes old active notes but not archived ones", () => {
 const data=facts();data.notes=[{tenant_id:a,student_id:"one",record_type:"attention",status:"active",occurred_at:"2026-01-01T00:00:00Z"},{tenant_id:a,student_id:"two",record_type:"attention",status:"archived",occurred_at:at}];
 const result=buildInsightReport(data,filters,"records");assert.equal(result.current.attention,1);assert.equal(result.current.notes,1);
});
test("unfinished classroom state is separate from current-period openings", () => {
 const data=facts();data.classrooms=[{tenant_id:a,status:"active",mode:"group",created_at:"2026-01-01T00:00:00Z",ended_at:null},{tenant_id:a,status:"ended",mode:"one_on_one",created_at:at,ended_at:at}];
 const result=buildInsightReport(data,filters,"conversation");assert.equal(result.current.classes,1);assert.equal(result.current.activeClasses,1);assert.equal(result.current.endedClasses,1);
});
test("skills aggregate earned points instead of averaging percentages", () => {
 const data=facts();data.skills=[{tenant_id:a,skill:"reading",earned_points:10,total_points:10,question_count:1},{tenant_id:b,skill:"reading",earned_points:0,total_points:90,question_count:9}];
 const result=buildInsightReport(data,filters,"grades");assert.equal(result.skills[2].value,10);assert.equal(result.skills[2].evidenceCount,10);assert.equal(result.skills[0].value,null);
});
test("half-open date ranges count a boundary fact in only one period", () => {
 const data=facts();data.activities=[event(a,"one",{occurred_at:filters.start}),event(a,"two",{occurred_at:filters.end})];
 const result=buildInsightReport(data,filters,"conversation");assert.equal(result.current.practices,1);assert.equal(result.previous.practices,0);
});

test("platform shared scenarios count once globally and remain available for a selected institution", () => {
 const data=facts();data.scenarios=[{tenant_id:null,status:"published"},{tenant_id:a,status:"draft"},{tenant_id:b,status:"published"}];
 const all=buildInsightReport(data,filters,"conversation");assert.equal(all.current.scenarios,3);assert.equal(all.rows[0].current.scenarios,2);assert.equal(all.rows[1].current.scenarios,2);
 const selected=buildInsightReport(data,{...filters,tenant:a},"conversation");assert.equal(selected.current.scenarios,2);assert.equal(selected.current.publishedScenarios,1);
});

test("course filtering accepts only a UUID and rejects query expressions", () => {
 assert.equal(parseInsightFilters({course:a},now).course,a);
 assert.equal(parseInsightFilters({course:'x),id.gt.0'},now).course,'');
 assert.equal(parseInsightFilters({course:[b,a]},now).course,b);
});

test("institution signals require sufficient samples and do not flag small cohorts", async () => {
 const {institutionSignals,emptyMetrics}=await import('../src/features/platform-learning-insights/model.ts');
 const row={tenant:facts().tenants[0],current:{...emptyMetrics(),samples:9,average:40,students:4,inactive:4},previous:{...emptyMetrics(),samples:10,average:80}};
 assert.equal(institutionSignals(row,'grades').length,0);
 assert.equal(institutionSignals(row,'records').length,0);
 row.current.samples=10;assert.equal(institutionSignals(row,'grades')[0].key,'grade_drop');
 row.current.students=8;assert.equal(institutionSignals(row,'records')[0].key,'low_activity');
 row.current.attention=1;assert.equal(institutionSignals(row,'records').length,2);
});
