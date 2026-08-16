import { setTenantApplicationSettingsAction } from "@/app/dashboard/admin/apps/actions";
import type { ManagementAppAccess } from "@/lib/management-apps";

export function ManagementApplicationSettingsPage({
  access,
}: {
  access: ManagementAppAccess;
}) {
  if (!access.tenantId) {
    return (
      <section className="app-card border px-5 py-10 text-center">
        <p className="text-sm font-semibold">平台应用标准设置保持只读</p>
        <p className="app-muted-text mt-2 text-xs">
          机构是否开放应用，需要进入对应机构的应用工作区后调整。
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form
        action={setTenantApplicationSettingsAction}
        className="app-card space-y-5 border p-5 sm:p-6"
      >
        <input type="hidden" name="space" value={access.tenantSlug ?? "tenant"} />
        <input type="hidden" name="app_slug" value={access.app.slug} />
        <div>
          <h2 className="text-sm font-semibold">机构应用设置</h2>
          <p className="app-muted-text mt-1 text-xs leading-5">
            此处只控制当前机构中的“{access.app.title}”，不会修改平台标准应用。
          </p>
        </div>
        <label className="block space-y-1.5 text-xs font-medium">
          <span>机构显示名称</span>
          <input
            name="custom_title"
            defaultValue={access.appTitle === access.app.title ? "" : access.appTitle}
            maxLength={80}
            placeholder={access.app.title}
            className="app-input h-10 w-full border px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
          />
        </label>
        <label className="block space-y-1.5 text-xs font-medium">
          <span>运行状态</span>
          <select
            name="status"
            defaultValue={access.availability.status}
            className="app-input h-10 w-full border px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
          >
            <option value="active" disabled={access.app.status !== "active"}>
              {access.app.status === "active"
                ? "运行中"
                : "运行中（等待平台开放）"}
            </option>
            <option value="coming_soon">建设中</option>
            <option value="hidden">隐藏</option>
          </select>
        </label>
        <label className="flex items-start gap-3 border p-3 text-xs">
          <input
            type="checkbox"
            name="is_enabled"
            defaultChecked={access.availability.enabled}
            className="mt-0.5 size-4 accent-[var(--app-accent)]"
          />
          <span>
            <span className="block font-semibold">允许当前机构使用此应用</span>
            <span className="app-muted-text mt-1 block leading-5">
              关闭后学生和普通员工不能进入；已有学习事实与授权记录不会删除。
            </span>
          </span>
        </label>
        <button className="inline-flex min-h-10 items-center justify-center bg-[var(--app-accent)] px-4 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2">
          保存应用设置
        </button>
      </form>

      <aside className="app-card border p-5">
        <h2 className="text-sm font-semibold">数据保留规则</h2>
        <dl className="mt-4 space-y-4 text-xs">
          <div><dt className="app-muted-text">平台应用</dt><dd className="mt-1 font-medium">{access.app.title}</dd></div>
          <div><dt className="app-muted-text">机构范围</dt><dd className="mt-1 font-medium">{access.tenantName}</dd></div>
          <div><dt className="app-muted-text">停用影响</dt><dd className="mt-1 leading-5">仅关闭入口，不删除学生进度、成绩、材料或审计日志。</dd></div>
          <div><dt className="app-muted-text">重新启用</dt><dd className="mt-1 leading-5">恢复后继续读取原应用数据，不会从零开始。</dd></div>
        </dl>
      </aside>
    </div>
  );
}
