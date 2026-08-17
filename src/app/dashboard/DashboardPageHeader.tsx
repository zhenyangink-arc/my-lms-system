import { ManagementPageHeader } from "@/components/layout/management-page";

type DashboardPageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function DashboardPageHeader({
  title,
  description,
  action,
}: DashboardPageHeaderProps) {
  return (
    <div className="management-page-shell management-page-header-only">
      <ManagementPageHeader
        title={title}
        description={description}
        action={action}
      />
    </div>
  );
}
