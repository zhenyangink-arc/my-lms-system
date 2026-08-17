import { MonitorCog } from "lucide-react";

export function PortalSettingsPanel() {
  return (
    <div>
      <section className="app-card rounded-3xl border p-5 sm:p-6">
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
            <MonitorCog size={17} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs leading-5 text-slate-500">
              进入学习应用后，可在顶部工具栏调整分时背景与界面透明度。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
