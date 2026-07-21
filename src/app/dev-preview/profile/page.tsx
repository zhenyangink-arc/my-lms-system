import { notFound } from "next/navigation";

import { ProfileView, type ProfileChecklistItem } from "@/app/dashboard/profile/ProfileView";
import { type StudentProfileInitialValue } from "@/app/dashboard/profile/ProfileForm";

// 仅开发环境可用的 UI 预览路由：不需要登录，用模拟数据渲染个人中心，方便调整布局与截图。
// 必须强制动态渲染：如果被静态预渲染，生产环境下的 notFound() 会在构建期触发，
// 导致 vercel build 产出的路由清单里找不到对应的 lambda/静态文件（构建直接失败）。
export const dynamic = "force-dynamic";
export const runtime = "edge";

export default function ProfilePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const checklist: ProfileChecklistItem[] = [
    { label: "真实姓名", done: true },
    { label: "性别与出生日期", done: true },
    { label: "居住地址", done: true },
    { label: "个人照片", done: false },
    { label: "教育经历", done: true },
    { label: "平均成绩", done: true },
    { label: "高考成绩", done: false },
    { label: "英语能力", done: true },
    { label: "数学能力", done: false },
    { label: "韩语能力", done: true },
    { label: "工作经历", done: true },
  ];

  const initialValue: StudentProfileInitialValue = {
    fullName: "王小明",
    gender: "male",
    birthDate: "2003-06-12",
    avatarUrl: null,
    province: "山东省",
    city: "青岛市",
    educationLevel: "high_school",
    educationStatus: "graduated",
    completionDate: "2022.06.30",
    academicAverage: "86.5",
    gaokaoHasScore: true,
    gaokaoScore: "512",
    englishLevel: "B1",
    mathLevel: "",
    hasKorean: true,
    topikLevel: "2",
    hasWorkExperience: false,
  };

  return (
    <div className="app-shell min-h-screen">
      {/* 264px 占位模拟真实控制台的侧边栏宽度，保证预览下的内容区宽度与线上一致 */}
      <div className="flex">
        <div className="hidden w-[264px] shrink-0 md:block" />
        <main className="min-w-0 flex-1">
          <ProfileView
            displayName="王小明"
            roleLabel="学生"
            email="xiaoming.wang@example.com"
            emailConfirmed={true}
            avatarUrl={null}
            createdAtLabel="2025年11月3日"
            lastSignInLabel="2026年7月19日"
            checklist={checklist}
            initialValue={initialValue}
          />
        </main>
      </div>
    </div>
  );
}
