import { TeachingScriptStudio } from "@/features/learning-agent-script-studio/TeachingScriptStudio";
import { getTeachingScriptStudioData } from "@/features/learning-agent-script-studio/service";

export default async function TeachingScriptStudioPage({ studentAppId, chapterId }: { studentAppId: string; chapterId?: string }) {
  const data = await getTeachingScriptStudioData(studentAppId);
  if (chapterId && !data.modules.some(module => module.chapterId === chapterId)) {
    return <p role="status" className="rounded-md border p-4 text-sm">所选章节没有可编排的模块，或所属教材版本不是当前脚本工作台使用的版本。工作台优先读取已发布教材；请在上方选择对应版本，或返回教材制作核对。不会自动切换到其他章节。</p>;
  }
  return <TeachingScriptStudio key={chapterId ?? "all"} chapterId={chapterId} data={chapterId ? { ...data, modules: data.modules.filter(module => module.chapterId === chapterId) } : data} />;
}
