import type { LibraryResourceRow } from "../../api/types";

export type LibraryResourceDisplayRow = LibraryResourceRow & {
  courseLabel: string;
  lessonLabel: string;
  groupTitle: string;
  targetLabel: string;
};
