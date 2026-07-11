import {
  BarChart3,
  BookOpen,
  CheckCircle,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardPageHeader } from "./DashboardPageHeader";

export default function DashboardPage() {
  return (
    <>
      <DashboardPageHeader
        title="学生控制台"
        description="这里是你的学习、申请和签证准备总览。"
        action={
          <Button className="rounded-xl bg-indigo-600 hover:bg-indigo-700">
            继续学习
          </Button>
        }
      />

      <div className="w-full space-y-6 p-6">
        <Card className="rounded-2xl border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-[1fr_300px]">
              <div className="p-4">
                <p className="text-sm font-semibold text-indigo-600">
                  当前课程
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-900">
                  PUFFY 入门课程
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
                  这里之后会连接真实课程数据，包括课程章节、学习记录、测验成绩和训练完成情况。
                </p>

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">学习进度</span>
                    <span className="font-semibold text-gray-900">0%</span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full w-[0%] rounded-full bg-indigo-600" />
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <Button className="rounded-xl bg-indigo-600 hover:bg-indigo-700">
                    开始学习
                  </Button>

                  <Button variant="outline" className="rounded-xl">
                    查看课程
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-center rounded-2xl bg-indigo-50 px-8 py-6">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-lg shadow-indigo-100">
                  <BookOpen size={44} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="rounded-2xl border-gray-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Clock size={16} />
                今日学习
              </CardDescription>
              <CardTitle className="text-3xl">0 分钟</CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-sm text-gray-500">今天还没有学习记录</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <CheckCircle size={16} />
                完成任务
              </CardDescription>
              <CardTitle className="text-3xl">0 个</CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-sm text-gray-500">完成课程后这里会更新</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <BarChart3 size={16} />
                总体进度
              </CardDescription>
              <CardTitle className="text-3xl">0%</CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-sm text-gray-500">后面连接 progress 表</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}