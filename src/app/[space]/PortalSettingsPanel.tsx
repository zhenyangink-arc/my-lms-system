import { Layers, Palette, SlidersHorizontal, Sparkles, SunMedium } from "lucide-react";

import {
  BackgroundBrightnessControl,
  CardGradientControl,
  CardOpacityControl,
  DashboardAppearanceSync,
} from "@/app/dashboard/BackgroundBrightnessControl";
import { ThemeSwitcher } from "@/app/dashboard/ThemeSwitcher";

const controls = [
  {
    label: "背景亮度",
    description: "调节学习工作台画布的明暗程度。",
    icon: SunMedium,
    control: <BackgroundBrightnessControl />,
  },
  {
    label: "卡片透明度",
    description: "控制内容卡片的通透与清晰程度。",
    icon: Layers,
    control: <CardOpacityControl />,
  },
  {
    label: "卡片渐变",
    description: "调整卡片背景渐变的视觉强度。",
    icon: Sparkles,
    control: <CardGradientControl />,
  },
];

export function PortalSettingsPanel() {
  return (
    <div className="space-y-5">
      <DashboardAppearanceSync />
      <section className="app-card rounded-3xl border p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Palette size={19} aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-black text-slate-950">界面主题</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              选择你喜欢的学习工作台配色，设置会保存在当前设备。
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <ThemeSwitcher />
        </div>
      </section>

      <section className="app-card rounded-3xl border p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
            <SlidersHorizontal size={19} aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-black text-slate-950">外观调节</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              进一步调整背景和卡片的显示效果。
            </p>
          </div>
        </div>

        <div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200 px-4">
          {controls.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-4 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">{item.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.description}</p>
                </div>
                {item.control}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
