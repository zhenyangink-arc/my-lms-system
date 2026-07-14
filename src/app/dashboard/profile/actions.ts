"use server";

import { revalidatePath } from "next/cache";

import { requireActiveUser } from "@/lib/auth";

export type UpdateProfileState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldError?: string;
};

export const initialUpdateProfileState: UpdateProfileState = {
  status: "idle",
  message: "",
};

export async function updateProfileAction(
  _previousState: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  // Server Action 自己重新验证身份，不能只依赖页面已经登录。
  const { supabase, user } = await requireActiveUser();
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (fullName.length < 2) {
    return {
      status: "error",
      message: "请检查姓名后再保存。",
      fieldError: "姓名至少需要 2 个字符。",
    };
  }

  if (fullName.length > 50) {
    return {
      status: "error",
      message: "请检查姓名后再保存。",
      fieldError: "姓名不能超过 50 个字符。",
    };
  }

  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !updatedProfile) {
    return {
      status: "error",
      message: "姓名保存失败，请稍后重试。",
    };
  }

  // 同步认证元数据，确保尚未读取 profiles 的旧页面也能显示最新姓名。
  await supabase.auth.updateUser({
    data: {
      full_name: fullName,
      name: fullName,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");

  return {
    status: "success",
    message: "个人资料已保存。",
  };
}
