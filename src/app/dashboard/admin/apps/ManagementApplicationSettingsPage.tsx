"use client";

import { useActionState } from "react";

import { setTenantApplicationSettingsAction } from "@/app/dashboard/admin/apps/actions";
import type { ManagementAppAccess } from "@/lib/management-apps";

type SettingsFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: {
    customTitle?: string;
    status?: string;
  };
};

const initialFormState: SettingsFormState = { status: "idle" };

async function submitSettings(
  _previousState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  try {
    await setTenantApplicationSettingsAction(formData);
    return { status: "success", message: "应用设置已保存。" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "应用设置保存失败，请稍后重试。";
    if (message.includes("显示名称")) {
      return { status: "error", message, fieldErrors: { customTitle: message } };
    }
    if (message.includes("状态") || message.includes("平台开放")) {
      return { status: "error", message, fieldErrors: { status: message } };
    }
    return { status: "error", message };
  }
}

export function ManagementApplicationSettingsPage({
  access,
}: {
  access: ManagementAppAccess;
}) {
  const [formState, formAction, isPending] = useActionState(
    submitSettings,
    initialFormState,
  );

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
        action={formAction}
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
            id="application-custom-title"
            name="custom_title"
            defaultValue={access.appTitle === access.app.title ? "" : access.appTitle}
            maxLength={80}
            placeholder={access.app.title}
            aria-describedby={
              formState.fieldErrors?.customTitle
                ? "application-custom-title-help application-custom-title-error"
                : "application-custom-title-help"
            }
            aria-invalid={Boolean(formState.fieldErrors?.customTitle)}
            className="app-input h-10 w-full border px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          />
          <span id="application-custom-title-help" className="app-muted-text block leading-5">
            留空时使用平台应用名称，最多 80 个字。
          </span>
          {formState.fieldErrors?.customTitle && (
            <span id="application-custom-title-error" className="block text-[var(--status-danger)]" role="alert">
              {formState.fieldErrors.customTitle}
            </span>
          )}
        </label>
        <label className="block space-y-1.5 text-xs font-medium">
          <span>运行状态</span>
          <select
            id="application-status"
            name="status"
            defaultValue={access.availability.status}
            aria-describedby={
              formState.fieldErrors?.status
                ? "application-status-help application-status-error"
                : "application-status-help"
            }
            aria-invalid={Boolean(formState.fieldErrors?.status)}
            className="app-input h-10 w-full border px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <option value="active" disabled={access.app.status !== "active"}>
              {access.app.status === "active"
                ? "运行中"
                : "运行中（等待平台开放）"}
            </option>
            <option value="coming_soon">建设中</option>
            <option value="hidden">隐藏</option>
          </select>
          <span id="application-status-help" className="app-muted-text block leading-5">
            “建设中”保留入口提示，“隐藏”会从普通用户入口移除。
          </span>
          {formState.fieldErrors?.status && (
            <span id="application-status-error" className="block text-[var(--status-danger)]" role="alert">
              {formState.fieldErrors.status}
            </span>
          )}
        </label>
        <label className="flex items-start gap-3 border p-3 text-xs">
          <input
            type="checkbox"
            name="is_enabled"
            defaultChecked={access.availability.enabled}
            className="mt-0.5 size-4 accent-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          />
          <span>
            <span className="block font-semibold">允许当前机构使用此应用</span>
            <span className="app-muted-text mt-1 block leading-5">
              关闭后学生和普通员工不能进入；已有学习事实与授权记录不会删除。
            </span>
          </span>
        </label>
        <button type="submit" disabled={isPending} className="inline-flex min-h-10 items-center justify-center bg-[var(--primary)] px-4 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
          {isPending ? "正在保存…" : "保存应用设置"}
        </button>
        {formState.status !== "idle" && !formState.fieldErrors && (
          <p
            className={formState.status === "error" ? "text-xs text-[var(--status-danger)]" : "text-xs text-[var(--status-success)]"}
            role={formState.status === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {formState.message}
          </p>
        )}
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
