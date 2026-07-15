"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { CHINA_REGION_CITIES } from "./china-cities";
import type { UpdateProfileState } from "./profile-state";

const EDUCATION_LEVELS = [
  "bachelor",
  "associate",
  "high_school",
  "secondary_vocational",
  "technical_school",
] as const;
const EDUCATION_STATUSES = ["graduated", "studying"] as const;
const ABILITY_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const LOWER_EDUCATION_LEVELS = new Set([
  "high_school",
  "secondary_vocational",
  "technical_school",
]);
const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function getText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function isOneOf<T extends readonly string[]>(value: string, values: T): value is T[number] {
  return values.includes(value as T[number]);
}

function parseChoice(value: string) {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

function buildBirthDate(yearText: string, monthText: string, dayText: string) {
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || year < 1940 || year > 2020) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${yearText}-${monthText.padStart(2, "0")}-${dayText.padStart(2, "0")}`;
}

function parseCompletionDate(value: string) {
  const match = /^(\d{4})\.(0[1-9]|1[0-2])\.(0[1-9]|[12]\d|3[01])$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function error(message: string, fieldErrors?: Record<string, string>): UpdateProfileState {
  return { status: "error", message, fieldErrors };
}

export async function updateProfileAction(
  _previousState: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  // 无论数据库或网络出现什么异常，都返回表单内提示，避免整个控制台进入错误页。
  try {
    return await saveProfile(formData);
  } catch (caughtError) {
    console.error("保存个人资料时发生未捕获异常：", caughtError);
    return error("保存时连接出现异常，请刷新页面后重试。");
  }
}

async function saveProfile(formData: FormData): Promise<UpdateProfileState> {
  // Server Action 独立验证登录状态，不复用会抛出页面错误的读取逻辑。
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) {
    return error("登录状态已失效，请重新登录后保存。");
  }
  const fullName = getText(formData, "fullName");
  const gender = getText(formData, "gender");
  const birthDate = buildBirthDate(
    getText(formData, "birthYear"),
    getText(formData, "birthMonth"),
    getText(formData, "birthDay")
  );
  const province = getText(formData, "province");
  const city = getText(formData, "city");
  const educationLevel = getText(formData, "educationLevel");
  const educationStatus = getText(formData, "educationStatus");
  const completionDate = parseCompletionDate(getText(formData, "completionDate"));
  const academicAverageText = getText(formData, "academicAverage");
  const englishLevel = getText(formData, "englishLevel");
  const mathLevel = getText(formData, "mathLevel");
  const hasKorean = parseChoice(getText(formData, "hasKorean"));
  const hasWorkExperience = parseChoice(getText(formData, "hasWorkExperience"));

  if (fullName.length < 2 || fullName.length > 50) {
    return error("请检查真实姓名后再保存。", { fullName: "姓名需要填写 2—50 个字符。" });
  }
  if (gender !== "male" && gender !== "female") {
    return error("请选择性别。", { gender: "请选择男或女。" });
  }
  if (!birthDate) {
    return error("请选择有效的出生日期。", { birthDate: "出生日期不完整或无效。" });
  }
  if (!Object.hasOwn(CHINA_REGION_CITIES, province) || !CHINA_REGION_CITIES[province].includes(city)) {
    return error("请选择有效的省份和城市。", { address: "住址需要精确到市级。" });
  }
  if (!isOneOf(educationLevel, EDUCATION_LEVELS)) {
    return error("请选择当前教育阶段。", { educationLevel: "教育阶段无效。" });
  }
  if (!isOneOf(educationStatus, EDUCATION_STATUSES)) {
    return error("请选择毕业或在读状态。", { educationStatus: "就读状态无效。" });
  }
  if (!completionDate) {
    return error("请按正确格式填写毕业日期。", { completionDate: "请填写真实日期，格式为 2020.06.01。" });
  }

  const academicAverage = Number(academicAverageText);
  if (academicAverageText === "" || !Number.isFinite(academicAverage) || academicAverage < 0 || academicAverage > 100) {
    return error("请填写 0—100 分之间的平均成绩。", { academicAverage: "平均成绩应为百分制。" });
  }
  if (!isOneOf(englishLevel, ABILITY_LEVELS) || !isOneOf(mathLevel, ABILITY_LEVELS)) {
    return error("请选择英语和数学能力等级。", { ability: "能力等级需要在 A1—C2 之间。" });
  }
  if (hasKorean === null || hasWorkExperience === null) {
    return error("请完成韩语能力与工作经历选项。", { experience: "请选择有或无。" });
  }

  let gaokaoHasScore: boolean | null = null;
  let gaokaoScore: number | null = null;
  if (LOWER_EDUCATION_LEVELS.has(educationLevel)) {
    gaokaoHasScore = parseChoice(getText(formData, "gaokaoHasScore"));
    if (gaokaoHasScore === null) {
      return error("请选择是否有高考成绩。", { gaokao: "请选择有或无。" });
    }
    if (gaokaoHasScore) {
      const scoreText = getText(formData, "gaokaoScore");
      gaokaoScore = Number(scoreText);
      if (scoreText === "" || !Number.isFinite(gaokaoScore) || gaokaoScore < 0 || gaokaoScore > 750) {
        return error("请填写 0—750 分之间的高考成绩。", { gaokaoScore: "高考成绩范围为 0—750 分。" });
      }
    }
  }

  let topikLevel: number | null = null;
  if (hasKorean) {
    topikLevel = Number(getText(formData, "topikLevel"));
    if (!Number.isInteger(topikLevel) || topikLevel < 1 || topikLevel > 6) {
      return error("请选择 TOPIK 等级。", { topikLevel: "TOPIK 等级需要在 1—6 级之间。" });
    }
  }

  let oldAvatarPath: string | null = null;
  let uploadedAvatarPath: string | null = null;
  const photo = formData.get("photo");

  if (photo instanceof File && photo.size > 0) {
    const extension = PHOTO_TYPES[photo.type];
    if (!extension) return error("头像仅支持 JPG、PNG 或 WEBP 格式。");
    if (photo.size > 2 * 1024 * 1024) return error("头像不能超过 2MB。");

    // 只有确实选择了新头像时才读取旧路径，普通资料保存不再多做一次查询。
    const { data: currentProfile, error: currentProfileError } = await supabase
      .from("profiles")
      .select("avatar_path")
      .eq("id", user.id)
      .maybeSingle();
    if (currentProfileError || !currentProfile) {
      return error("头像资料读取失败，请先保存文字资料或稍后重试。");
    }
    oldAvatarPath = currentProfile.avatar_path as string | null;
    uploadedAvatarPath = `${user.id}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(uploadedAvatarPath, photo, { contentType: photo.type, upsert: false });
    if (uploadError) return error("头像上传失败，请稍后重试。");
  }

  const profileUpdate: Record<string, string | number | boolean | null> = {
    full_name: fullName,
    gender,
    birth_date: birthDate,
    address_province: province,
    address_city: city,
    education_level: educationLevel,
    education_status: educationStatus,
    education_completion_month: completionDate,
    academic_average: academicAverage,
    gaokao_has_score: gaokaoHasScore,
    gaokao_score: gaokaoScore,
    english_level: englishLevel,
    math_level: mathLevel,
    has_korean: hasKorean,
    topik_level: topikLevel,
    has_work_experience: hasWorkExperience,
  };
  if (uploadedAvatarPath) profileUpdate.avatar_path = uploadedAvatarPath;

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedProfile) {
    if (uploadedAvatarPath) {
      await supabase.storage.from("profile-photos").remove([uploadedAvatarPath]);
    }
    return error("个人资料保存失败，请稍后重试。");
  }

  // 数据库保存完成后再清理旧头像，确保任何失败都不会让用户丢失原照片。
  if (uploadedAvatarPath && oldAvatarPath && oldAvatarPath !== uploadedAvatarPath) {
    await supabase.storage.from("profile-photos").remove([oldAvatarPath]);
  }

  // 姓名以 profiles 为唯一展示来源，避免保存后再次更新 Auth 触发额外数据库写入。
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");

  return { status: "success", message: "个人资料与头像已保存。" };
}
