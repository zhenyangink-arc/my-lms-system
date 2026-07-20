import type { Metadata } from "next";
import type { ReactNode } from "react";

// 客户端注册表单由这一层提供稳定的中文页面元数据。
export const metadata: Metadata = {
  title: "创建成长档案｜元智教育",
  description: "员工和学生账号由平台负责人或机构负责人统一开通。",
};

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children;
}
