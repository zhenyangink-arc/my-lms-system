"use server";

import { unstable_rethrow } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";
import { revalidateDashboard } from "@/lib/revalidate-dashboard";
import type { AdminProfileState } from "./profile-state";

const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function error(message: string, fieldErrors?: Record<string, string>): AdminProfileState {
  return { status: "error", message, fieldErrors };
}

/** 可空的日期校验：空字符串返回 null，格式或范围非法返回 "invalid"。 */
function parseOptionalDate(value: string, minYear: number, maxYear: number): string | null | "invalid" {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "invalid";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < minYear ||
    year > maxYear ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "invalid";
  }
  return value;
}

/** 后台成员保存自己的姓名与头像（账号角色/状态/会员档位受数据库触发器保护，不能自改）。 */
export async function updateAdminProfileAction(
  _previousState: AdminProfileState,
  formData: FormData
): Promise<AdminProfileState> {
  void _previousState;

  try {
    const { supabase, user } = await requireActiveUser();
    const fullName = String(formData.get("fullName") ?? "").trim();
    const gender = String(formData.get("gender") ?? "").trim();
    const birthDate = parseOptionalDate(String(formData.get("birthDate") ?? "").trim(), 1900, 2020);
    const hiredAt = parseOptionalDate(String(formData.get("hiredAt") ?? "").trim(), 1980, 2100);

    if (fullName.length < 2 || fullName.length > 50) {
      return error("姓名需要填写 2—50 个字符。", { fullName: "姓名需要填写 2—50 个字符。" });
    }
    if (gender !== "" && gender !== "male" && gender !== "female") {
      return error("请选择有效的性别。", { gender: "性别选项无效。" });
    }
    if (birthDate === "invalid") {
      return error("出生日期不完整或无效。", { birthDate: "出生日期不完整或无效。" });
    }
    if (hiredAt === "invalid") {
      return error("入职时间不完整或无效。", { hiredAt: "入职时间不完整或无效。" });
    }

    let oldAvatarPath: string | null = null;
    let uploadedAvatarPath: string | null = null;
    const photo = formData.get("photo");

    if (photo instanceof File && photo.size > 0) {
      const extension = PHOTO_TYPES[photo.type];
      if (!extension) return error("头像仅支持 JPG、PNG 或 WEBP 格式。");
      if (photo.size > 2 * 1024 * 1024) return error("头像不能超过 2MB。");

      const { data: currentProfile, error: currentProfileError } = await supabase
        .from("profiles")
        .select("avatar_path")
        .eq("id", user.id)
        .maybeSingle();
      if (currentProfileError || !currentProfile) {
        return error("头像资料读取失败，请先保存姓名或稍后重试。");
      }
      oldAvatarPath = currentProfile.avatar_path as string | null;
      uploadedAvatarPath = `${user.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(uploadedAvatarPath, photo, { contentType: photo.type, upsert: false });
      if (uploadError) return error("头像上传失败，请稍后重试。");
    }

    const profileUpdate: Record<string, string> = { full_name: fullName };
    if (uploadedAvatarPath) profileUpdate.avatar_path = uploadedAvatarPath;

    const { error: updateError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id);

    if (updateError) {
      if (uploadedAvatarPath) {
        await supabase.storage.from("profile-photos").remove([uploadedAvatarPath]);
      }
      return error("个人信息保存失败，请稍后重试。");
    }

    // 后台人事信息写入独立的 staff_profiles 表，与学生档案字段分离。
    const { error: staffError } = await supabase
      .from("staff_profiles")
      .upsert(
        {
          user_id: user.id,
          gender: gender === "" ? null : gender,
          birth_date: birthDate,
          hired_at: hiredAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (staffError) {
      console.error("后台人事信息保存失败：", staffError.message);
      return error("个人信息保存失败（人事信息未保存），请稍后重试。");
    }

    // 数据库保存成功后再清理旧头像，任何失败都不会让用户丢失原照片。
    if (uploadedAvatarPath && oldAvatarPath && oldAvatarPath !== uploadedAvatarPath) {
      await supabase.storage.from("profile-photos").remove([oldAvatarPath]);
    }

    revalidateDashboard("/dashboard/admin/profile");
    return { status: "success", message: "个人信息已保存。" };
  } catch (caughtError) {
    unstable_rethrow(caughtError);
    console.error("保存后台个人信息时发生未捕获异常：", caughtError);
    return error("保存时连接出现异常，请刷新页面后重试。");
  }
}

/** 后台成员修改自己的登录密码。 */
export async function updateAdminPasswordAction(
  _previousState: AdminProfileState,
  formData: FormData
): Promise<AdminProfileState> {
  void _previousState;

  try {
    const { supabase } = await requireActiveUser();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password.length < 8 || password.length > 72) {
      return error("新密码需要 8—72 位。", { password: "新密码需要 8—72 位。" });
    }
    if (password !== confirmPassword) {
      return error("两次输入的密码不一致。", { confirmPassword: "两次输入的密码不一致。" });
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) return error("密码修改失败，请稍后重试。");

    return { status: "success", message: "密码已更新，下次登录请使用新密码。" };
  } catch (caughtError) {
    unstable_rethrow(caughtError);
    console.error("修改后台登录密码时发生未捕获异常：", caughtError);
    return error("修改时连接出现异常，请刷新页面后重试。");
  }
}
