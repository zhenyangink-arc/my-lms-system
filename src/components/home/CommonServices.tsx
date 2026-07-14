import Link from "next/link";
import {
  ArrowUpRight,
  BookOpenText,
  Building2,
  CheckCircle2,
  Headphones,
  Home,
  MessageCircleQuestion,
  Route,
} from "lucide-react";

const services = [
  {
    icon: Building2,
    title: "专属选校方案",
    description: "结合背景、专业方向和预算，建立更合理的院校梯度。",
    href: "/dashboard/universities",
    color: "bg-[#e7f5ff] text-[#3489b9]",
  },
  {
    icon: BookOpenText,
    title: "情境韩语课堂",
    description: "围绕课堂、面试与日常生活，练习真正用得上的表达。",
    href: "/dashboard/courses",
    color: "bg-[#fff0e9] text-[#df6d53]",
  },
  {
    icon: Home,
    title: "入学生活适应",
    description: "提前了解签证、住宿、选课和校园生活的重要节点。",
    href: "/dashboard/help",
    color: "bg-[#eaf8ef] text-[#45a56e]",
  },
];

export function CommonServices() {
  return (
    <section id="services" className="scroll-mt-24 bg-[#fffdf8] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.36fr_0.64fr] lg:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#eaf7ee] px-4 py-2 text-sm font-black text-[#3f9562]">
              <Route size={16} />
              一站式成长支持
            </span>
            <h2 className="mt-5 text-3xl font-black tracking-[-0.035em] text-[#173b57] sm:text-5xl">
              不只帮你申请，
              <br />
              更陪你适应与成长
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [CheckCircle2, "留学任务有节奏"],
              [Headphones, "韩语练习有场景"],
              [MessageCircleQuestion, "遇到问题有人答"],
            ].map(([Icon, label]) => {
              const PointIcon = Icon as typeof CheckCircle2;
              return (
                <div key={label as string} className="flex items-center gap-3 rounded-2xl border border-[#e0edf3] bg-white p-4 text-sm font-black text-[#45667b] shadow-sm">
                  <PointIcon size={19} className="shrink-0 text-[#f17b5e]" />
                  {label as string}
                </div>
              );
            })}
          </div>
        </div>

        {/* 服务卡片直接连接现有功能页面，保持登录与控制台结构不变。 */}
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <Link
                key={service.title}
                href={service.href}
                className="group rounded-[2rem] border border-[#deebf2] bg-white p-7 shadow-[0_14px_40px_rgba(64,118,151,0.08)] transition duration-300 hover:-translate-y-2 hover:border-[#bcdcea] hover:shadow-[0_22px_55px_rgba(64,118,151,0.16)]"
              >
                <div className="flex items-start justify-between">
                  <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${service.color}`}>
                    <Icon size={26} />
                  </span>
                  <ArrowUpRight className="text-[#aac0cd] transition group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-[#f0785b]" />
                </div>
                <h3 className="mt-8 text-2xl font-black text-[#224b68]">{service.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#647d8e]">{service.description}</p>
                <span className="mt-7 inline-flex text-sm font-black text-[#e96f53]">进入服务</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
