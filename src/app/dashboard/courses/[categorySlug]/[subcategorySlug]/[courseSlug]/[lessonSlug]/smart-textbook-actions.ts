"use server";

import { z } from "zod";

import { isPlatformCourseAuditorRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import {
  canUseStudentFeature,
  normalizeMembershipTier,
} from "@/lib/student-permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  submitSmartTextbookActivityForContext,
  type SmartTextbookSubmitResult,
} from "./smart-textbook-submission";

const preferenceSchema = z.object({
  textbookId: z.string().uuid(),
  locale: z.enum(["zh-CN", "ko-KR"]),
  supportMode: z.enum(["chinese", "bilingual", "immersion"]),
});

export async function saveSmartTextbookPreferenceAction(input: unknown) {
  const parsed = preferenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "设置内容无效。" };

  const { supabase, user, tenant, profile, platformProfile } =
    await requireActiveUser();
  if (isPlatformCourseAuditorRole(platformProfile?.role)) {
    return { ok: true, message: "平台预览模式仅在当前浏览器中切换。" };
  }
  if (!tenant) return { ok: false, message: "当前账号没有可用的学习空间。" };
  if (
    !canUseStudentFeature(
      profile?.role ?? "student",
      normalizeMembershipTier(profile?.membership_tier),
      "korean_course",
    )
  ) {
    return { ok: false, message: "当前账号没有智能教材学习权限。" };
  }

  const { data: textbook } = await supabase
    .from("digital_textbooks")
    .select("id")
    .eq("id", parsed.data.textbookId)
    .eq("status", "published")
    .maybeSingle();
  if (!textbook) return { ok: false, message: "教材不存在或尚未发布。" };

  const admin = createAdminClient();
  const { error } = await admin.from("digital_textbook_preferences").upsert(
    {
      tenant_id: tenant.id,
      student_id: user.id,
      textbook_id: parsed.data.textbookId,
      interface_locale: parsed.data.locale,
      support_mode: parsed.data.supportMode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,student_id,textbook_id" },
  );

  return error
    ? { ok: false, message: "设置暂时没有保存，请稍后再试。" }
    : { ok: true, message: "学习语言偏好已保存。" };
}

export async function submitSmartTextbookActivityAction(
  input: unknown,
): Promise<SmartTextbookSubmitResult> {
  const { supabase, user, tenant, profile, platformProfile } =
    await requireActiveUser();
  const preview = isPlatformCourseAuditorRole(platformProfile?.role);

  return submitSmartTextbookActivityForContext(input, {
    supabase,
    admin: createAdminClient(),
    userId: user.id,
    tenantId: tenant?.id ?? null,
    canSubmit: canUseStudentFeature(
      profile?.role ?? "student",
      normalizeMembershipTier(profile?.membership_tier),
      "korean_course",
    ),
    preview,
  });
}
