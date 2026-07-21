import { Eye, ShieldCheck } from "lucide-react";

import { requireActiveUser } from "@/lib/auth";


export default async function CoursesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { platformProfile } = await requireActiveUser();
  const isPlatformAudit = platformProfile?.role === "platform_super_admin";

  return (
    <>
      {isPlatformAudit && (
        <section
          className="mx-5 mt-5 rounded-2xl border p-4"
          style={{
            borderColor: "var(--app-accent)",
            backgroundColor: "var(--app-accent-soft)",
          }}
        >
          <div className="flex items-start gap-3">
            <Eye
              className="mt-0.5 shrink-0"
              size={19}
              style={{ color: "var(--app-accent)" }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">上帝视角 · 学生端真实界面</p>
              <p className="app-muted-text mt-1 text-xs leading-5">
                当前为平台负责人只读巡检，不建立学生身份，不读取或记录学习进度、提问与课时完成状态。
              </p>
            </div>
            <span className="hidden items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs font-black sm:inline-flex">
              <ShieldCheck size={13} aria-hidden="true" />
              零学习数据
            </span>
          </div>
        </section>
      )}
      {children}
    </>
  );
}
