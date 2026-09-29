import type { AgentRequest, RuntimeEvent } from '../../../src/features/agent-core/index.ts';
// @ts-expect-error Server authority must not be in the browser barrel.
import type { RunAuthority } from '../../../src/features/agent-core/index.ts';
// @ts-expect-error Secret config must not be in the browser barrel.
import type { DeepSeekServerConfig } from '../../../src/features/agent-core/index.ts';
// @ts-expect-error Executor internals must not be in the browser barrel.
import type { ToolExecutionContext } from '../../../src/features/agent-core/index.ts';
const request: AgentRequest = {protocolVersion:1, agentCode:'test-agent', idempotencyKey:'test-key', message:'synthetic', scope:{kind:'user_global'},
  // @ts-expect-error Browser identity cannot become trusted authority.
  tenantId:'forged',
};
const event: RuntimeEvent = {protocolVersion:1,runId:'test-run',seq:1,at:'test',type:'answer.delta',text:'synthetic'};
void request; void event;
export type BoundaryAssertions = [RunAuthority, DeepSeekServerConfig, ToolExecutionContext];
