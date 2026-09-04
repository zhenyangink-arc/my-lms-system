"use server";

import { revalidatePath } from "next/cache";

import { requireActiveUser } from "@/lib/auth";
import { isInterestTag } from "./interest-tags";

export type PersonalSpaceActionState = {
  error: string | null;
  saved: boolean;
};

export async function updateMottoAction(
  formData: FormData,
): Promise<PersonalSpaceActionState> {
  const { supabase, user } = await requireActiveUser();
  const motto = String(formData.get("motto") ?? "").trim().slice(0, 60);

  const { error } = await supabase
    .from("profiles")
    .update({ motto: motto || null })
    .eq("id", user.id);

  if (error) {
    console.error("[personal-space] 保存一句话失败：", error.message);
    return { error: "保存失败，请稍后再试。", saved: false };
  }

  revalidatePath("/[space]", "page");
  return { error: null, saved: true };
}

export async function updateInterestTagsAction(
  formData: FormData,
): Promise<PersonalSpaceActionState> {
  const { supabase, user } = await requireActiveUser();
  const tags = [...new Set(formData.getAll("tags").map(String))]
    .filter(isInterestTag)
    .slice(0, 8);

  const { error } = await supabase
    .from("profiles")
    .update({ interest_tags: tags })
    .eq("id", user.id);

  if (error) {
    console.error("[personal-space] 保存标签失败：", error.message);
    return { error: "保存失败，请稍后再试。", saved: false };
  }

  revalidatePath("/[space]", "page");
  return { error: null, saved: true };
}
