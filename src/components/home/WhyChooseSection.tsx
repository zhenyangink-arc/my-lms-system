import { Zap, Palette, Headset, Rocket } from "lucide-react";

// 把原来的文本拆分成“图标 + 文字”，并为每个特性配上专属的主题色
const reasons = [
  { 
    Icon: Zap, 
    text: "高性能计算核心", 
    color: "text-amber-500", 
    bg: "bg-amber-50" 
  },
  { 
    Icon: Palette, 
    text: "极简美学设计", 
    color: "text-pink-500", 
    bg: "bg-pink-50" 
  },
  { 
    Icon: Headset, 
    text: "24/7 专业支持", 
    color: "text-blue-500", 
    bg: "bg-blue-50" 
  },
  { 
    Icon: Rocket, 
    text: "快速部署服务", 
    color: "text-indigo-500", 
    bg: "bg-indigo-50" 
  },
];

export function WhyChooseSection() {
  return (
    <section className="border-t border-gray-100 bg-gray-50 py-16">
      <div className="container mx-auto max-w-7xl px-4">
        <h3 className="mb-12 text-center text-3xl font-bold text-gray-900">
          为什么选择 Puffy-Proxima?
        </h3>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {reasons.map((reason, index) => {
            const { Icon } = reason;
            return (
              <div
                key={index}
                className="group flex min-h-[220px] flex-col items-center justify-center gap-6 rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-100 hover:shadow-md"
              >
                {/* 图标容器：自带圆角背景色，且鼠标悬浮时有放大效果 */}
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${reason.bg} ${reason.color} transition-transform duration-300 group-hover:scale-110`}>
                  <Icon size={32} />
                </div>
                
                <span className="text-xl font-bold text-gray-800">
                  {reason.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}