"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  initialPracticeRecommendationActionState,
} from "./action-state";
import {
  recommendStudentPracticeAction,
  type PracticeRecommendationTarget,
} from "./actions";

export function PracticeRecommendationButton({
  studentId,
  target,
  label,
  disabled = false,
}: {
  studentId: string;
  target: PracticeRecommendationTarget;
  label: string;
  disabled?: boolean;
}) {
  const action = recommendStudentPracticeAction.bind(null, studentId, target);
  const [state, formAction, pending] = useActionState(
    action,
    initialPracticeRecommendationActionState,
  );

  return (
    <form action={formAction} className="min-w-0">
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={disabled || pending}
        className="min-h-11 w-full justify-center whitespace-normal sm:w-auto"
      >
        <Send aria-hidden="true" />
        {pending ? "正在发送…" : label}
      </Button>
      {state.message && (
        <p
          className={`mt-2 max-w-sm text-xs leading-5 ${
            state.status === "error"
              ? "text-[var(--status-danger)]"
              : "text-[var(--status-success)]"
          }`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
