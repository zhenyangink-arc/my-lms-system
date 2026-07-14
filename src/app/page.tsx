import type { Metadata } from "next";

import { CommonServices } from "@/components/home/CommonServices";
import { GrowthPathSection } from "@/components/home/GrowthPathSection";
import { HeroSection } from "@/components/home/HeroSection";
import { OutcomeSection } from "@/components/home/OutcomeSection";
import { QuestionSection } from "@/components/home/QuestionSection";
import styles from "@/components/home/home.module.css";

// 首页单独使用中文搜索信息，避免影响控制台页面的元数据。
export const metadata: Metadata = {
  title: "元智留学｜韩国留学规划与韩语成长",
  description:
    "从院校定位、申请准备到韩语学习与入学适应，为韩国留学提供清晰、可执行、可追踪的成长方案。",
};

export default function HomePage() {
  return (
    <div className={styles.homeShell}>
      {/* 首页按照“看见方向—理解路径—确认成果—开始行动”的节奏展开。 */}
      <HeroSection />
      <GrowthPathSection />
      <OutcomeSection />
      <CommonServices />
      <QuestionSection />
    </div>
  );
}
