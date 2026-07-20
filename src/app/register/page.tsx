import Link from "next/link";
import { KeyRound, LogIn, ShieldCheck } from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";

export default function RegisterPage() {
  return (
    <AuthPageShell variant="register">
      <section className="rounded-[2rem] border border-white/90 bg-white/94 p-7 text-center shadow-[0_28px_75px_rgba(52,106,140,0.17)] backdrop-blur sm:p-9">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f1ff] text-[#5b96f2]"><ShieldCheck size={30} /></span>
        <p className="mt-6 text-sm font-black tracking-[0.12em] text-[#5992ec]">机构账号制</p>
        <h2 className="mt-2 text-3xl font-black text-[#193f5b]">账号由负责人统一开通</h2>
        <p className="mt-4 text-sm leading-7 text-[#6c8494]">员工和学生账号需要绑定所属机构。请联系平台负责人或机构负责人获取登录账号和初始密码。</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5b96f2] px-5 py-3.5 text-sm font-black text-white"><LogIn size={16} />前往登录</Link>
          <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d7e6ee] bg-white px-5 py-3.5 text-sm font-black text-[#4e7085]"><KeyRound size={16} />返回首页</Link>
        </div>
      </section>
    </AuthPageShell>
  );
}
