import { TeachingScriptStudio } from "@/features/learning-agent-script-studio/TeachingScriptStudio";
import { getTeachingScriptStudioData } from "@/features/learning-agent-script-studio/service";

export default async function TeachingScriptStudioPage({ studentAppId }: { studentAppId: string }) {
  const data = await getTeachingScriptStudioData(studentAppId);
  return <TeachingScriptStudio data={data} />;
}
