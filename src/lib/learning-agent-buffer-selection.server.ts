import 'server-only';
import { createHash } from 'node:crypto';
import { learningAgentBufferPresetForText, type BufferPresetLocale } from './learning-agent-buffer-presets.ts';

export const BUFFER_CANDIDATE_COLUMNS = 'id,script_node_id,locale,segment_index,content_hash,production_status';
export type BufferCandidate = {
  id: string; script_node_id: string; locale: string; segment_index: number;
  content_hash: string; production_status: string;
};
export type BufferNode = { id: string; scriptVersionId: string; configuration: { bufferLine?: unknown; bufferPresetId?: unknown } | null };
export type BufferVersion = { id: string; status: string };
export type BufferSelection = {
  expectedText: string; expectedTextHash: string; rejectedCandidateIds: string[]; reason: string;
} & (
  | { kind: 'preset'; selectedSpeechAssetId: string; presetId: string }
  | { kind: 'verified-asset'; selectedSpeechAssetId: string; presetId: null }
  | { kind: 'existing-browser-tts-fallback' | 'silent' | 'unsupported'; selectedSpeechAssetId: null; presetId: null }
);

// Match existing configuredText + preset trim semantics. No Unicode/whitespace rewriting.
export function normalizedBufferText(node: BufferNode, locale: BufferPresetLocale): string {
  const value = node.configuration?.bufferLine;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as { 'zh-CN'?: unknown; 'ko-KR'?: unknown };
  return String(record[locale] ?? record['zh-CN'] ?? '').trim();
}
export const bufferTextHash = (text: string) => createHash('sha256').update(text.trim(), 'utf8').digest('hex');

/** Server policy only: version/node are server-read FK context, not client claims.
 * Assets have no version column; their script_node_id FK binds the verified node/version.
 * Does not authorize requests, sign media, alter sessions or write progress.
 */
export function selectBufferSpeech(input: {
  version: BufferVersion; node: BufferNode; locale: BufferPresetLocale;
  candidates: readonly BufferCandidate[]; expectedText?: string;
  audience?: 'published' | 'authorized-owner-preview';
}): BufferSelection {
  const { node, version, locale, candidates } = input;
  const text = normalizedBufferText(node, locale), hash = bufferTextHash(text);
  const valid = candidates.filter(a => a.script_node_id === node.id && a.locale === locale
    && a.segment_index === 199 && a.production_status === 'ready' && a.content_hash === hash);
  const rejectedCandidateIds = candidates.map(a => a.id).sort();
  const base = { expectedText: text, expectedTextHash: hash, rejectedCandidateIds };
  const none = (kind: 'silent' | 'unsupported' | 'existing-browser-tts-fallback', reason: string): BufferSelection => ({ ...base, kind, reason, selectedSpeechAssetId: null, presetId: null });
  if (!node.id || !version.id || node.scriptVersionId !== version.id
    || (version.status !== 'published' && !(input.audience === 'authorized-owner-preview' && ['draft', 'archived'].includes(version.status))))
    return none('unsupported', 'Unverified script version/node scope');
  if (input.expectedText !== undefined && input.expectedText.trim() !== text)
    return none('unsupported', 'Requested text differs from configured buffer');
  if (!text) return none('silent', 'Existing empty buffer: do not start playback');
  const preset = learningAgentBufferPresetForText(locale, text);
  const configuredPreset = node.configuration?.bufferPresetId;
  if (configuredPreset != null && configuredPreset !== '' && configuredPreset !== preset?.id)
    return none('existing-browser-tts-fallback', 'Preset/text conflict: reject preset and asset; existing TTS/text path');
  if (preset) return { ...base, kind: 'preset', presetId: preset.id, selectedSpeechAssetId: `buffer-preset:${preset.id}:${locale}`, reason: 'Existing exact-text preset has priority over candidate assets' };
  if (valid.length > 1) return none('unsupported', 'Ambiguous exact buffer assets');
  if (valid.length === 1) return { ...base, rejectedCandidateIds: rejectedCandidateIds.filter(id => id !== valid[0].id), kind: 'verified-asset', presetId: null, selectedSpeechAssetId: valid[0].id, reason: 'Version/node/locale/segment/status/normalized text hash verified' };
  return none('existing-browser-tts-fallback', 'No valid asset or preset: existing null-ID TTS/text path');
}

/** Batched loader projection: DB rows are candidates, never public selected IDs. */
export function selectBufferSpeechIds(nodes: readonly BufferNode[], versions: readonly BufferVersion[], candidates: readonly BufferCandidate[], audience: 'published' | 'authorized-owner-preview' = 'published') {
  const result = new Map<string, Partial<Record<BufferPresetLocale, string>>>();
  for (const node of nodes) {
    const version = versions.find(v => v.id === node.scriptVersionId);
    const ids: Partial<Record<BufferPresetLocale, string>> = {};
    if (version) for (const locale of ['zh-CN', 'ko-KR'] as const) {
      const selection = selectBufferSpeech({ node, version, locale, audience,
        candidates: candidates.filter(a => a.script_node_id === node.id && a.locale === locale) });
      if (selection.selectedSpeechAssetId) ids[locale] = selection.selectedSpeechAssetId;
    }
    result.set(node.id, ids);
  }
  return result;
}
