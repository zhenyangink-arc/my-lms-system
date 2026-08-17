import type {
  AssignablePermissionKey,
  PermissionRole,
} from "@/lib/permissions/catalog";
import type { PermissionCenterDirectory } from "../api/types";

function scopeLabel(permissionKey: AssignablePermissionKey) {
  return permissionKey === "standard_question_bank.manage"
    ? "平台范围"
    : "机构范围";
}

function targetLabel(permissionKey: AssignablePermissionKey) {
  return permissionKey === "standard_question_bank.manage"
    ? "平台副负责人、平台管理员"
    : "机构普通管理员";
}

export function PermissionDirectory({
  directory,
}: {
  directory: PermissionCenterDirectory;
}) {
  return (
    <section className="overflow-hidden border border-[var(--border)] bg-[var(--card)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          正式权限键目录
        </h3>
        <p className="mt-1 text-xs text-[var(--foreground-muted)]">
          当前数据库正式注册 {directory.assignablePermissionKeys.length} 个例外授权键。
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-xs">
          <thead className="bg-[var(--surface-soft)] text-[var(--foreground-muted)]">
            <tr>
              <th className="px-4 py-2.5 font-medium">权限键</th>
              <th className="px-4 py-2.5 font-medium">权限名称</th>
              <th className="px-4 py-2.5 font-medium">适用范围</th>
              <th className="px-4 py-2.5 font-medium">可授权账号</th>
              <th className="px-4 py-2.5 font-medium">覆盖能力</th>
            </tr>
          </thead>
          <tbody>
            {directory.assignablePermissionKeys.map((permissionKey) => {
              const capabilities = directory.modules.flatMap((module) =>
                module.capabilities
                  .filter(
                    (capability) =>
                      capability.explicitGrant === permissionKey,
                  )
                  .map((capability) => capability.description),
              );
              return (
                <tr
                  key={permissionKey}
                  className="border-t border-[var(--border)]"
                >
                  <td className="px-4 py-3 font-mono text-[11px] text-[var(--foreground-muted)]">
                    {permissionKey}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[var(--foreground)]">
                    {directory.assignablePermissionLabels[permissionKey]}
                  </td>
                  <td className="px-4 py-3">{scopeLabel(permissionKey)}</td>
                  <td className="px-4 py-3">{targetLabel(permissionKey)}</td>
                  <td className="max-w-md px-4 py-3 text-[var(--foreground-muted)]">
                    {capabilities.join("；") || "模块管理能力"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function capabilityLabel(
  directory: PermissionCenterDirectory,
  role: PermissionRole,
) {
  const capabilityKeys = new Set(directory.roleCapabilities[role]);
  const tierLabels = {
    normal: "普通学生",
    vip1: "一级会员",
    vip2: "二级会员",
    vip3: "三级会员",
  } as const;
  return directory.modules.flatMap((module) =>
    module.capabilities
      .filter((capability) => capabilityKeys.has(capability.key))
      .map((capability) => {
        const tier = capability.studentMinimumTier
          ? `（${tierLabels[capability.studentMinimumTier]}及以上）`
          : "";
        return `${module.label}：${capability.label}${tier}`;
      }),
  );
}

export function RolePermissionMatrix({
  directory,
}: {
  directory: PermissionCenterDirectory;
}) {
  return (
    <section className="overflow-hidden border border-[var(--border)] bg-[var(--card)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          角色固定权限
        </h3>
        <p className="mt-1 text-xs text-[var(--foreground-muted)]">
          展示角色天生继承的能力；账号例外授权不改变角色身份。
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left text-xs">
          <thead className="bg-[var(--surface-soft)] text-[var(--foreground-muted)]">
            <tr>
              <th className="w-44 px-4 py-2.5 font-medium">角色</th>
              <th className="w-28 px-4 py-2.5 font-medium">身份范围</th>
              <th className="px-4 py-2.5 font-medium">固定继承能力</th>
            </tr>
          </thead>
          <tbody>
            {directory.roles.map((role) => {
              const capabilities = capabilityLabel(directory, role);
              const platformRole = role.startsWith("platform_");
              return (
                <tr
                  key={role}
                  className="border-t border-[var(--border)] align-top"
                >
                  <td className="px-4 py-3 font-semibold text-[var(--foreground)]">
                    {directory.roleLabels[role]}
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground-muted)]">
                    {platformRole ? "平台" : role === "student" ? "本人" : "本机构"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {capabilities.length ? (
                        capabilities.map((capability) => (
                          <span
                            key={capability}
                            className="border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-[11px]"
                          >
                            {capability}
                          </span>
                        ))
                      ) : (
                        <span className="text-[var(--foreground-muted)]">无固定管理能力</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
