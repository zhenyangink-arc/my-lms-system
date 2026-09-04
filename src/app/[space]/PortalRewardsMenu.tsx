"use client";

import { Coins, Gift, Plus } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

export function PortalRewardsMenu() {
  return (
    <div className="hidden shrink-0 items-center gap-1 xl:flex">
      <Popover>
        <PopoverTrigger
          aria-label="查看积分"
          title="积分"
          className="group inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-slate-200 transition-colors hover:border-amber-300/25 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <Coins size={17} aria-hidden="true" className="text-amber-300" />
          <span>积分</span>
          <span
            aria-hidden="true"
            className="flex size-6 items-center justify-center rounded-lg bg-amber-300 text-slate-950 transition-colors group-hover:bg-amber-200"
          >
            <Plus size={14} strokeWidth={2.5} />
          </span>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={10}
          positionerClassName="max-w-[calc(100vw-2rem)]"
          className="w-72 rounded-2xl border-slate-200 bg-white p-5 text-slate-950 shadow-[0_24px_70px_-24px_rgba(15,23,42,0.5)]"
        >
          <span className="flex size-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-600/15">
            <Coins size={20} aria-hidden="true" />
          </span>
          <PopoverTitle className="mt-4 text-base font-black text-slate-950">
            积分功能尚未开通
          </PopoverTitle>
          <PopoverDescription className="mt-2 text-sm leading-6 text-slate-600">
            完成学习任务后获得积分、查看余额和积分明细的功能正在准备中。
          </PopoverDescription>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger
          aria-label="打开礼物中心"
          title="礼物中心"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <Gift size={18} aria-hidden="true" />
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={10}
          positionerClassName="max-w-[calc(100vw-2rem)]"
          className="w-72 rounded-2xl border-slate-200 bg-white p-5 text-slate-950 shadow-[0_24px_70px_-24px_rgba(15,23,42,0.5)]"
        >
          <span className="flex size-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 ring-1 ring-rose-600/15">
            <Gift size={20} aria-hidden="true" />
          </span>
          <PopoverTitle className="mt-4 text-base font-black text-slate-950">
            礼物中心尚未开通
          </PopoverTitle>
          <PopoverDescription className="mt-2 text-sm leading-6 text-slate-600">
            可兑换的学习奖励和礼物将在功能开通后显示在这里。
          </PopoverDescription>
        </PopoverContent>
      </Popover>
    </div>
  );
}
