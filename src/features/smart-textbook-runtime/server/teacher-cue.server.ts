import 'server-only';
import { resolveScriptCharacter, scriptSegmentAutoContinues, configuredText, resolveBufferLineSpeechAssetId, type ScriptNodeRow } from '../../../lib/learning-agent-script-runtime';
import { teachingBlackboardDisplayForSegment, type TeachingBlackboardDisplay } from '../../../lib/teaching-blackboard';
import { teacherSourceInventory } from './teacher-inventory.server';
import type { AuditSource } from './audit-source.server';
import type { PreviewState } from '../../../lib/learning-agent-preview-state';
import type { TeacherTurn, TeacherIntent } from '../core/teacher';
import type { TeacherRuntimeCue } from '../core/teacher-runtime';

export async function projectTeacherCue(data: AuditSource, previous: PreviewState, next: PreviewState, turn: TeacherTurn, intent: TeacherIntent, locale: 'zh-CN' | 'ko-KR') {
  const node = data.source.teachingNodes.find(n => n.node_key === next.currentNodeKey) as ScriptNodeRow | undefined;
  if (!node || node.script_version_id !== next.scriptVersionId) throw Error('TEACHER_CUE_REVISION');
  const segment = Number(next.teachingState.scriptSegmentIndex) || 0;
  const character = await resolveScriptCharacter(data.admin, node, segment, turn.text, locale);
  const display = teachingBlackboardDisplayForSegment(node.configuration?.display, segment) as TeachingBlackboardDisplay | undefined;
  const elements = display?.activeSlide?.elements ?? [];
  if (elements.some(e => e.type === 'image' || e.type === 'video')) throw Error('TEACHER_REQUIRED_MEDIA_UNSUPPORTED');
  // Existing buffer belongs to an ENTERING node, not its previous caption or an
  // internal adjacent script segment. The unchanged selector validates it.
  const entering = previous.currentNodeKey !== node.node_key;
  const bufferText = entering ? configuredText(node.configuration, 'bufferLine', locale) : '';
  const bufferAssetId = bufferText ? await resolveBufferLineSpeechAssetId(data.admin, node, locale, bufferText) : null;
  const inventory = teacherSourceInventory(data);
  if (inventory.unsupported.length) throw Error('TEACHER_UNMAPPED_SOURCE');
  const commands = inventory.requirements.filter(r => r.source.startsWith(`${node.node_key}:`) &&
    !r.source.endsWith(':studentTask') && (r.source.endsWith(':visualCue') || (intent !== 'answer' && turn.phase !== 'task_feedback')))
    .flatMap(r => r.commands.map(command => ({ source: r.source, target: r.target, command })));
  const presentation: Omit<TeacherRuntimeCue, 'cue' | 'task'> = {
    text: turn.text, phase: turn.phase,
    stage: { character: character ? { pose: character.pose, visible: true, position: character.position,
      x: character.splitCharacterX, y: character.splitCharacterY, scale: character.splitCharacterScale,
      narrowX: character.narrowCharacterX, narrowY: character.narrowCharacterY, narrowScale: character.narrowCharacterScale } : null,
      blackboard: elements.map(e => ({ id: e.id, type: e.type as 'text' | 'bullets' | 'expression', content: e.content, translation: e.translation ?? '',
        x: e.x, y: e.y, width: e.width, height: e.height, fontSize: e.fontSize, fontWeight: e.fontWeight, align: e.align, tone: e.tone })) },
    voice: { enabled: character?.voiceEnabled !== false, locale: character?.voiceLanguage === 'auto' || !character ? locale : character.voiceLanguage, rate: character?.voiceRate ?? 1 },
    speechAvailable: !!turn.speechAssetId, buffer: { text: bufferText, available: !!bufferAssetId }, commands,
    awaitingAnswer: turn.awaitingAnswer, questionOptions: [...turn.questionOptions], terminal: turn.terminal, continueLabel: turn.continueLabel,
    autoContinue: turn.phase === 'explanation' && intent !== 'answer' && !turn.terminal && scriptSegmentAutoContinues(node.configuration, segment),
    answerFeedback: intent === 'answer' ? next.teachingState.answerCorrect === true ? 'correct' : 'retry' : null,
  };
  return { presentation, bufferAssetId };
}
