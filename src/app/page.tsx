
// 引入我们刚刚写好的大横幅组件
import { HeroSection } from "@/components/home/HeroSection";  // 👈 横幅
import { HomeCarousel } from "@/components/home/HomeCarousel"; // 👈 引入轮播图
import { CommonServices } from "@/components/home/CommonServices"; // 👈 引入常见服务
import { WhyChooseSection } from "@/components/home/WhyChooseSection"; // 👈 引入选择我们的理由
import { QuestionSection } from "@/components/home/QuestionSection"; // 👈 引入提问模块

export default function HomePage() {
  return (
    <>
      {/* 把大横幅放在首页上 */}
      <HeroSection />

      <section className="container mx-auto max-w-7xl px-4 py-12">  
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12 items-start">
          
          {/* 左侧轮播图区域 (占 7 列) */}
          <div className="lg:col-span-8"> 
             {/* 注: 为了填满12列，我把这里调成了8，你可以根据视觉效果调回7 */}
            <HomeCarousel />
          </div>

          {/* 右侧常用服务区域 (占 4 列) */}
          <CommonServices />
        </div>
      </section>

      {/* 👇 2. 把“优势介绍”模块放在最下方 */}
      <WhyChooseSection />

      {/* 👇 放在页面底部作为强有力的行动号召 (CTA) */}
      <QuestionSection />
    </>
  );
}