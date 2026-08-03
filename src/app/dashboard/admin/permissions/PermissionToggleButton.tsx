"use client";

import { Check, LoaderCircle, X } from "lucide-react";
import { useFormStatus } from "react-dom";

export function PermissionToggleButton({
  enabled,
  disabled = false,
  label,
}: {
  enabled: boolean;
  disabled?: boolean;
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      title={
        disabled
          ? `${label}当前不可更改`
          : enabled
            ? `收回${label}权限`
            : `授予${label}权限`
      }
      aria-label={
        enabled ? `收回${label}权限` : `授予${label}权限`
      }
      className="mx-auto flex h-8 min-w-14 items-center justify-center gap-1 rounded-full border px-2 text-[11px] font-black transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
      style={
        enabled
          ? {
              color: "var(--app-success)",
              backgroundColor: "var(--app-success-soft)",
              borderColor: "var(--app-success)",
            }
          : {
              color: "var(--app-muted)",
              backgroundColor: "var(--app-soft-bg)",
              borderColor: "var(--app-border)",
            }
      }
    >
      {pending ? (
        <LoaderCircle className="animate-spin" size={13} />
      ) : enabled ? (
        <Check size={13} />
      ) : (
        <X size={13} />
      )}
      {pending ? "保存" : enabled ? "允许" : "禁止"}
    </button>
  );
}
