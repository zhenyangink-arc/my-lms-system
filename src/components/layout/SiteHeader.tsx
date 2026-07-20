"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, MapPinned, Menu, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { isDashboardPathname } from "@/lib/dashboard-path";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const navItems = [
  { label: "双线成长", href: "/#growth-path" },
  { label: "学习成果", href: "/#outcomes" },
  { label: "服务支持", href: "/#services" },
  { label: "开始规划", href: "/#start-plan" },
];

export function SiteHeader() {
  const pathname = usePathname();

  // 控制台使用自己的顶部条，公开站点导航只在非控制台页面显示。
  if (isDashboardPathname(pathname)) {
    return null;
  }

  return <PublicSiteHeader />;
}

function PublicSiteHeader() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!mounted) return;
      setUser(currentUser);
      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setMenuOpen(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#deedf5] bg-[#f8fbff]/92 backdrop-blur-xl">
      <nav className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8" aria-label="主导航">
        {/* 中文品牌标识使用暖橙与天蓝，呼应留学和成长双主线。 */}
        <Link href="/" className="group flex shrink-0 items-center gap-3">
          <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl border border-white bg-[conic-gradient(from_35deg,#7dacff_0_50%,#78c8ef_50%_100%)] shadow-[0_8px_20px_rgba(73,133,169,0.18)] transition group-hover:-rotate-3 group-hover:scale-105">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/90 text-[#345f78]">
              <MapPinned size={15} />
            </span>
          </span>
          <span>
            <span className="block text-xl font-black tracking-[-0.04em] text-[#19425f]">元智教育</span>
            <span className="hidden text-[11px] font-bold tracking-[0.08em] text-[#7590a2] lg:block">
              韩国留学与韩语成长
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#557186] transition hover:bg-[#edf6ff] hover:text-[#2e7ca8]"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* 登录状态加载时保留固定宽度，避免导航左右跳动。 */}
          {loading ? (
            <div className="hidden h-10 w-32 animate-pulse rounded-xl bg-[#edf3f6] sm:block" />
          ) : user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/dashboard"
                className="rounded-xl px-4 py-2.5 text-sm font-black text-[#2e7299] transition hover:bg-[#edf6ff]"
              >
                个人中心
              </Link>
              <AlertDialog>
                <AlertDialogTrigger className="rounded-xl border border-[#d7e6ee] bg-white px-4 py-2.5 text-sm font-black text-[#61798a] transition hover:bg-[#f6f9fc]">
                  退出
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认退出登录？</AlertDialogTitle>
                    <AlertDialogDescription>
                      退出后需要重新登录，才能继续查看课程和成长记录。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLogout} className="bg-[#5290e9] hover:bg-[#4683d9]">
                      确认退出
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/login"
                className="rounded-xl px-4 py-2.5 text-sm font-black text-[#527084] transition hover:bg-[#edf6ff]"
              >
                登录
              </Link>
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 rounded-xl bg-[#5e98f3] px-4 py-2.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(94, 152, 243,0.22)] transition hover:-translate-y-0.5 hover:bg-[#508ce8]"
              >
                免费开始
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d9e8ef] bg-white text-[#315f79] md:hidden"
            aria-label={menuOpen ? "关闭导航菜单" : "打开导航菜单"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* 移动端菜单保持大触控区域，并包含完整的登录入口。 */}
      {menuOpen && (
        <div className="border-t border-[#e1edf3] bg-[#f8fbff] px-5 pb-5 pt-3 md:hidden">
          <div className="mx-auto grid max-w-7xl gap-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-black text-[#48677b] hover:bg-[#edf6ff]"
              >
                {item.label}
              </Link>
            ))}
            {!loading && (
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#e2edf3] pt-4">
                {user ? (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="rounded-xl bg-[#e9f3fd] px-4 py-3 text-center text-sm font-black text-[#31799f]"
                    >
                      个人中心
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-xl border border-[#c8d5f0] bg-white px-4 py-3 text-sm font-black text-[#4e7fcb]"
                    >
                      退出登录
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="rounded-xl border border-[#d7e6ee] bg-white px-4 py-3 text-center text-sm font-black text-[#527084]"
                    >
                      登录
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMenuOpen(false)}
                      className="rounded-xl bg-[#5e98f3] px-4 py-3 text-center text-sm font-black text-white"
                    >
                      免费开始
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
