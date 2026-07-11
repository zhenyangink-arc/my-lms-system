import { FileText } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DocumentsPage() {
  return (
    <>
      <header className="border-b bg-gray-50 px-6 py-5">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">
          申请材料
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          准备护照、成绩单、推荐信、学习计划书等申请材料。
        </p>
      </header>

      <div className="space-y-6 p-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText size={20} />
              材料清单
            </CardTitle>
            <CardDescription>
              后续可以做材料上传、审核状态和补交提醒。
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {["护照", "成绩单", "毕业证明", "学习计划书"].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border bg-white p-4 text-sm font-medium text-gray-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}