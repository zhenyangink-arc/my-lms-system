"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
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
  { label: "首页", href: "/" },
  {
    label: "产品",
    items: [
      { label: "SaaS 系统", href: "/products/saas" },
      { label: "API 服务", href: "/products/api" },
    ],
  },
  {
    label: "解决方案",
    items: [
      { label: "企业级架构", href: "/solutions/enterprise" },
      { label: "流程自动化", href: "/solutions/automation" },
    ],
  },
  { label: "定价", href: "/pricing" },
  { label: "联系我们", href: "/contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isLoggedIn = !!user;

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      setUser(user);
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
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
      <div className="container mx-auto flex h-[72px] items-center justify-between px-4 md:px-8">
        {/* 1. 左侧 Logo 区 */}
        <Link
          href="/"
          className="text-xl font-black tracking-tighter text-indigo-600 transition hover:text-indigo-700"
        >
          PUFFY<span className="text-gray-900">.</span>
        </Link>

        {/* 2. 中间导航菜单区 */}
        <div className="hidden items-center gap-6 font-medium text-gray-600 md:flex">
          {navItems.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded-lg px-3 py-2 transition ${pathname === item.href
                  ? "bg-indigo-50 text-indigo-600"
                  : "hover:bg-gray-50 hover:text-indigo-600"
                  }`}
              >
                {item.label}
              </Link>
            ) : (
              <div key={item.label} className="group relative">
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-lg px-3 py-2 transition hover:text-indigo-600"
                >
                  {item.label}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </button>

                <div className="absolute left-0 z-50 hidden pt-2 group-hover:block">
                  <div className="flex w-40 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white py-2 shadow-xl">
                    {item.items?.map((child) => (
                      <Link
                        key={child.label}
                        href={child.href}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-indigo-600"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* 3. 右侧登录状态区 */}
        <div className="flex items-center gap-4">
          {loading ? (
            <div className="h-9 w-24 rounded-md bg-gray-100" />
          ) : !isLoggedIn ? (
            <>
              <Link href="/login">
                <Button variant="ghost">登录</Button>
              </Link>

              <Link href="/register">
                <Button className="bg-green-600 hover:bg-green-700">
                  加入我们
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" className="font-bold text-indigo-600">
                  个人中心
                </Button>
              </Link>

              <AlertDialog>
                <AlertDialogTrigger className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium shadow-sm transition hover:bg-gray-50">
                  退出
                </AlertDialogTrigger>

                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认退出登录？</AlertDialogTitle>
                    <AlertDialogDescription>
                      退出后需要重新登录才能进入个人中心和学生控制台。
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLogout}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      确认退出
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}