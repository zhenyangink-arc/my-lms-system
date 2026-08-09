"use client";

import { useMemo, useState } from "react";

import {
  UNIVERSITY_ADMISSION_STAGES,
  type UniversityAdmissionStage,
  type UniversityDocumentCategory,
} from "../../api/types";
import {
  UNIVERSITY_ADMISSION_STAGE_LABELS,
  UNIVERSITY_DOCUMENT_CATEGORY_LABELS,
} from "../../constants/university-options";
import { applicationRequirementColumns } from "./columns";
import { RequirementDataTable } from "./requirement-data-table";
import { RequirementTableToolbar } from "./requirement-table-toolbar";
import type {
  RequirementUniversityOption,
  UniversityRequirementDisplayRow,
} from "./types";

const COLUMN_LABELS: Record<string, string> = {
  universityName: "大学",
  title: "要求名称",
  category: "材料分类",
  description: "说明",
  sort_order: "顺序",
};

export function ApplicationRequirementsTable({
  data,
  universities,
}: {
  data: UniversityRequirementDisplayRow[];
  universities: RequirementUniversityOption[];
}) {
  const [activeStage, setActiveStage] =
    useState<UniversityAdmissionStage>("language");
  const [query, setQuery] = useState("");
  const [universityId, setUniversityId] = useState("all");
  const [category, setCategory] = useState<"all" | UniversityDocumentCategory>(
    "all",
  );
  const groups = useMemo(
    () =>
      UNIVERSITY_ADMISSION_STAGES.map((stage) => ({
        value: stage,
        label: UNIVERSITY_ADMISSION_STAGE_LABELS[stage],
        count: data.filter((requirement) => requirement.admission_stage === stage)
          .length,
      })),
    [data],
  );
  const filteredData = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((requirement) => {
      if (requirement.admission_stage !== activeStage) return false;
      if (universityId !== "all" && requirement.university_id !== universityId) {
        return false;
      }
      if (category !== "all" && requirement.category !== category) return false;
      if (!keyword) return true;
      return `${requirement.universityName} ${requirement.universityNameKo} ${requirement.title} ${requirement.description ?? ""}`
        .toLocaleLowerCase("zh-CN")
        .includes(keyword);
    });
  }, [activeStage, category, data, query, universityId]);

  return (
    <RequirementDataTable
      key={activeStage}
      data={filteredData}
      columns={applicationRequirementColumns}
      columnLabels={COLUMN_LABELS}
      initialSorting={[
        { id: "universityName", desc: false },
        { id: "sort_order", desc: false },
      ]}
      emptyContent="当前申请阶段没有符合条件的要求"
      tableClassName="min-w-[1180px]"
      renderToolbar={(viewOptions) => (
        <RequirementTableToolbar
          groups={groups}
          activeGroup={activeStage}
          onGroupChange={(value) =>
            setActiveStage(value as UniversityAdmissionStage)
          }
          query={query}
          onQueryChange={setQuery}
          universityId={universityId}
          onUniversityChange={setUniversityId}
          universities={universities}
          secondaryLabel="材料分类"
          secondaryValue={category}
          onSecondaryChange={(value) =>
            setCategory(value as "all" | UniversityDocumentCategory)
          }
          secondaryOptions={Object.entries(
            UNIVERSITY_DOCUMENT_CATEGORY_LABELS,
          ).map(([value, label]) => ({ value, label }))}
          onClear={() => {
            setQuery("");
            setUniversityId("all");
            setCategory("all");
          }}
          viewOptions={viewOptions}
        />
      )}
    />
  );
}
