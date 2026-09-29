import {startHarness} from './server.mjs';
const harness=await startHarness();
console.log(`DEVELOPMENT FIXTURE ONLY: ${harness.url}`);
process.once('SIGINT',async()=>{await harness.close();process.exit(0);});
