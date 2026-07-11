"use client"; // 声明这是客户端组件，因为我们需要用到交互和自动播放

import * as React from "react";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

// 1. 你的原版数据完美保留
const slides = [
  {
    type: "image",
    src: "/images/banner-1.jpg", // ⚠️ 注意：测试时请确保你 Next.js项目的 public/images/ 下有这些图片
    alt: "轮播图片 1",
  },
  {
    type: "video",
    src: "/videos/banner-video.mp4",
    poster: "/images/video-poster.jpg",
    alt: "轮播视频 1",
  },
  {
    type: "image",
    src: "/images/banner-2.jpg",
    alt: "轮播图片 2",
  },
];

export function HomeCarousel() {
  // 2. 自动播放插件：这一句话，就替代了你原来写的几十行计时器逻辑
  const plugin = React.useRef(
    Autoplay({ delay: 5000, stopOnInteraction: true })
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-12">
      <Carousel
        plugins={[plugin.current]}
        className="relative w-full rounded-3xl overflow-hidden shadow-sm"
        onMouseEnter={plugin.current.stop}
        onMouseLeave={plugin.current.reset}
      >
        {/* 3. 轮播图主体区域 */}
        <CarouselContent className="h-[200px] sm:h-[520px]">
          {slides.map((slide, index) => (
            <CarouselItem key={index} className="relative h-full w-full">
              {slide.type === "video" ? (
                <video
                  className="h-full w-full object-cover"
                  src={slide.src}
                  poster={slide.poster}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img
                  className="h-full w-full object-cover"
                  src={slide.src}
                  alt={slide.alt}
                />
              )}
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* 4. 左右控制按钮：引擎全自动控制隐藏与显示、点击逻辑 */}
        <CarouselPrevious className="left-4 h-12 w-12 bg-black/20 border-0 text-white hover:bg-black/40 hover:text-white" />
        <CarouselNext className="right-4 h-12 w-12 bg-black/20 border-0 text-white hover:bg-black/40 hover:text-white" />
      </Carousel>
    </div>
  );
}