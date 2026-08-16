import { redirect } from "next/navigation";

import { getStudentAppPath } from "@/lib/student-apps";

export default async function LegacyKoreanToolboxSkillPage({
  params,
}: {
  params: Promise<{ space: string; skill: string }>;
}) {
  const { space, skill } = await params;
  redirect(
    getStudentAppPath(
      space,
      "korean",
      `practice/skills/${encodeURIComponent(skill)}`,
    ),
  );
}
