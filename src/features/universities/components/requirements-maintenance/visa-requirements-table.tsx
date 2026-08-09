"use client";

import { useMemo, useState } from "react";

import {
  UNIVERSITY_VISA_TYPES,
  type UniversityVisaStage,
  type UniversityVisaType,
} from "../../api/types";
import {
  UNIVERSITY_VISA_STAGE_LABELS,
  UNIVERSITY_VISA_TYPE_LABELS,
} from "../../constants/university-options";
import { getVisaRequirementColumns } from "./columns";
import { RequirementDataTable } from "./requirement-data-table";
import { RequirementTableToolbar } from "./requirement-table-toolbar";
import type {
  RequirementUniversityOption,
  UniversityVisaRequirementDisplayRow,
} from "./types";

const COLUMN_LABELS: Record<string, string> = {
  universityName: "大学",
  title: "要求名称",
  stage: "办理环节",
  applicable_scopes: "适用阶段",
  description: "说明",
  sort_order: "顺序",
};

export function VisaRequirementsTable({
  data,
  universities,
  canManageContent,
}: {
  data: UniversityVisaRequirementDisplayRow[];
  universities: RequirementUniversityOption[];
  canManageContent: boolean;
}) {
  const [activeVisaType, setActiveVisaType] =
    useState<UniversityVisaType>("d4_language");
  const [query, setQuery] = useState("");
  const [universityId, setUniversityId] = useState("all");
  const [stage, setStage] = useState<"all" | UniversityVisaStage>("all");
  const columns = useMemo(
    () => getVisaRequirementColumns(canManageContent),
    [canManageContent],
  );
  const groups = useMemo(
    () =>
      UNIVERSITY_VISA_TYPES.map((visaType) => ({
        value: visaType,
        label: UNIVERSITY_VISA_TYPE_LABELS[visaType],
        count: data.filter((requirement) => requirement.visa_type === visaType)
          .length,
      })),
    [data],
  );
  const filteredData = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((requirement) => {
      if (requirement.visa_type !== activeVisaType) return false;
      if (universityId !== "all" && requirement.university_id !== universityId) {
        return false;
      }
      if (stage !== "all" && requirement.stage !== stage) return false;
      if (!keyword) return true;
      return `${requirement.universityName} ${requirement.universityNameKo} ${requirement.title} ${requirement.description ?? ""}`
        .toLocaleLowerCase("zh-CN")
        .includes(keyword);
    });
  }, [activeVisaType, data, query, stage, universityId]);

  return (
    <RequirementDataTable
      key={activeVisaType}
      data={filteredData}
      columns={columns}
      columnLabels={COLUMN_LABELS}
      initialSorting={[
        { id: "universityName", desc: false },
        { id: "sort_order", desc: false },
      ]}
      emptyContent="当前签证类型没有符合条件的要求"
      tableClassName="min-w-[1360px]"
      renderToolbar={(viewOptions) => (
        <RequirementTableToolbar
          groups={groups}
          activeGroup={activeVisaType}
          onGroupChange={(value) => setActiveVisaType(value as UniversityVisaType)}
          query={query}
          onQueryChange={setQuery}
          universityId={universityId}
          onUniversityChange={setUniversityId}
          universities={universities}
          secondaryLabel="办理环节"
          secondaryValue={stage}
          onSecondaryChange={(value) =>
            setStage(value as "all" | UniversityVisaStage)
          }
          secondaryOptions={Object.entries(UNIVERSITY_VISA_STAGE_LABELS).map(
            ([value, label]) => ({ value, label }),
          )}
          onClear={() => {
            setQuery("");
            setUniversityId("all");
            setStage("all");
          }}
          viewOptions={viewOptions}
        />
      )}
    />
  );
}
