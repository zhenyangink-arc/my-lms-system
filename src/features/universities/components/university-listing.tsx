import {
  ManagementMetricStrip,
  ManagementNotice,
} from "@/components/layout/management-page";
import { getUniversityManagementData } from "../api/service";
import { CreateUniversityDialog } from "./university-action-dialogs";
import type {
  RequirementUniversityOption,
  UniversityRequirementDisplayRow,
  UniversityVisaRequirementDisplayRow,
} from "./requirements-maintenance/types";
import { UniversityRequirementsWorkspace } from "./requirements-maintenance/university-requirements-workspace";
import { UniversitiesTable } from "./universities-table";

export default async function UniversityListing() {
  const result = await getUniversityManagementData();
  const universityDataAvailable = !result.universitiesError;
  const requirementDataAvailable =
    !result.requirementsError && !result.visaRequirementsError;
  const publishedCount = result.universities.filter(
    (university) => university.is_published,
  ).length;
  const featuredCount = result.universities.filter(
    (university) => university.is_featured,
  ).length;
  const regionCount = new Set(
    result.universities.map((university) => university.province),
  ).size;
  const universityById = new Map(
    result.universities.map((university) => [university.id, university]),
  );
  const universityOptions: RequirementUniversityOption[] = result.universities
    .map((university) => ({ value: university.id, label: university.name_zh }))
    .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
  const requirements: UniversityRequirementDisplayRow[] =
    result.requirements.map((requirement) => {
      const university = universityById.get(requirement.university_id);
      return {
        ...requirement,
        universityName: university?.name_zh ?? "未匹配大学",
        universityNameKo: university?.name_ko ?? "名称待确认",
        universityProvince: university?.province ?? "地区待确认",
      };
    });
  const visaRequirements: UniversityVisaRequirementDisplayRow[] =
    result.visaRequirements.map((requirement) => {
      const university = universityById.get(requirement.university_id);
      return {
        ...requirement,
        universityName: university?.name_zh ?? "未匹配大学",
        universityNameKo: university?.name_ko ?? "名称待确认",
        universityProvince: university?.province ?? "地区待确认",
      };
    });

  return (
    <div className="space-y-4">
      {result.canManageContent && (
        <div className="flex justify-end">
          <CreateUniversityDialog />
        </div>
      )}
      {result.hasError && (
        <ManagementNotice tone="warning">
          大学资料暂时无法完整读取。未成功读取的区域已隐藏，请稍后刷新重试。
        </ManagementNotice>
      )}
      {result.isInstitutionViewer && (
        <ManagementNotice>
          当前账号为只读查看范围，不能修改大学资料或发布状态。
        </ManagementNotice>
      )}

      {universityDataAvailable && (
        <ManagementMetricStrip
          label="大学资料概况"
          items={[
            {
              label: "资料范围",
              value: result.canManageContent ? "平台资料" : "可查看资料",
            },
            { label: "大学总数", value: result.universities.length },
            { label: "已发布", value: publishedCount },
            {
              label: "未发布",
              value: result.universities.length - publishedCount,
            },
            { label: "重点推荐", value: featuredCount },
            { label: "覆盖地区", value: regionCount },
          ]}
        />
      )}

      {universityDataAvailable && (
        <UniversitiesTable
          data={result.universities}
          canManageContent={result.canManageContent}
          canPermanentlyDelete={result.canPermanentlyDelete}
        />
      )}

      {universityDataAvailable && requirementDataAvailable && (
        <UniversityRequirementsWorkspace
          requirements={requirements}
          visaRequirements={visaRequirements}
          universities={universityOptions}
          canManageContent={result.canManageContent}
        />
      )}
    </div>
  );
}
