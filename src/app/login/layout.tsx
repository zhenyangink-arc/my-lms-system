import type { Metadata } from "next";
import type { ReactNode } from "react";

// 客户端登录表单由这一层提供稳定的中文页面元数据。
export const metadata: Metadata = {
  title: "登录｜元智教育",
  description: "登录后继续查看韩国留学规划、韩语课程与成长记录。",
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
