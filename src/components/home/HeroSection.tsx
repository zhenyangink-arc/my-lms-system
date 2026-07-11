import { 
  Code, 
  BookOpen, 
  Bot, 
  FileText, 
  Map, 
  Check, 
  Sparkles, 
  GraduationCap 
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 1. 核心数据阵列：直接绑定 lucide-react 的组件图标
 */
const iconData = [
  { Icon: Code, color: "#d97706", bg: "#fef3c7", rotate: "-6deg" },
  { Icon: BookOpen, color: "#2563eb", bg: "#eff6ff", rotate: "3deg" },
  { Icon: Bot, color: "#059669", bg: "#ecfdf5", rotate: "-3deg" },
  { Icon: FileText, color: "#9333ea", bg: "#fae8ff", rotate: "6deg" },
  { Icon: Map, color: "#e11d48", bg: "#fff1f2", rotate: "-12deg" },
];

/**
 * 2. 样式变量提炼
 */
const floatCard = "absolute hidden transform select-none rounded-2xl border-2 border-gray-900 p-4 shadow-sm sm:flex";

export function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden border-b border-gray-50 bg-white py-24 text-center">
      
      {/* 左侧漂浮卡片 */}
      <div className={`${floatCard} bottom-8 left-4 -rotate-12 bg-amber-50/60 animate-pulse md:left-12 items-end gap-1`}>
        <BookOpen size={40} color="#d97706" />
        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-amber-50 bg-gray-900 shadow-sm">
          <Check size={16} color="#34d399" strokeWidth={3} />
        </div>
      </div>

      {/* 右侧漂浮卡片 */}
      <div className={`${floatCard} bottom-12 right-4 rotate-12 bg-purple-50/60 md:right-12 flex-col items-center`}>
        <div className="flex items-center justify-center gap-1">
          <Sparkles size={13} color="#a855f7" />
          <GraduationCap size={40} color="#7e22ce" strokeWidth={2.2} />
          <Sparkles size={13} color="#a855f7" />
        </div>
      </div>

      {/* 关键改动保留：flex-col 容器统一用 gap-y-8 控制纵向间距，
        想统一调大/调小整体间距，只需改这一处 gap-y-8。
      */}
      <div className="container mx-auto relative z-10 flex flex-col items-center gap-y-8 px-4">
        
        {/* 顶部 5 个彩色图标列 */}
        <div className="flex items-center gap-10">
          {iconData.map((item, index) => {
            const { Icon } = item;
            return (
              <div 
                key={index}
                style={{ 
                  backgroundColor: item.bg, 
                  transform: `rotate(${item.rotate})` 
                }}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-gray-950 shadow-sm"
              >
                <Icon size={28} color={item.color} />
              </div>
            );
          })}
        </div>

        {/* 核心大标题 */}
        <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tighter text-gray-900 sm:text-5xl md:text-6xl">
          韩国留学，从精准规划开始
        </h1>

        {/* 脉冲跑马灯/标语区 */}
        <div className="mx-auto flex w-max items-center gap-3 rounded-3xl border border-indigo-100 bg-indigo-50 px-7 py-4 text-indigo-600 shadow-inner text-2xl md:text-4xl font-semibold">
          <span className="h-4 w-4 animate-ping rounded-full bg-indigo-500"></span>
          探索韩国留学的更多可能
        </div>

        {/* 描述文本 */}
        <p className="max-w-2xl text-lg font-medium leading-relaxed text-gray-600 md:text-xl">
          从院校选择、专业规划到语言提升、申请指导，借助专家分析和 AI 智能学习，为您打造一站式韩国留学成长平台
        </p>

        {/* 行动按钮区：升级为 Shadcn 的 Button */}
        <div className="flex flex-wrap justify-center gap-x-8 sm:gap-x-40 gap-y-6">
          <Button 
            size="lg" 
            className="rounded-xl bg-indigo-600 px-8 py-6 text-lg font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700"
          >
            免费开始使用
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="rounded-xl border-gray-200 bg-gray-50 px-8 py-6 text-lg font-bold text-gray-700 hover:bg-gray-100"
          >
            预约演示查看
          </Button>
        </div>
        
      </div>
    </section>
  );
}