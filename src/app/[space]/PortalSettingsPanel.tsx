import { MonitorCog, Palette } from "lucide-react";

export function PortalSettingsPanel() {
  return (
    <div>
      <section className="app-card rounded-3xl border p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Palette size={19} aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-black text-slate-950">统一界面外观</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              学习门户使用统一的中性浅色界面，保证课程与服务入口清晰一致。
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
            <MonitorCog size={17} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">学生应用使用 Student OS</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              进入学习应用后，可在顶部工具栏调整分时背景与界面透明度。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
