"use client";

import { CheckCircle2, Clock3, MinusCircle } from "lucide-react";

const STATUS_META = {
  preparing: { label: "准备中", Icon: Clock3, color: "var(--support)", soft: "var(--support-surface)", border: "var(--support)" },
  completed: { label: "已完成", Icon: CheckCircle2, color: "var(--status-success)", soft: "var(--status-success-surface)", border: "var(--status-success)" },
  not_needed: { label: "无", Icon: MinusCircle, color: "var(--foreground-muted)", soft: "var(--surface-soft)", border: "var(--border)" },
} as const;

type Status = keyof typeof STATUS_META;

function StatusButton({
  value,
  currentStatus,
  disabled,
  onSelect,
}: {
  value: Status;
  currentStatus: string;
  disabled?: boolean;
  onSelect: (value: Status) => void;
}) {
  const active = currentStatus === value;
  const meta = STATUS_META[value];

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      disabled={active || disabled}
      aria-pressed={active}
      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-default disabled:translate-y-0 disabled:opacity-70"
      style={{
        color: active ? meta.color : "var(--foreground-muted)",
        backgroundColor: active ? meta.soft : "var(--card)",
        borderColor: active ? meta.border : "var(--border)",
      }}
    >
      <meta.Icon size={14} aria-hidden="true" />
      {meta.label}
    </button>
  );
}

export function ApplicationDocumentForm({
  currentStatus,
  disabled,
  onChange,
}: {
  currentStatus: string;
  disabled?: boolean;
  onChange: (status: Status) => void;
}) {
  return (
    <div className="flex gap-2">
      <StatusButton value="preparing" currentStatus={currentStatus} disabled={disabled} onSelect={onChange} />
      <StatusButton value="completed" currentStatus={currentStatus} disabled={disabled} onSelect={onChange} />
      <StatusButton value="not_needed" currentStatus={currentStatus} disabled={disabled} onSelect={onChange} />
    </div>
  );
}
