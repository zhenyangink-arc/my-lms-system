// Public DTO only; locators are not authority. Pins originate in the server projection.
export interface PublicSelectionPin {
 lessonId: string; moduleId: string; scriptVersionId: string; nodeId: string;
 segmentIndex: number; locale: 'zh-CN' | 'ko-KR'; expectedRevision: string;
 segmentRef: string; displayText: string;
}
export function selectionIdentity(pin: PublicSelectionPin) {
 return [pin.lessonId, pin.moduleId, pin.scriptVersionId, pin.nodeId, pin.segmentIndex, pin.locale, pin.expectedRevision, pin.segmentRef].join('|');
}
export function explainRequest(pin: PublicSelectionPin, idempotencyKey: string) {
 // Deliberate field projection: display text never becomes request content/authority.
 const selection = { lessonId: pin.lessonId, moduleId: pin.moduleId, scriptVersionId: pin.scriptVersionId,
  nodeId: pin.nodeId, segmentIndex: pin.segmentIndex, locale: pin.locale,
  expectedRevision: pin.expectedRevision, segmentRef: pin.segmentRef };
 return { protocolVersion: 1, agentCode: 'student-ai-teacher', intent: 'explain_segment', idempotencyKey,
  message: '请解释这句话。', scope: { kind: 'lesson', lessonId: pin.lessonId, moduleId: pin.moduleId }, selection };
}
