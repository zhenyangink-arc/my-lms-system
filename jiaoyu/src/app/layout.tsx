import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "元智教育｜韩国留学规划与韩语成长", description: "从院校定位、申请准备到韩语学习与入学适应，为韩国留学提供清晰、可执行的成长方案。" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body className="flex min-h-screen flex-col bg-white antialiased"><header className="sticky top-0 z-50 border-b border-[#deedf5] bg-[#f8fbff]/95 backdrop-blur-xl"><nav className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8"><Link href="/" className="text-xl font-black tracking-tight text-[#19425f]">元智教育</Link><div className="flex items-center gap-2 sm:gap-5"><Link href="/#growth-path" className="text-sm font-bold text-[#557186]">成长路线</Link><Link href="/#services" className="text-sm font-bold text-[#557186]">服务支持</Link><Link href="/#start-plan" className="rounded-xl bg-[#5e98f3] px-4 py-2.5 text-sm font-black text-white">开始规划</Link></div></nav></header><main className="flex-1">{children}</main><footer className="border-t border-[#dceaf2] bg-[#f4faff] px-5 py-8 text-center text-sm text-[#6a8495]">© {new Date().getFullYear()} 元智教育 · 韩国留学规划 · 韩语成长陪伴</footer></body></html>;
}
