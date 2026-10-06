import 'server-only';
import { z } from 'zod';

// Canonical approval metadata: validate spelling and Gregorian calendar without normalization.
function isCanonicalApprovalTimestamp(value: string): boolean {
  if (value.length !== 24 || !/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3}Z$/.test(value)) return false;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8, 10));
  if (year === 0) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const fixedSelectedMediaProofSchema = z.strictObject({
  adapter: z.literal('fixed-selected-host/1'), assetId: z.literal('course-video-sample01'),
  sha256: z.literal('68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe'),
  sizeBytes: z.literal(5487747), mime: z.literal('video/mp4'),
  videoDurationSeconds: z.literal(30), containerDurationSeconds: z.literal(30.016),
  revision: z.literal('media-sample01-68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe'),
});
export const nativeVideoSourceSchema = z.strictObject({
  contract: z.literal('video-pilot-publication-source/1'), mode: z.literal('video'), state: z.literal('promoted'),
  origin: z.strictObject({ teachingNodeId: z.uuid(), scriptVersionId: z.uuid(), draftDigest: hash }),
  approvedBy: z.uuid(), approvedAt: z.string().refine(isCanonicalApprovalTimestamp), media: fixedSelectedMediaProofSchema,
  cue: z.strictObject({ id: z.literal('pause-1'), atSeconds: z.number().finite().nonnegative().lt(30), activityId: z.uuid() }),
  captions: z.null(),
});
export type NativeVideoSource = z.infer<typeof nativeVideoSourceSchema>;
export type FixedSelectedMediaProof = z.infer<typeof fixedSelectedMediaProofSchema>;
export function parseNativeVideoSource(input: unknown): NativeVideoSource { return nativeVideoSourceSchema.parse(input); }
