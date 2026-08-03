import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";
import { PwaServiceWorkerRegistration } from "@/app/PwaServiceWorkerRegistration";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  applicationName: "PUFFY 学习中心",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PUFFY",
  },
  title: "PUFFY - 打造你的专属知识宇宙",
  description: "企业级高效全栈学习管理系统",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: 'try{var t=localStorage.getItem("app-dashboard-theme");if(t==="aurora"||t==="coral"){document.documentElement.setAttribute("data-app-theme",t)}}catch(e){}' }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col bg-background antialiased`}>
        <PwaServiceWorkerRegistration />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
