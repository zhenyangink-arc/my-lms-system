import 'server-only';
import type { ZodType } from 'zod';
import type { RiskLevel, RunAuthority, RuntimeExecutionContext, VersionRef } from './server.ts';
export type ToolResult<T> =
  | { status: 'ok' | 'partial'; data: T; sourceRefs: string[] }
  | { status: 'stale' | 'not_found_or_not_visible' | 'unavailable'; code: string };
export interface ToolExecutionContext extends RuntimeExecutionContext {
  callId: string; modelCallId: string; skillRunId: string; authority: RunAuthority;
}
export interface ToolDefinition {
  name: string; version: string; description: string; status: 'enabled' | 'disabled'; riskLevel: RiskLevel;
  // Provider schema is descriptive. inputValidator is the executable trust boundary.
  inputSchema: Record<string, unknown>; inputValidator: ZodType; outputValidator: ZodType;
  requiredPermissions: string[]; timeoutMs: number; maxResultBytes: number;
}
export interface ToolExecutor { execute(input: unknown, context: ToolExecutionContext): Promise<ToolResult<unknown>> }
export interface ToolRegistration { definition: ToolDefinition; executor: ToolExecutor }
export interface ToolRegistry { get(ref: VersionRef): ToolRegistration | undefined }
