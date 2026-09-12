import 'server-only';
import { studentTask, visualCue, teacherScriptSegments, type ScriptNodeRow } from '../../../lib/learning-agent-script-runtime';
import { teachingBlackboardDisplayForSegment, type TeachingBlackboardDisplay } from '../../../lib/teaching-blackboard';
import type { AuditSource } from './audit-source.server';
import type { TeacherTargetRequirement } from '../core/teacher-readiness';

/** Read-only inventory, not an executor. In particular, the old terminal
 * focus_activity action must not disappear just because it isn't visualCue JSON. */
export function teacherSourceInventory(data: AuditSource) {
  const m = data.result.manifest;
  const blocks = m.blocks.filter(b => b.type === 'compat.teacher.v1');
  const requirements: TeacherTargetRequirement[] = [], unsupported: string[] = [];
  const nodes = blocks.flatMap(block => {
    const binding = data.result.bindings.teaching.find(t => t.ref === block.props.teachingRef);
    if (!binding) { unsupported.push(`binding:${block.id}`); return []; }
    return data.source.teachingNodes.filter(n => n.script_version_id === binding.scriptVersionId)
      .sort((a, b) => a.sort_order - b.sort_order).map(raw => {
        const n = raw as ScriptNodeRow;
        const task = studentTask(n.configuration), visual = visualCue(n.configuration);
        const alias = (key: unknown) => data.result.bindings.aliases.find(a => a.moduleId === block.stepId && a.legacyKey === key)?.target;
        const add = (source: string, target: string | undefined, commands: TeacherTargetRequirement['commands']) => {
          if (!target) { unsupported.push(source); return; }
          requirements.push({ source, snapshotId: m.snapshot.id, stepId: block.stepId, target, commands });
        };
        if (visual?.targetKey) add(`${n.node_key}:visualCue`, alias(visual.targetKey), ['reveal', 'highlight']);
        if (task?.targetKey) {
          if (task.kind !== 'play_expression_audio' || task.eventType !== 'audio_completed') unsupported.push(`${n.node_key}:studentTask.kind`);
          add(`${n.node_key}:studentTask`, alias(task.targetKey), ['reveal', 'focus', 'play']);
        }
        if (n.action_type === 'focus_activity') {
          const activity = m.blocks.find(b => b.type === 'multiple_choice' &&
            data.result.bindings.activities.some(a => a.activityId === n.reference_activity_id && a.ref === b.props.activityRef));
          add(`${n.node_key}:focus_activity`, m.runtimeTargets.find(t => t.blockId === activity?.id && !t.partId)?.id, ['reveal', 'focus']);
        } else if (n.action_type !== 'none' && !(n.action_type === 'play_expression' && task?.kind === 'play_expression_audio')) {
          unsupported.push(`${n.node_key}:action_type`);
        }
        const segments = teacherScriptSegments(n, 'zh-CN');
        const blackboardTypes = [...new Set(segments.flatMap((_, index) => {
          const display = teachingBlackboardDisplayForSegment(n.configuration?.display, index) as TeachingBlackboardDisplay | undefined;
          return display?.activeSlide?.elements.map(e => e.type) ?? [];
        }))];
        return { key: n.node_key, type: n.node_type, order: n.sort_order, stepId: block.stepId,
          revision: binding.scriptVersionId, segments: segments.length, blackboardTypes,
          next: n.next_node_key, remediation: n.remediation_node_key,
          taskRequired: task?.required === true, terminal: n.configuration?.terminal === true,
          action: n.action_type };
      });
  });
  return { snapshotId: m.snapshot.id, sourceRevision: data.result.report.sourceRevision, nodes, requirements, unsupported };
}
