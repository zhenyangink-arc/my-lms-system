import { getAnnouncementManagementData } from "../api/service";
import { CreateAnnouncementDialog } from "./announcement-action-dialogs";
import { AnnouncementsTable } from "./announcements-table";
import { TenantAnnouncementInspection } from "./tenant-announcement-inspection";

export default async function AnnouncementListing() {
  const result = await getAnnouncementManagementData();
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateAnnouncementDialog scope={result.scope} />
      </div>
      {result.hasError && (
        <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          公告、机构或阅读统计暂时无法完整读取，请稍后刷新重试。
        </p>
      )}

      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr>
                <th>统计范围</th>
                <th>公告总数</th>
                <th>已发布</th>
                <th>草稿</th>
                <th>已归档</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>{result.scope === "platform" ? "平台公告" : "本机构公告"}</th>
                <td>{ownAnnouncements.length}</td>
                <td>{publishedCount}</td>
                <td>{draftCount}</td>
                <td>{archivedCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <AnnouncementsTable data={ownAnnouncements} scope={result.scope} />

      {result.scope === "platform" && (
        <TenantAnnouncementInspection
          announcements={tenantAnnouncements}
          tenants={result.tenants}
        />
      )}
    </div>
  );
}
