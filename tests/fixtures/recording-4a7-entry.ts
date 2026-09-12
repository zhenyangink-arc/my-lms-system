// Single bundled server module preserves the request-local context in rehearsal.
export * from '../../src/lib/recording-domain.server';
export * from '../../src/lib/recording-domain-gateway.server';
export * from '../../src/lib/recording-evidence-v2.server';
export { GET, POST, DELETE } from '../../src/app/api/digital-textbook/recordings/[activityId]/route';
export { completeDialogueRoleplayAction, saveGuidedRepeatProgressAction } from '../../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-actions';
export { submitSmartTextbookActivityForContext } from '../../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission';
export {productionRecordingServices} from '../../src/features/smart-textbook-runtime/server/recording-production.server';
export {recordingPlans} from '../../src/features/smart-textbook-runtime/server/recording-binding.server';
