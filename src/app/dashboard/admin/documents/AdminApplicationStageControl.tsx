"use client";

import { useState, useTransition } from "react";
import { Check, CircleCheckBig } from "lucide-react";

import { APPLICATION_FINAL_STAGE, APPLICATION_STAGE_LABELS } from "@/app/dashboard/documents/constants";
import { confirmVisaApplicationChannelAction, updateApplicationStageAction } from "./actions";

const FINAL_RED = "#dc2626";
const VISA_APPLICATION_CHANNEL_OPTIONS = [
  { value: "china_consulate", label: "驻中韩国领事馆递签证通道" },
  { value: "korea_immigration", label: "韩国出入境返签证通道" },
] as const;

function stepTone(done: boolean, active: boolean, isFinal: boolean) {
  if (isFinal && active && !done) {
    return { color: "#fff", backgroundColor: FINAL_RED };
  }
  return {
    color: done || active ? "#fff" : "var(--app-muted)",
    backgroundColor: done ? "var(--app-success)" : active ? "var(--app-accent)" : "var(--app-soft-bg)",
  };
}

function labelTone(done: boolean, active: boolean, isFinal: boolean) {
  if (isFinal && active && !done) return FINAL_RED;
  if (done) return "var(--app-success)";
  if (active) return "var(--app-accent-strong)";
  return "var(--app-muted)";
}

export function AdminApplicationStageControl({
  studentId,
  targetId,
  stage,
  visaApplicationChannel,
}: {
  studentId: string;
  targetId: string;
  stage: number;
  visaApplicationChannel: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedChannel, setSelectedChannel] = useState(visaApplicationChannel ?? "");
  const channelConfirmed = visaApplicationChannel !== null;
  const channelChanged = selectedChannel !== (visaApplicationChannel ?? "");

  function handleClick(stepNumber: number) {
    // 已经点亮到这一步（或更后面）时再点一下，退回到这一步之前；否则直接点亮到这一步。
    const nextStage = stage >= stepNumber ? stepNumber - 1 : stepNumber;
    const formData = new FormData();
    formData.set("stage", String(nextStage));
    startTransition(async () => {
      await updateApplicationStageAction(studentId, targetId, formData);
    });
  }

  function handleChannelConfirm() {
    if (!selectedChannel) return;
    const formData = new FormData();
    formData.set("applicationChannel", selectedChannel);
    startTransition(async () => {
      await confirmVisaApplicationChannelAction(studentId, targetId, formData);
    });
  }

  return (
    <div>
      <div className="mb-4 rounded-2xl border p-3.5" style={{ borderColor: channelConfirmed ? "var(--app-success)" : "var(--app-border-soft)", backgroundColor: channelConfirmed ? "var(--app-success-soft)" : "var(--app-soft-bg)" }}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-black">第9步前确认签证办理方式</p>
            <p className="app-muted-text mt-1 text-xs font-bold">选择办理通道并点击确认后，才能点亮“请进入申请签证页面”。</p>
          </div>
          {channelConfirmed && (
            <span className="inline-flex items-center gap-1 text-xs font-black" style={{ color: "var(--app-success)" }}>
              <CircleCheckBig size={12} />已确认
            </span>
          )}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {VISA_APPLICATION_CHANNEL_OPTIONS.map((option) => {
            const selected = selectedChannel === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={isPending}
                aria-pressed={selected}
                onClick={() => setSelectedChannel(option.value)}
                className="rounded-xl border px-3 py-2.5 text-left text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60"
                style={selected
                  ? { color: "var(--app-accent-strong)", borderColor: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }
                  : { color: "var(--app-muted)", borderColor: "var(--app-border-soft)", backgroundColor: "var(--app-card-bg)" }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={isPending || !selectedChannel || (channelConfirmed && !channelChanged)}
          onClick={handleChannelConfirm}
          className="mt-3 rounded-xl px-4 py-2 text-xs font-black text-white transition disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: "var(--app-accent)" }}
        >
          {isPending ? "正在确认..." : channelConfirmed && !channelChanged ? "办理方式已确认" : "确认办理方式"}
        </button>
      </div>
      <p className="app-muted-text text-xs font-black">申请进程（实心圆为当前阶段，点击已点亮步骤可退回）</p>
      <div className="mt-2 grid grid-cols-9 gap-x-1.5">
        {APPLICATION_STAGE_LABELS.map((label, index) => {
          const stepNumber = index + 1;
          const done = stage >= stepNumber;
          const active = stage + 1 === stepNumber;
          const isFinal = stepNumber === APPLICATION_FINAL_STAGE;
          const requiresChannelConfirmation = isFinal && stage < APPLICATION_FINAL_STAGE && !channelConfirmed;
          return (
            <button
              key={label}
              type="button"
              disabled={isPending || requiresChannelConfirmation}
              onClick={() => handleClick(stepNumber)}
              aria-label={`${stepNumber}. ${label}`}
              aria-pressed={stage >= stepNumber}
              className="flex flex-col items-center gap-1 text-center transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black"
                style={stepTone(done, active, isFinal)}
              >
                {done ? <Check size={11} /> : stepNumber}
              </span>
              <p
                className="text-[10px] leading-3"
                style={{
                  color: labelTone(done, active, isFinal),
                  fontWeight: active || done ? 900 : 700,
                }}
              >
                {label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
