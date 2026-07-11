import { School } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardPageHeader } from "../DashboardPageHeader";

export default function UniversitiesPage() {
  return (
    <>
      <DashboardPageHeader
        title="目标大学"
        description="管理你的目标院校、申请专业和申请阶段。"
      />

      <div className="space-y-6 p-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School size={20} />
              目标院校列表
            </CardTitle>
            <CardDescription>
              后续可以添加目标大学、专业、申请状态和截止日期。
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">
              暂无目标大学
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}