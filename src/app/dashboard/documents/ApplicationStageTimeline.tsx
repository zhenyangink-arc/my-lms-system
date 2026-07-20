import { Check } from "lucide-react";

import { APPLICATION_FINAL_STAGE, APPLICATION_STAGE_LABELS } from "./constants";

const FINAL_RED = "#dc2626";

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

function HorizontalStageTimeline({ stage }: { stage: number }) {
  const currentLabel = stage >= 1 && stage <= APPLICATION_STAGE_LABELS.length ? APPLICATION_STAGE_LABELS[stage - 1] : "尚未提交";
  const currentIsFinal = stage === APPLICATION_FINAL_STAGE;

  return (
    <div>
      <p className="app-muted-text text-xs font-black">申请进程</p>
      <div className="mt-2 flex items-center">
        {APPLICATION_STAGE_LABELS.map((label, index) => {
          const stepNumber = index + 1;
          const done = stage >= stepNumber;
          const active = stage + 1 === stepNumber;
          const isFinal = stepNumber === APPLICATION_FINAL_STAGE;
          return (
            <div key={label} className={`flex items-center ${index < APPLICATION_STAGE_LABELS.length - 1 ? "flex-1" : ""}`}>
              <span
                title={label}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                style={stepTone(done, active, isFinal)}
              >
                {done ? <Check size={10} /> : stepNumber}
              </span>
              {index < APPLICATION_STAGE_LABELS.length - 1 && (
                <span className="mx-1 h-0.5 flex-1 rounded-full" style={{ backgroundColor: done ? "var(--app-success)" : "var(--app-soft-bg)" }} />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs font-black" style={{ color: stage >= 1 ? labelTone(false, true, currentIsFinal) : "var(--app-muted)" }}>
        {stage >= 1 ? `${stage}. ${currentLabel}` : currentLabel}
      </p>
    </div>
  );
}

function VerticalStageTimeline({ stage }: { stage: number }) {
  return (
    <div className="space-y-2.5">
      <p className="app-muted-text text-xs font-black">申请进程</p>
      {APPLICATION_STAGE_LABELS.map((label, index) => {
        const stepNumber = index + 1;
        const done = stage >= stepNumber;
        const active = stage + 1 === stepNumber;
        const isFinal = stepNumber === APPLICATION_FINAL_STAGE;
        return (
          <div key={label} className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black" style={stepTone(done, active, isFinal)}>
              {done ? <Check size={11} /> : stepNumber}
            </span>
            <p
              className="text-xs leading-4"
              style={{
                color: labelTone(done, active, isFinal),
                fontWeight: active || done ? 900 : 700,
              }}
            >
              {label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function GridStageTimeline({ stage }: { stage: number }) {
  return (
    <div>
      <p className="app-muted-text text-xs font-black">申请进程</p>
      <div className="mt-2 grid grid-cols-5 gap-x-2 gap-y-3">
        {APPLICATION_STAGE_LABELS.map((label, index) => {
          const stepNumber = index + 1;
          const done = stage >= stepNumber;
          const active = stage + 1 === stepNumber;
          const isFinal = stepNumber === APPLICATION_FINAL_STAGE;
          return (
            <div key={label} className="flex flex-col items-center gap-1 text-center">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                style={stepTone(done, active, isFinal)}
              >
                {done ? <Check size={10} /> : stepNumber}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ApplicationStageTimeline({
  stage,
  layout = "vertical",
}: {
  stage: number;
  layout?: "vertical" | "horizontal" | "grid";
}) {
  if (layout === "horizontal") return <HorizontalStageTimeline stage={stage} />;
  if (layout === "grid") return <GridStageTimeline stage={stage} />;
  return <VerticalStageTimeline stage={stage} />;
}
