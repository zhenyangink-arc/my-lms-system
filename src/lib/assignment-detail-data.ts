import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

export type AssignmentDetailRow = {
  id: string;
  title: string;
  description: string;
  institution_note: string;
  assignment_type: "homework" | "quiz" | "exam";
  total_points: number;
  starts_at: string;
  due_at: string;
  duration_minutes: number | null;
  allow_resubmission: boolean;
  source_paper_code: string | null;
  source_paper_version: number | null;
  status: "draft" | "published" | "closed";
  student_app_id: string;
};

/**
 * Layout and page render in parallel, so they share this request-scoped lookup.
 * tenantKey participates in the memoization key; tenant isolation remains
 * enforced by the authenticated Supabase client and RLS.
 */
export const getAssignmentDetail = cache(
  async (
    supabase: SupabaseClient,
    tenantKey: string,
    studentAppId: string,
    assignmentId: string,
  ) => {
    void tenantKey;
    const result = await supabase
      .from("learning_assignments")
      .select(
        "id,title,description,institution_note,assignment_type,total_points,starts_at,due_at,duration_minutes,allow_resubmission,source_paper_code,source_paper_version,status,student_app_id",
      )
      .eq("id", assignmentId)
      .eq("student_app_id", studentAppId)
      .maybeSingle();

    return {
      data: result.data as AssignmentDetailRow | null,
      error: result.error,
    };
  },
);
