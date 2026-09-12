import 'server-only';
import { z } from 'zod';
const id = z.string().min(1);
const text = z.strictObject({ 'zh-CN': z.string(), 'ko-KR': z.string() });
// Unknown JSON only exists at this untrusted reader boundary, never in Capsule DTOs.
export const legacySourceSchema = z.strictObject({
  textbook: z.strictObject({ id, slug:id, title:text, status:id, student_app_id:id }),
  version: z.strictObject({ id, textbook_id:id, version_number:z.number().int(), status:id }),
  chapter: z.strictObject({ id, version_id:id, slug:id, chapter_number:z.number().int(), title:text, scenario:text, goal:text, status:id }),
  modules: z.array(z.strictObject({ id, chapter_id:id, module_code:id, sort_order:z.number().int(), title:text, description:text, accent_role:id })),
  nodes: z.array(z.strictObject({ id, module_id:id, node_code:id, node_type:id, sort_order:z.number().int(), estimated_minutes:z.number(), title:text, content:z.unknown() })),
  activities: z.array(z.strictObject({ id, node_id:id, activity_key:id, activity_type:id, sort_order:z.number().int(), prompt:text, instruction:text, options:z.array(z.string()), public_config:z.unknown(), max_attempts:z.number().int(), counts_toward_completion:z.boolean() })),
  media: z.array(z.strictObject({ id, node_id:id, asset_key:id, media_type:id, purpose:id, object_key:z.string().nullable(), production_status:id, alt_text:text.partial(), metadata:z.unknown() })),
  tracks: z.array(z.strictObject({ activity_id:id, page_index:z.number().int().nonnegative(), audio_object_key:z.string().nullable(), audio_status:id })),
  lessons: z.array(z.strictObject({ id, module_id:id })),
  teachingVersions: z.array(z.strictObject({ id, lesson_id:id, version_number:z.number().int(), status:id })),
  teachingNodes: z.array(z.strictObject({ id, script_version_id:id, node_key:id, node_type:id, sort_order:z.number().int(), title:text, teacher_script:text, configuration:z.unknown(), reference_activity_id:id.nullable(), action_type:id, next_node_key:id.nullable(), remediation_node_key:id.nullable(), is_required:z.boolean() })),
  speech: z.array(z.strictObject({ id, script_node_id:id, locale:id, segment_index:z.number().int(), content_hash:id, duration_ms:z.number().nullable(), production_status:id })),
});
export type LegacyChapterOneSource = z.infer<typeof legacySourceSchema>;
