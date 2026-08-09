import { getAccountList } from "../api/service";
import type { AccountSearchParams } from "../api/types";
import { AccountActivityDialog, AccountDeletionActivityDialog } from "./account-activity-dialogs";
import { AccountsTable } from "./accounts-table";

export default async function AccountListing({ searchParams }: { searchParams: Promise<AccountSearchParams> | AccountSearchParams }) {
  const params = await searchParams;
  const result = await getAccountList(params);
  const activeCount = result.allProfiles.filter((profile) => profile.status === "active").length;

  return (
    <div className="space-y-4">
      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[680px] border-collapse text-left">
            <thead><tr><th>统计项目</th><th>账号总数</th><th>正常使用</th><th>当前结果</th><th>管理范围</th></tr></thead>
            <tbody><tr><th>当前数量</th><td>{result.allProfiles.length}</td><td>{activeCount}</td><td>{result.profiles.length}</td><td className="text-sm">{result.scope === "platform" ? "平台直属账号" : "当前机构账号"}</td></tr></tbody>
          </table>
        </div>
      </section>

      {result.scope === "tenant" && (
        <div className="flex flex-wrap items-center gap-2">
          <AccountActivityDialog logs={result.auditLogs} accountNames={result.accountNames} />
          {result.viewerRole === "tenant_super_admin" && <AccountDeletionActivityDialog logs={result.deletionAuditLogs} />}
        </div>
      )}

      <AccountsTable data={result.profiles} scope={result.scope} viewerRole={result.viewerRole} filters={result.filters} />
    </div>
  );
}
