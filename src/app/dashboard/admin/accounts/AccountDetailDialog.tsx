"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LocalDateTime } from "@/components/LocalDateTime";
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import type { AccountListProfile } from "./AccountCard";
import {
  getAccountDetailAction,
  type AccountDetailAuditLog,
  type AccountDetailResult,
} from "./actions";
import { ROLE_LABELS, STATUS_LABELS } from "./permissions";

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

const ACTION_LABELS: Record<string, string> = {
  account_created: "账号创建",
  role_changed: "角色调整",
  status_changed: "状态调整",
  membership_changed: "会员档位调整",
  profile_updated: "资料更新",
};

const FIELD_LABELS: Record<string, string> = {
  full_name: "姓名",
  email: "邮箱",
  role: "角色",
  status: "状态",
  membership_tier: "会员档位",
  created_at: "注册信息",
};

const ABILITY_LABELS: Record<string, string> = {
  A1: "第一级",
  A2: "第二级",
  B1: "第三级",
  B2: "第四级",
  C1: "第五级",
  C2: "第六级",
};

const PROFILE_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
const PROFILE_DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };

function FormattedProfileDate({ value, includeTime = false }: { value: string | null; includeTime?: boolean }) {
  return (
    <LocalDateTime
      value={value}
      options={includeTime ? PROFILE_DATE_TIME_OPTIONS : PROFILE_DATE_OPTIONS}
      fallback="暂无记录"
    />
  );
}

/**
 * 极简两列表格：字段名在左、值在右，每条记录一行；
 * 外框 + 单元格竖线 + 行间分割线，表头带底色区分。
 */
function PropertyTable({
  headerLabel = "字段",
  headerValue = "内容",
  rows,
}: {
  headerLabel?: string;
  headerValue?: string;
  rows: { label: string; value: ReactNode }[];
}) {
  return (
    <div className="w-full overflow-hidden rounded-md border" style={{ borderColor: "var(--app-border)" }}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="app-muted-text bg-[var(--app-soft-bg)]">
            <th className="w-36 border-b px-4 py-2 text-xs font-medium" style={{ borderColor: "var(--app-border)" }}>{headerLabel}</th>
            <th className="border-b border-l px-4 py-2 text-xs font-medium" style={{ borderColor: "var(--app-border)" }}>{headerValue}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
              <td className="app-muted-text w-36 px-4 py-2.5 text-xs">{row.label}</td>
              <td className="border-l px-4 py-2.5 text-[13px] font-medium" style={{ borderColor: "var(--app-border)" }}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTable({ auditLogs, actorNames }: { auditLogs: AccountDetailAuditLog[]; actorNames: Record<string, string> }) {
  return (
    <div className="w-full overflow-hidden rounded-md border" style={{ borderColor: "var(--app-border)" }}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="app-muted-text bg-[var(--app-soft-bg)]">
            <th className="border-b px-4 py-2 text-xs font-medium" style={{ borderColor: "var(--app-border)" }}>时间</th>
            <th className="border-b border-l px-4 py-2 text-xs font-medium" style={{ borderColor: "var(--app-border)" }}>操作</th>
            <th className="border-b border-l px-4 py-2 text-xs font-medium" style={{ borderColor: "var(--app-border)" }}>操作人</th>
            <th className="border-b border-l px-4 py-2 text-xs font-medium" style={{ borderColor: "var(--app-border)" }}>变更内容</th>
          </tr>
        </thead>
        <tbody>
          {auditLogs.map((log) => (
            <tr key={log.id} className="border-b last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
              <td className="app-muted-text px-4 py-2.5 whitespace-nowrap text-xs tabular-nums">
                <FormattedProfileDate value={log.created_at} includeTime />
              </td>
              <td className="border-l px-4 py-2.5 text-xs font-medium" style={{ borderColor: "var(--app-border)" }}>{ACTION_LABELS[log.action] ?? "账号更新"}</td>
              <td className="border-l px-4 py-2.5 text-xs" style={{ borderColor: "var(--app-border)" }}>{actorNames[log.actor_id ?? ""] ?? "系统管理员"}</td>
              <td className="app-muted-text border-l px-4 py-2.5 text-xs" style={{ borderColor: "var(--app-border)" }}>
                {(log.changed_fields ?? []).map((field) => FIELD_LABELS[field] ?? field).join("、") || "系统记录"}
              </td>
            </tr>
          ))}
          {auditLogs.length === 0 && (
            <tr>
              <td colSpan={4} className="app-muted-text px-4 py-10 text-center text-xs">暂无账号变更记录</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function GroupTitle({ children }: { children: ReactNode }) {
  return <p className="app-muted-text pt-4 pb-1 text-xs font-semibold">{children}</p>;
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm">
      <Loader2 className="animate-spin" size={18} style={{ color: "var(--app-muted-text)" }} />
      <p className="app-muted-text text-xs">正在加载账号档案…</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-xs font-medium">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border px-3 py-1.5 text-xs transition hover:bg-black/[0.035]"
        style={{ borderColor: "var(--app-border)" }}
      >
        重试
      </button>
    </div>
  );
}

function AccountDetailBody({ detail }: { detail: Extract<AccountDetailResult, { ok: true }> }) {
  // 后台成员（老师/管理员/负责人等）展示 staff_profiles 人事信息，不展示学生档案字段。
  if (detail.profile.role !== "student") {
    return <StaffAccountDetailBody detail={detail} />;
  }
  return <StudentAccountDetailBody detail={detail} />;
}

function StaffAccountDetailBody({ detail }: { detail: Extract<AccountDetailResult, { ok: true }> }) {
  const { profile, auditLogs, actorNames, staffProfile } = detail;
  const displayName = profile.full_name || "未填写姓名";
  const staff = staffProfile ?? null;

  return (
    <div className="p-5 pb-4">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div>
          <GroupTitle>基本信息</GroupTitle>
          <PropertyTable
            rows={[
              { label: "真实姓名", value: displayName },
              { label: "登录账号", value: profile.login_id || profile.email || "—" },
              { label: "电子邮箱", value: profile.email || "尚未同步" },
              { label: "角色", value: ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] ?? profile.role },
              { label: "状态", value: STATUS_LABELS[profile.status] ?? profile.status },
              { label: "性别", value: staff?.gender === "male" ? "男" : staff?.gender === "female" ? "女" : "未填写" },
              { label: "出生日期", value: <FormattedProfileDate value={staff?.birth_date ?? null} /> },
              { label: "入职时间", value: <FormattedProfileDate value={staff?.hired_at ?? null} /> },
            ]}
          />

          <GroupTitle>账号时间线</GroupTitle>
          <PropertyTable
            rows={[
              { label: "注册时间", value: <FormattedProfileDate value={profile.registered_at || profile.created_at} includeTime /> },
              { label: "最近更新", value: <FormattedProfileDate value={profile.updated_at} includeTime /> },
              { label: "最近活跃", value: <FormattedProfileDate value={profile.last_active_at} includeTime /> },
              { label: "注册来源", value: profile.registration_source === "email" ? "邮箱注册" : profile.registration_source || "未知来源" },
              ...(profile.status !== "active" && profile.deactivate_reason
                ? [{ label: "状态原因", value: profile.deactivate_reason }]
                : []),
            ]}
          />
        </div>

        <div>
          <GroupTitle>账号变更记录</GroupTitle>
          <AuditTable auditLogs={auditLogs} actorNames={actorNames} />
        </div>
      </div>
    </div>
  );
}

function StudentAccountDetailBody({ detail }: { detail: Extract<AccountDetailResult, { ok: true }> }) {
  const { profile, auditLogs, actorNames } = detail;
  const displayName = profile.full_name || "未填写姓名";

  const lowerEducation = ["high_school", "secondary_vocational", "technical_school"].includes(profile.education_level ?? "");
  const completionChecks = [
    Boolean(profile.full_name && profile.email),
    Boolean(profile.gender && profile.birth_date),
    Boolean(profile.address_province && profile.address_city),
    Boolean(profile.avatar_path),
    Boolean(profile.education_level && profile.education_status && profile.education_completion_month),
    profile.academic_average !== null,
    !lowerEducation || profile.gaokao_has_score !== null,
    Boolean(profile.english_level),
    Boolean(profile.math_level),
    profile.has_korean !== null && (!profile.has_korean || profile.topik_level !== null),
    profile.has_work_experience !== null,
  ];
  const completionPercent = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100);

  return (
    <div className="p-5 pb-4">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div>
          <GroupTitle>基本信息</GroupTitle>
          <PropertyTable
            rows={[
              { label: "真实姓名", value: displayName },
              { label: "电子邮箱", value: profile.email || "尚未同步" },
              { label: "角色", value: ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] ?? profile.role },
              { label: "状态", value: STATUS_LABELS[profile.status] ?? profile.status },
              ...(profile.role === "student"
                ? [{ label: "会员档位", value: MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(profile.membership_tier)] }]
                : []),
              { label: "资料完整度", value: `${completionPercent}%` },
              { label: "性别", value: profile.gender === "male" ? "男" : profile.gender === "female" ? "女" : "未填写" },
              { label: "出生日期", value: <FormattedProfileDate value={profile.birth_date} /> },
              { label: "所在地区", value: profile.address_province && profile.address_city ? `${profile.address_province} · ${profile.address_city}` : "未填写" },
              { label: "工作经历", value: profile.has_work_experience === null ? "未填写" : profile.has_work_experience ? "有工作经历" : "暂无工作经历" },
            ]}
          />

          <GroupTitle>账号时间线</GroupTitle>
          <PropertyTable
            rows={[
              { label: "注册时间", value: <FormattedProfileDate value={profile.registered_at || profile.created_at} includeTime /> },
              { label: "最近更新", value: <FormattedProfileDate value={profile.updated_at} includeTime /> },
              { label: "最近活跃", value: <FormattedProfileDate value={profile.last_active_at} includeTime /> },
              { label: "注册来源", value: profile.registration_source === "email" ? "邮箱注册" : profile.registration_source || "未知来源" },
              ...(profile.status !== "active" && profile.deactivate_reason
                ? [{ label: "状态原因", value: profile.deactivate_reason }]
                : []),
            ]}
          />
        </div>

        <div>
          <GroupTitle>教育与成绩</GroupTitle>
          <PropertyTable
            rows={[
              { label: "教育阶段", value: EDUCATION_LABELS[profile.education_level ?? ""] ?? "未填写" },
              { label: "就读状态", value: EDUCATION_STATUS_LABELS[profile.education_status ?? ""] ?? "未填写" },
              { label: profile.education_status === "graduated" ? "毕业时间" : "预计毕业时间", value: <FormattedProfileDate value={profile.education_completion_month} /> },
              { label: "平均成绩", value: profile.academic_average === null ? "未填写" : `${profile.academic_average} 分` },
              ...(lowerEducation
                ? [{ label: "高考成绩", value: profile.gaokao_has_score ? `${profile.gaokao_score ?? "待填写"} 分` : profile.gaokao_has_score === false ? "无高考成绩" : "未填写" }]
                : []),
            ]}
          />

          <GroupTitle>能力评估</GroupTitle>
          <PropertyTable
            rows={[
              { label: "英语能力", value: ABILITY_LABELS[profile.english_level ?? ""] || "未评估" },
              { label: "数学能力", value: ABILITY_LABELS[profile.math_level ?? ""] || "未评估" },
              { label: "韩语能力", value: profile.has_korean ? `韩国语能力考试 ${profile.topik_level ?? "待填写"} 级` : profile.has_korean === false ? "暂无基础" : "未评估" },
            ]}
          />

          <GroupTitle>账号变更记录</GroupTitle>
          <AuditTable auditLogs={auditLogs} actorNames={actorNames} />
        </div>
      </div>
    </div>
  );
}

export function AccountDetailDialog({ profile }: { profile: AccountListProfile }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AccountDetailResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      setResult(await getAccountDetailAction(profile.id));
    } catch {
      setResult({ ok: false, error: "详情加载失败，请稍后重试。" });
    } finally {
      setLoading(false);
    }
  }, [profile.id]);

  const displayName = profile.full_name || profile.login_id || profile.email || "未命名账号";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <DialogTrigger
        type="button"
        className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold transition hover:bg-black/[0.035]"
      >
        详情
      </DialogTrigger>
      <DialogContent className="max-h-[min(880px,calc(100vh-32px))] w-full max-w-[1024px] gap-0 overflow-y-auto p-0 sm:max-w-[1024px]">
        <DialogHeader className="border-b px-5 py-4 pr-12 text-left" style={{ borderColor: "var(--app-border)" }}>
          <DialogTitle className="text-sm font-semibold">账号档案</DialogTitle>
          <DialogDescription className="text-xs">
            {displayName} · {profile.login_id || profile.email || `…${profile.id.slice(-8)}`}
          </DialogDescription>
        </DialogHeader>

        {loading && <LoadingState />}
        {!loading && result && result.ok === false && <ErrorState message={result.error} onRetry={() => void load()} />}
        {!loading && result && result.ok === true && <AccountDetailBody detail={result} />}
      </DialogContent>
    </Dialog>
  );
}
