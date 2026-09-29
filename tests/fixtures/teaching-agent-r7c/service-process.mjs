// Child service for the restart proof; only an owned, network-isolated test DB.
import {connectOwnedDatabase} from './postgres.mjs';
import {createDurableFixture} from './fixture.server.mjs';
import {startHarness} from '../teaching-agent-r7b/server.mjs';
let harness;
process.on('message',async message=>{try{
 if(message.kind==='start'){
  if(harness)throw Error('ALREADY_STARTED');
  const fixture=await createDurableFixture(connectOwnedDatabase(message.database),message.ids);
  harness=await startHarness({fixture,entryPoint:'tests/fixtures/teaching-agent-r7c/browser.tsx',port:message.port??0});
  process.send({kind:'ready',url:harness.url});
 }else if(message.kind==='mode'){harness.fixture.setMode(message.value);process.send({kind:'mode-set'});}
 else if(message.kind==='metrics')process.send({kind:'metrics',value:harness.fixture.metrics});
 else if(message.kind==='stop'){await harness.close();process.exit(0);}
}catch{process.send({kind:'failure',code:'ISOLATED_SERVICE_FAILURE'});}});
