// B3A executable DESIGN reference, isolated test imports only. No issuer,
// current-DB transport, Auth client, progress store or production composition.
export const budget=Object.freeze({attemptInsert:2,attemptUpdate:0,nodeInsert:1,nodeUpdate:1,pageWrites:0,otherWrites:0});
const keys=['environment','database','actor','tenant','lesson','activity','version','freeze','scenarioId','snapshot'];
export function admit(scope,facts,expected,now,{generation,slot,requestId},journal){
 if(scope.state!=='ACTIVE'||scope.issuedAt>now||scope.expiresAt<=now||scope.expiresAt-scope.issuedAt>15*60_000)throw Error('SCOPE_DISABLED_OR_EXPIRED');
 for(const key of keys)if(scope[key]!==expected[key]||facts[key]!==expected[key])throw Error('SCOPE_BINDING');
 if(!facts.ownerAuthorized||!facts.explicitDevelopmentConfig||facts.productionComposition||facts.observedAt>now||now-facts.observedAt>5000)throw Error('SCOPE_AUTHORIZATION');
 if(!facts.banned||facts.banUntil<=scope.expiresAt+24*60*60_000||facts.sessions!==0||facts.refresh!==0||facts.profile!=='inactive'||facts.membership!=='suspended'||facts.role!=='student'||facts.isDefault)throw Error('ACTOR_UNSAFE');
 if(JSON.stringify(scope.budget)!==JSON.stringify(budget)||generation!==facts.generation||!['first','second'].includes(slot)||!requestId)throw Error('WRITE_BUDGET_OR_GENERATION');
 // Counts and completion here are fresh authoritative repository observations,
 // never progress truth copied into the scope/journal.
 if(facts.completed||facts.attempts!==(slot==='first'?0:1))throw Error('DURABLE_BASELINE');
 if(journal.has(slot)||journal.has(requestId))throw Error('DISPATCH_ALREADY_CLAIMED');
 return {slot,requestId};
}
export function claim(scope,facts,expected,now,request,journal){
 const reservation=admit(scope,facts,expected,now,request,journal);
 // Reference for the later fsync/exclusive transaction lease, not a production
 // concurrency implementation. Claim before dispatch and retain after UNKNOWN.
 journal.add(reservation.slot);journal.add(reservation.requestId);return reservation;
}
