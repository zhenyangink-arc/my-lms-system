import 'server-only';
import type { RuntimeExecutionContext } from '../../../agent-core/contracts/server.ts';
import type { StudentSelectionLocator, StudentTeachingScope } from '../selection/selection-types.ts';

/** Supplied only by getAuthContext (or a synthetic fixture), never request JSON. */
export interface StudentAuthIdentity { actorId: string; tenantId: string }
export type StudentAuthentication = () => Promise<StudentAuthIdentity | null>;
export interface PublishedNode {
  id: string; versionId: string; updatedAt: string;
  script: Partial<Record<'zh-CN' | 'ko-KR', string>>;
  segments: unknown; videoMode: 'video' | 'legacy';
}
export interface StudentContentRecord {
  scope: StudentTeachingScope;
  lessonTitle: string; moduleTitle: string; objectives: string[];
  scriptVersionNumber: number;
  /** Digest input is internal; it contains only the selected graph's safe fields. */
  revisionParts: unknown[];
  node: PublishedNode | null;
}
export interface SavedTeachingState {
  id: string; scriptVersionId: string | null; nodeId: string | null;
  segmentNodeId: string | null; segmentIndex: number | null;
  phaseNodeId: string | null; phase: string | null;
  status: 'active'; updatedAt: string;
}
/** No mutation, generic client, arbitrary student ID or arbitrary table surface. */
export interface StudentTeachingReadRepository {
  readAuthorizedContent(identity: StudentAuthIdentity, locator: StudentSelectionLocator,
    execution: RuntimeExecutionContext): Promise<StudentContentRecord | null>;
  readOwnSession(scope: StudentTeachingScope, execution: RuntimeExecutionContext): Promise<SavedTeachingState | null>;
  readPublishedNode(scope: StudentTeachingScope, nodeId: string,
    execution: RuntimeExecutionContext): Promise<PublishedNode | null>;
}

/** Production snapshot read is bound to an already-issued Student authority.
 * No model locator, mutable repository, database client or provenance parameter. */
export interface PublishedLessonFactsReader {
 read(scope:StudentTeachingScope,context:import('../../../agent-core/contracts/tool.ts').ToolExecutionContext):Promise<import('../../../smart-textbook-runtime/server/published-native-activity-read.server.ts').PublishedReadSnapshot>;
}
