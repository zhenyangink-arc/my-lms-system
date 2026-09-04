import {
  StudentApplicationHome,
  type StudentApplicationPrimaryTarget,
} from "@/app/dashboard/StudentApplicationHome";
import { requireActiveUser } from "@/lib/auth";

type UniversityTargetRow = {
  university_name: string;
  program_name: string | null;
  status: string;
  application_deadline: string | null;
};

export default async function StudyAbroadStudentAppPage({ params }: { params: Promise<{ space: string }> }) {
  const { space } = await params;
  const { supabase, user } = await requireActiveUser();

  const { data: targetRow } = await supabase
    .from("student_university_targets")
    .select("university_name,program_name,status,application_deadline")
    .eq("user_id", user.id)
    .order("priority", { ascending: false })
    .order("application_deadline", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const row = targetRow as UniversityTargetRow | null;
  const primaryTarget: StudentApplicationPrimaryTarget | null = row
    ? {
        universityName: row.university_name,
        programName: row.program_name,
        status: row.status,
        applicationDeadline: row.application_deadline,
      }
    : null;

  return (
    <StudentApplicationHome space={space} appSlug="study-abroad" primaryTarget={primaryTarget} />
  );
}
