import Link from "next/link";
import { Megaphone } from "lucide-react";

import {
  ManagementMetricStrip,
  ManagementNotice,
  ManagementPage,
} from "@/components/layout/management-page";
import { getDashboardBasePath, scopeDashboardPath } from "@/lib/dashboard-path";
import { getAnnouncementManagementData } from "../api/service";
import { CreateAnnouncementDialog } from "./announcement-action-dialogs";
import { AnnouncementsTable } from "./announcements-table";
import { TenantAnnouncementInspection } from "./tenant-announcement-inspection";

export default async function AnnouncementListing() {
  const result = await getAnnouncementManagementData();
  const dashboardBasePath = getDashboardBasePath();
  const ownAnnouncements = result.announcements.filter(
    (announcement) => announcement.scope === result.scope,
  );
  const tenantAnnouncements =
    result.scope === "platform"
      ? result.announcements.filter(
          (announcement) => announcement.scope === "tenant",
        )
      : [];
  const publishedCount = ownAnnouncements.filter(
    (announcement) => announcement.status === "published",
  ).length;
  const draftCount = ownAnnouncements.filter(
    (announcement) => announcement.status === "draft",
  ).length;
  const archivedCount = ownAnnouncements.filter(
    (announcement) => announcement.status === "archived",
  ).length;

  return (
    <ManagementPage
      eyebrow="内容运营"
      title="通知公告管理"
      description={
        result.scope === "platform"
          ? "维护平台公告，并以机构汇总视角巡检各机构公告的发布状态与阅读情况。"
          : "维护本机构公告，跟踪发布状态和成员阅读情况。"
      }
      icon={Megaphone}
      meta={<span>{result.scope === "platform" ? "平台范围" : "本机构范围"}</span>}
      action={
        <>
          <Link
            href={scopeDashboardPath(
              "/dashboard/announcements",
              dashboardBasePath,
            )}
            className="management-secondary-button inline-flex items-center border px-4 text-xs font-semibold"
          >
            查看成员公告栏
          </Link>
          <CreateAnnouncementDialog scope={result.scope} />
        </>
      }
    >
      {result.hasError && (
        <ManagementNotice tone="warning">
          公告、机构或阅读统计暂时无法完整读取，请稍后刷新重试。
        </ManagementNotice>
      )}

      <AnnouncementsTable data={ownAnnouncements} scope={result.scope} />

      <ManagementMetricStrip
        label="公告运营概况"
        items={[
          {
            label: "统计范围",
            value: result.scope === "platform" ? "平台公告" : "本机构公告",
          },
          { label: "公告总数", value: ownAnnouncements.length },
          { label: "已发布", value: publishedCount },
          { label: "草稿", value: draftCount },
          { label: "已归档", value: archivedCount },
        ]}
      />

      {result.scope === "platform" && (
        <TenantAnnouncementInspection
          announcements={tenantAnnouncements}
          tenants={result.tenants}
        />
      )}
    </ManagementPage>
  );
}
