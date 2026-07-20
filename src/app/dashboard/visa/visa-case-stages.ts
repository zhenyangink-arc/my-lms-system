export type VisaApplicationChannel = "china_consulate" | "korea_immigration";

export const VISA_CASE_STAGES: Record<VisaApplicationChannel, ReadonlyArray<{ status: string; label: string }>> = {
  china_consulate: [
    { status: "admin_preparing", label: "管理员准备中" },
    { status: "ready_to_submit", label: "材料发送回中国" },
    { status: "planning", label: "材料抵达中国" },
    { status: "preparing", label: "学生确认材料" },
    { status: "submitted", label: "递交签证申请" },
    { status: "additional_documents", label: "是否补充材料" },
    { status: "issued", label: "签证签发" },
  ],
  korea_immigration: [
    { status: "admin_preparing", label: "管理员准备中" },
    { status: "ready_to_submit", label: "返签证发送回中国" },
    { status: "planning", label: "材料抵达中国" },
    { status: "preparing", label: "学生确认材料" },
    { status: "submitted", label: "提交领取签证申请" },
    { status: "issued", label: "签证签发" },
  ],
};

export function getVisaCaseStages(channel: string) {
  return VISA_CASE_STAGES[channel as VisaApplicationChannel] ?? VISA_CASE_STAGES.china_consulate;
}

export function getVisaCaseStatusLabel(channel: string, status: string) {
  return getVisaCaseStages(channel).find((stage) => stage.status === status)?.label ?? status;
}
