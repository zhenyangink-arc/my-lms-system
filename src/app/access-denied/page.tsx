import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fcfbf7] px-6 py-12 text-[#141413]">
      <section className="w-full max-w-md rounded-[20px] border border-[#ebe9e1] bg-white p-8 text-center shadow-[0_8px_30px_rgba(99,168,103,0.06)]">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef5ee] text-[#4c8250]">
          <ShieldX size={26} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-black">暂时无法进入此空间</h1>
        <p className="mt-3 text-sm leading-6 text-[#625f58]">
          当前账号没有可用的 Dashboard 访问权限，请联系管理员确认账号角色或机构成员关系。
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-full bg-[#63a867] px-5 py-2.5 text-sm font-black text-white"
        >
          返回登录页
        </Link>
      </section>
    </main>
  );
}
