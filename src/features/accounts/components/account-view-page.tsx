import Link from "next/link";
import type { ReactNode } from "react";
import { UserRound } from "lucide-react";

import { AccountManagementActions } from "@/app/dashboard/admin/accounts/AccountCard";
import { LocalDateTime } from "@/components/LocalDateTime";
import {
  ManagementMetricStrip,
  ManagementPage,
} from "@/components/layout/management-page";
import { getDashboardBasePath, scopeDashboardPath } from "@/lib/dashboard-path";
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import { getAccountDetail } from "../api/service";
import { ROLE_LABELS, STATUS_LABELS } from "../constants/account-options";
import { AccountDetailActivityDialog } from "./account-activity-dialogs";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = { ...DATE_OPTIONS, hour: "2-digit", minute: "2-digit", hour12: false };

const EDUCATION_LABELS: Record<string, string> = {
  bachelor: "本科",
  college: "大专",
  high_school: "高中",
  secondary_vocational: "中专",
  technical_school: "技工学校",
};

const EDUCATION_STATUS_LABELS: Record<string, string> = {
  graduated: "已毕业",
  studying: "在读",
};

const ABILITY_LABELS: Record<string, string> = {
  A1: "第一级",
  A2: "第二级",
  B1: "第三级",
  B2: "第四级",
  C1: "第五级",
  C2: "第六级",
};

export default async function AccountViewPage({ profileId }: { profileId: string }) {
  const result = await getAccountDetail(profileId);
  const { profile } = result;
  const actorNames = Object.fromEntries(result.actorNames);
  const lowerEducation = ["high_school", "secondary_vocational", "technical_school"].includes(profile.education_level ?? "");
  const dashboardBasePath = getDashboardBasePath();
  const roleLabel = ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] ?? profile.role;
  const statusLabel = STATUS_LABELS[profile.status] ?? profile.status;

  return (
    <ManagementPage
      eyebrow="账号详情"
      title={result.displayName}
      description="查看账号基础资料、教育与能力信息、状态时间线，以及当前管理范围内的操作记录。"
      icon={UserRound}
      meta={
        <>
          <span>{roleLabel}</span>
          <span>{statusLabel}</span>
        </>
      }
      action={
        <>
          <Link
            href={scopeDashboardPath("/dashboard/admin/accounts", dashboardBasePath)}
            className="management-secondary-button inline-flex items-center border px-3 text-xs font-semibold"
          >
            返回账号管理
          </Link>
        <AccountManagementActions profile={profile} viewerRole={result.viewerRole} accountScope={result.scope} />
        </>
      }
    >

      <ManagementMetricStrip
        label="账号概况"
        items={[
          {
            label: "登录账号",
            value: (
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className="size-8 shrink-0 rounded-full bg-[var(--app-accent-soft)] bg-cover bg-center text-center text-xs leading-8 text-[var(--app-accent)]"
                  style={
                    result.avatarUrl
                      ? {
                          backgroundImage: `url(${result.avatarUrl})`,
                          color: "transparent",
                        }
                      : undefined
                  }
                >
                  {result.displayName.slice(0, 1)}
                </span>
                <span className="truncate text-sm">
                  {profile.login_id ||
                    profile.email ||
                    `账号 …${profile.id.slice(-8)}`}
                </span>
              </span>
            ),
          },
          { label: "角色", value: roleLabel },
          { label: "状态", value: statusLabel },
          {
            label: "会员档位",
            value:
              profile.role === "student"
                ? MEMBERSHIP_TIER_LABELS[
                    normalizeMembershipTier(profile.membership_tier)
                  ]
                : "—",
          },
          { label: "资料完成度", value: `${result.completionPercent}%` },
        ]}
      />

      <TableSection title="基本信息" minWidth="900px">
        <thead><tr><HeaderCell>电子邮箱</HeaderCell><HeaderCell>性别</HeaderCell><HeaderCell>出生日期</HeaderCell><HeaderCell>所在地区</HeaderCell><HeaderCell>工作经历</HeaderCell></tr></thead>
        <tbody><tr>
          <DataCell>{profile.email || "尚未同步"}</DataCell>
          <DataCell>{profile.gender === "male" ? "男" : profile.gender === "female" ? "女" : "未填写"}</DataCell>
          <DataCell><LocalDateTime value={profile.birth_date} options={DATE_OPTIONS} fallback="未填写" /></DataCell>
          <DataCell>{[profile.address_province, profile.address_city].filter(Boolean).join(" ") || "未填写"}</DataCell>
          <DataCell>{profile.has_work_experience === null ? "未填写" : profile.has_work_experience ? "有工作经历" : "暂无工作经历"}</DataCell>
        </tr></tbody>
      </TableSection>

      <TableSection title="教育与成绩" minWidth="940px">
        <thead><tr><HeaderCell>教育阶段</HeaderCell><HeaderCell>就读状态</HeaderCell><HeaderCell>{profile.education_status === "graduated" ? "毕业时间" : "预计毕业时间"}</HeaderCell><HeaderCell>平均成绩</HeaderCell><HeaderCell>高考成绩</HeaderCell></tr></thead>
        <tbody><tr>
          <DataCell>{EDUCATION_LABELS[profile.education_level ?? ""] ?? "未填写"}</DataCell>
          <DataCell>{EDUCATION_STATUS_LABELS[profile.education_status ?? ""] ?? "未填写"}</DataCell>
          <DataCell><LocalDateTime value={profile.education_completion_month} options={DATE_OPTIONS} fallback="未填写" /></DataCell>
          <DataCell>{profile.academic_average === null ? "未填写" : `${profile.academic_average} 分`}</DataCell>
          <DataCell>{!lowerEducation ? "不适用" : profile.gaokao_has_score ? `${profile.gaokao_score ?? "待填写"} 分` : profile.gaokao_has_score === false ? "无高考成绩" : "未填写"}</DataCell>
        </tr></tbody>
      </TableSection>

      <TableSection title="能力评估" minWidth="720px">
        <thead><tr><HeaderCell>英语能力</HeaderCell><HeaderCell>数学能力</HeaderCell><HeaderCell>韩语能力</HeaderCell></tr></thead>
        <tbody><tr>
          <DataCell>{ABILITY_LABELS[profile.english_level ?? ""] || "未评估"}</DataCell>
          <DataCell>{ABILITY_LABELS[profile.math_level ?? ""] || "未评估"}</DataCell>
          <DataCell>{profile.has_korean ? `韩国语能力考试 ${profile.topik_level ?? "待填写"} 级` : profile.has_korean === false ? "暂无基础" : "未评估"}</DataCell>
        </tr></tbody>
      </TableSection>

      <TableSection title="账号时间线" minWidth="960px">
        <thead><tr><HeaderCell>注册时间</HeaderCell><HeaderCell>最近更新</HeaderCell><HeaderCell>最近活跃</HeaderCell><HeaderCell>注册来源</HeaderCell><HeaderCell>状态原因</HeaderCell></tr></thead>
        <tbody><tr>
          <DataCell><LocalDateTime value={profile.registered_at || profile.created_at} options={DATE_TIME_OPTIONS} /></DataCell>
          <DataCell><LocalDateTime value={profile.updated_at} options={DATE_TIME_OPTIONS} fallback="暂无记录" /></DataCell>
          <DataCell><LocalDateTime value={profile.last_active_at} options={DATE_TIME_OPTIONS} fallback="暂无记录" /></DataCell>
          <DataCell>{profile.registration_source === "email" ? "邮箱注册" : profile.registration_source || "未知来源"}</DataCell>
          <DataCell>{profile.deactivate_reason || "—"}</DataCell>
        </tr></tbody>
      </TableSection>

      <div className="flex justify-end">
        <AccountDetailActivityDialog logs={result.auditLogs} actorNames={actorNames} />
      </div>
    </ManagementPage>
  );
}

function TableSection({ title, minWidth, children }: { title?: string; minWidth: string; children: ReactNode }) {
  return (
    <section className="management-table-panel overflow-hidden border">
      {title && <div className="border-b border-[var(--app-border)] px-4 py-3 text-sm font-semibold text-[var(--app-text)]">{title}</div>}
      <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-xs" style={{ minWidth }}>{children}</table></div>
    </section>
  );
}

function HeaderCell({ children }: { children: ReactNode }) {
  return <th className="border-b border-[var(--app-border)] bg-[var(--app-soft-bg)] px-4 py-3 font-semibold text-[var(--app-text-soft)]">{children}</th>;
}

function DataCell({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return <td className={`px-4 py-4 text-[var(--app-text-soft)] ${strong ? "font-semibold text-[var(--app-text)]" : ""}`}>{children}</td>;
}
