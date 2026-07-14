import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css"; 
import { SiteHeader } from "@/components/layout/SiteHeader"; 
import { SiteFooter } from "@/components/layout/SiteFooter"; // 👈 1. 引入底部版权


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PUFFY - 打造你的专属知识宇宙",
  description: "企业级高效全栈学习管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 👇 Next.js 强制要求的 <html> 标签
    <html lang="zh-CN"> 
      {/* 👇 Next.js 强制要求的 <body> 标签 */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col bg-white antialiased`}
      >
        {/* 顶部导航栏 */}
        <SiteHeader />

        {/* 主体页面内容会放进这里 */}
        <main className="flex-1">
          {children}
        </main>
        
        <SiteFooter /> {/* 👈  放在 main 的下面 */}
      </body>
    </html>
  );
}
