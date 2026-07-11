import { BarChart3 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardPageHeader } from "../DashboardPageHeader";

export default function ProgressPage() {
  return (
    <>
      <DashboardPageHeader
        title="学习进度"
        description="查看课程完成率、学习时长和任务完成情况。"
      />

      <div className="space-y-6 p-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={20} />
              总体进度
            </CardTitle>
            <CardDescription>
              后续会连接 progress 表显示真实学习进度。
            </CardDescription>
          </CardHeader>

          <CardContent>
            <p className="text-4xl font-black text-gray-900">0%</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full w-[0%] rounded-full bg-indigo-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}