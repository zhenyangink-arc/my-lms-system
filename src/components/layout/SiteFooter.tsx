"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, MapPinned, MessageCircleMore } from "lucide-react";
import { isDashboardPathname } from "@/lib/dashboard-path";

const footerLinks = [
  {
    title: "留学服务",
    links: [
      ["院校规划", "/dashboard/universities"],
      ["签证准备", "/dashboard/visa"],
      ["成长路线", "/#growth-path"],
    ],
  },
  {
    title: "韩语学习",
    links: [
      ["课程中心", "/dashboard/courses"],
      ["口语练习", "/dashboard/conversation-practice"],
      ["学习成果", "/#outcomes"],
    ],
  },
  {
    title: "平台支持",
    links: [
      ["帮助中心", "/dashboard/help"],
      ["登录账号", "/login"],
      ["免费注册", "/register"],
    ],
  },
];

export function SiteFooter() {
  const pathname = usePathname();

  // 控制台拥有独立布局，因此不重复显示公开站点页脚。
  if (isDashboardPathname(pathname)) {
    return null;
  }

  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-[#dceaf2] bg-[#f4faff] text-[#4f6d80]">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.2fr_1.8fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#7ac8ed] to-[#6fa2f7] text-white shadow-sm">
              <MapPinned size={20} />
            </span>
            <span className="text-xl font-black text-[#1c4865]">元智教育</span>
          </Link>
          <p className="mt-5 max-w-md text-sm leading-7 text-[#658092]">
            把韩国留学规划与韩语成长放在同一条路上，让每一个目标都有行动，每一次学习都有记录。
          </p>
          <div className="mt-6 flex gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#3d8ab5] shadow-sm" title="留学规划">
              <MapPinned size={18} />
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#598fe6] shadow-sm" title="韩语课程">
              <BookOpenCheck size={18} />
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#4ba672] shadow-sm" title="学习支持">
              <MessageCircleMore size={18} />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h2 className="text-sm font-black text-[#284f69]">{group.title}</h2>
              <div className="mt-4 space-y-3">
                {group.links.map(([label, href]) => (
                  <Link
                    key={label}
                    href={href}
                    className="block text-sm font-medium text-[#6a8495] transition hover:translate-x-1 hover:text-[#558ee5]"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#dceaf2]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs font-medium text-[#7b93a2] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {currentYear} 元智教育　保留所有权利</span>
          <span>韩国留学规划 · 韩语成长陪伴</span>
        </div>
      </div>
    </footer>
  );
}
