import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PUFFY - 打造你的专属知识宇宙",
  description: "企业级高效全栈学习管理系统",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: 'try{var t=localStorage.getItem("app-dashboard-theme");if(t==="vercel"||t==="chatgpt"){document.documentElement.setAttribute("data-app-theme",t)}}catch(e){}' }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col bg-white antialiased`}>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
