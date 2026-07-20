"use client";

import { CheckCircle2, Clock3, MinusCircle } from "lucide-react";

const STATUS_META = {
  preparing: { label: "准备中", Icon: Clock3, color: "var(--app-secondary)", soft: "var(--app-secondary-soft)", border: "var(--app-secondary)" },
  completed: { label: "已完成", Icon: CheckCircle2, color: "var(--app-success)", soft: "var(--app-success-soft)", border: "var(--app-success)" },
  not_needed: { label: "无", Icon: MinusCircle, color: "var(--app-muted)", soft: "var(--app-soft-bg)", border: "var(--app-border)" },
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
      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-black transition hover:-translate-y-0.5 disabled:cursor-default disabled:translate-y-0 disabled:opacity-70"
      style={{
        color: active ? meta.color : "var(--app-muted)",
        backgroundColor: active ? meta.soft : "var(--app-card-bg)",
        borderColor: active ? meta.border : "var(--app-border)",
      }}
    >
      <meta.Icon size={14} />
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
