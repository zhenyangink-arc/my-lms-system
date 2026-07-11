import { FileCheck2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardPageHeader } from "../DashboardPageHeader";

export default function VisaPage() {
  return (
    <>
      <DashboardPageHeader
        title="签证准备"
        description="查看签证申请所需材料和准备进度。"
      />

      <div className="space-y-6 p-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck2 size={20} />
              签证材料进度
            </CardTitle>
            <CardDescription>
              后续可以做签证材料清单、提交状态和提醒。
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">
              暂无签证准备记录
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}