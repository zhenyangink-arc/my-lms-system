import 'server-only';
import { z } from 'zod';
import { idSchema,localeSchema } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import { activityResponseSchema } from '../core/activity.ts';
import { pageResponseSchema } from '../core/activity-pages.ts';
import { patternResponseSchema } from '../core/patterns.ts';

const session={sessionId:z.uuid()};
// Manifest references are stable IDs, not necessarily database UUIDs.
export const learningRequest=z.strictObject({...session,capsuleRef:idSchema,locale:localeSchema});
export const submitRequest=z.strictObject({...session,activityRef:idSchema,response:idSchema,locale:localeSchema});
export const turnRequest=z.strictObject({...session,teachingRef:idSchema,generation:z.number().int().nonnegative(),intent:z.enum(['start','ready','hint','example','answer']),answer:z.string().max(300).optional(),locale:localeSchema});
export const cancelRequest=z.strictObject({...session,generation:z.number().int().nonnegative()});
export const ttsIssueRequest=z.strictObject(session);
export const ttsObserveRequest=z.strictObject({...session,grantId:z.uuid()});
export const activitySubmitRequest=z.strictObject({...session,capsuleRef:idSchema,activityRef:idSchema,response:activityResponseSchema,locale:localeSchema});
export const pageCheckRequest=z.strictObject({...session,capsuleRef:idSchema,pageId:idSchema,response:pageResponseSchema,locale:localeSchema});
export const patternCheckRequest=z.strictObject({...session,capsuleRef:idSchema,activityRef:idSchema,response:patternResponseSchema});
