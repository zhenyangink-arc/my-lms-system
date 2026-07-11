import Link from "next/link";
import { ClipboardEdit, Library, Map, ArrowRight } from "lucide-react";

const services = [
  {
    Icon: ClipboardEdit, // 对应原版的 📝
    title: "한국어 진단평가",
    href: "#",
  },
  {
    Icon: Library,       // 对应原版的 📚
    title: "세종학당 전자도서관",
    href: "#",
  },
  {
    Icon: Map,           // 对应原版的 🗺️
    title: "학습 로드맵",
    href: "#",
  },
];

export function CommonServices() {
  return (
    <div className="flex w-full flex-col gap-4 lg:col-span-4">
      <div className="mb-1 text-lg font-bold text-gray-900">常用服务</div>

      {services.map((service, index) => {
        const { Icon } = service;
        return (
          <Link
            key={index}
            href={service.href}
            className="group flex w-full items-center justify-between rounded-3xl border border-gray-100 bg-white px-8 py-10 shadow-sm transition-all duration-300 hover:border-indigo-300 hover:shadow-lg"
          >
            <div className="flex items-center gap-6">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Icon size={32} />
              </div>

              <span className="text-2xl font-bold text-gray-800 transition-colors group-hover:text-indigo-900">
                {service.title}
              </span>
            </div>

            <ArrowRight className="h-8 w-8 text-gray-400 transition-colors group-hover:text-indigo-500" />
          </Link>
        );
      })}
    </div>
  );
}