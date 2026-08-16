import { redirect } from "next/navigation";

import { getStudentAppPath } from "@/lib/student-apps";

export default async function LegacyKoreanToolboxPage({
  params,
}: {
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  redirect(getStudentAppPath(space, "korean", "practice/skills"));
}
