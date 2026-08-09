import type {
  LearningRecordNote,
  LearningRecordOverviewRow,
} from "../../api/types";

export type StudentLearningRecordTableRow = LearningRecordOverviewRow & {
  notes: LearningRecordNote[];
};

export type StudentLearningRecordFilters = {
  query: string;
  activity: "all" | "learning" | "pending" | "attention";
};
