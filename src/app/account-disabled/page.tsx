import { redirect } from "next/navigation";
import { CirclePause, Mail } from "lucide-react";

import { getAuthContext } from "@/lib/auth";
import { SignOutButton } from "./SignOutButton";


export default async function AccountDisabledPage() {
  const auth = await getAuthContext();

  if (auth.status === "unauthenticated") {
    redirect("/login");
  }

  if (auth.status === "active") {
    redirect("/dashboard");
  }

  const isSuspended = auth.profile?.status === "suspended";

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-gray-50 px-4 py-16">
      <section className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
          <CirclePause size={28} />
        </div>

        <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-orange-700">
          账号暂不可用
        </p>
        <h1 className="mt-2 text-2xl font-black text-gray-950">
          {isSuspended ? "你的账号已被暂停" : "你的账号已被停用"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          当前账号无法进入学习控制台。若你认为这是误操作，请联系平台管理员核对账号状态。
        </p>

        <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <Mail size={16} />
          <span>{auth.user.email ?? "当前登录账号"}</span>
        </div>

        <div className="mt-6">
          <SignOutButton />
        </div>
      </section>
    </div>
  );
}
