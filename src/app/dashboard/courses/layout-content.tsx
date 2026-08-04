import { redirect } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";


export default async function CoursesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { profile, tenant } = await requireActiveUser();

  if (!tenant && profile?.role !== "platform_course_inspector") {
    redirect("/dashboard/admin");
  }

  return children;
}
