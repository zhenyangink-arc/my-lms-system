"use client"; // 声明这是客户端组件，因为我们需要用到交互和自动播放

import * as React from "react";
import Autoplay from "embla-carousel-autoplay";
import type { LucideIcon } from "lucide-react";
import { BookOpenCheck, GraduationCap, Languages } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

type HomeSlide = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  backgroundClass: string;
  accentClass: string;
};

const slides: HomeSlide[] = [
  {
    eyebrow: "SMART PLANNING",
    title: "从目标院校到录取路径",
    description: "把选校、专业和申请节点放进一张清晰的留学规划图。",
    icon: GraduationCap,
    backgroundClass: "from-indigo-950 via-indigo-800 to-violet-600",
    accentClass: "bg-white/15 text-indigo-50",
  },
  {
    eyebrow: "LANGUAGE GROWTH",
    title: "让语言学习服务真实场景",
    description: "围绕韩国留学与校园生活，持续积累能开口、能应用的能力。",
    icon: Languages,
    backgroundClass: "from-sky-950 via-cyan-800 to-teal-500",
    accentClass: "bg-white/15 text-cyan-50",
  },
  {
    eyebrow: "STEP BY STEP",
    title: "每一个课时都有进度回响",
    description: "课程、资料、提问和学习记录集中管理，成长过程看得见。",
    icon: BookOpenCheck,
    backgroundClass: "from-slate-950 via-purple-900 to-fuchsia-600",
    accentClass: "bg-white/15 text-fuchsia-50",
  },
];

export function HomeCarousel() {
  const [plugin] = React.useState(() =>
    Autoplay({ delay: 5000, stopOnInteraction: true })
  );
  const plugins = React.useMemo(() => [plugin], [plugin]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-12">
      <Carousel
        plugins={plugins}
        className="relative w-full rounded-3xl overflow-hidden shadow-sm"
        onMouseEnter={plugin.stop}
        onMouseLeave={plugin.reset}
      >
        <CarouselContent className="h-[200px] sm:h-[520px]">
          {slides.map((slide) => {
            const Icon = slide.icon;

            return (
              <CarouselItem key={slide.title} className="h-full w-full">
                <div
                  className={`relative flex h-full overflow-hidden bg-gradient-to-br p-7 text-white sm:p-12 ${slide.backgroundClass}`}
                >
                  <div className="absolute -right-14 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
                  <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

                  <div className="relative z-10 flex max-w-2xl flex-col justify-center">
                    <span className="text-xs font-black tracking-[0.22em] text-white/70 sm:text-sm">
                      {slide.eyebrow}
                    </span>
                    <h3 className="mt-3 text-2xl font-black tracking-tight sm:mt-5 sm:text-5xl sm:leading-tight">
                      {slide.title}
                    </h3>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:mt-5 sm:text-lg sm:leading-8">
                      {slide.description}
                    </p>
                  </div>

                  <div
                    className={`absolute bottom-7 right-7 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/20 backdrop-blur sm:bottom-12 sm:right-12 sm:h-28 sm:w-28 ${slide.accentClass}`}
                    aria-hidden="true"
                  >
                    <Icon className="h-8 w-8 sm:h-14 sm:w-14" strokeWidth={1.5} />
                  </div>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>

        <CarouselPrevious className="left-4 h-12 w-12 bg-black/20 border-0 text-white hover:bg-black/40 hover:text-white" />
        <CarouselNext className="right-4 h-12 w-12 bg-black/20 border-0 text-white hover:bg-black/40 hover:text-white" />
      </Carousel>
    </div>
  );
}
