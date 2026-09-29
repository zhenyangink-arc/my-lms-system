import 'server-only';
import type { ModelRef, ProviderCapabilities } from '../../contracts/provider.ts';
export const DEEPSEEK_BASELINE: ModelRef = Object.freeze({ provider: 'deepseek', model: 'deepseek-v4-flash', configVersion: 'deepseek-tools-disabled-v1' });
export function deepSeekCapabilities(model: ModelRef): ProviderCapabilities {
  const verified = model.provider === DEEPSEEK_BASELINE.provider && model.model === DEEPSEEK_BASELINE.model && model.configVersion === DEEPSEEK_BASELINE.configVersion;
  return { supportsStreaming: verified ? 'supported' : 'unverified', supportsTools: verified ? 'supported' : 'unverified', supportsStructuredOutput: 'unverified', supportsVision: 'unverified', supportsAudio: 'unverified' };
}
