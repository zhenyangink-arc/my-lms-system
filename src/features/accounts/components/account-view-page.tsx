import { LocalDateTime } from "@/components/LocalDateTime";
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import { getAccountDetail } from "../api/service";
import { ROLE_LABELS, STATUS_LABELS } from "../constants/account-options";
import { AccountDetailActivityDialog } from "./account-activity-dialogs";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = { ...DATE_OPTIONS, hour: "2-digit", minute: "2-digit", hour12: false };

export default async function AccountViewPage({ profileId }: { profileId: string }) {
  const result = await getAccountDetail(profileId);
  const { profile } = result;
  const actorNames = Object.fromEntries(result.actorNames);

  return (
    <div className="space-y-4">
      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-xs">
            <thead><tr className="border-b bg-[var(--app-soft-bg)]"><th className="px-4 py-3">姓名</th><th className="px-4 py-3">登录账号</th><th className="px-4 py-3">角色</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">会员档位</th><th className="px-4 py-3">资料完成度</th></tr></thead>
            <tbody><tr><td className="px-4 py-4 font-semibold">{result.displayName}</td><td className="px-4 py-4">{profile.login_id || profile.email || `账号 …${profile.id.slice(-8)}`}</td><td className="px-4 py-4">{ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] ?? profile.role}</td><td className="px-4 py-4">{STATUS_LABELS[profile.status] ?? profile.status}</td><td className="px-4 py-4">{profile.role === "student" ? MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(profile.membership_tier)] : "—"}</td><td className="px-4 py-4">{result.completionPercent}%</td></tr></tbody>
          </table>
        </div>
      </section>

      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-xs">
            <thead><tr className="border-b bg-[var(--app-soft-bg)]"><th className="px-4 py-3">注册时间</th><th className="px-4 py-3">最近活动</th><th className="px-4 py-3">出生日期</th><th className="px-4 py-3">所在地</th><th className="px-4 py-3">教育阶段</th><th className="px-4 py-3">韩语能力</th></tr></thead>
            <tbody><tr><td className="px-4 py-4"><LocalDateTime value={profile.registered_at || profile.created_at} options={DATE_TIME_OPTIONS} /></td><td className="px-4 py-4"><LocalDateTime value={profile.last_active_at} options={DATE_TIME_OPTIONS} fallback="暂无记录" /></td><td className="px-4 py-4"><LocalDateTime value={profile.birth_date} options={DATE_OPTIONS} fallback="未填写" /></td><td className="px-4 py-4">{[profile.address_province, profile.address_city].filter(Boolean).join(" ") || "未填写"}</td><td className="px-4 py-4">{profile.education_level || "未填写"}</td><td className="px-4 py-4">{profile.has_korean ? `TOPIK ${profile.topik_level ?? "未填写"}` : profile.has_korean === false ? "暂无韩语基础" : "未填写"}</td></tr></tbody>
          </table>
        </div>
      </section>

      <div className="flex justify-end">
        <AccountDetailActivityDialog logs={result.auditLogs} actorNames={actorNames} />
      </div>
    </div>
  );
}
