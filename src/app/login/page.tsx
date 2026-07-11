"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  email: z.string().email({
    message: "请输入有效的邮箱格式，例如 user@example.com",
  }),
  password: z.string().min(6, {
    message: "密码至少需要 6 个字符",
  }),
});

type LoginFormValues = z.infer<typeof formSchema>;

export default function LoginPage() {
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: values.email,
    password: values.password,
  });

  if (error) {
    form.setError("email", {
      message: "邮箱或密码错误",
    });
    return;
  }

  console.log("登录成功:", data);

  router.push("/dashboard");
  router.refresh();
}


  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50 p-4">
      <Link
        href="/"
        className="absolute left-4 top-4 md:left-8 md:top-8 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={16} />
        返回首页
      </Link>

      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white mb-4 shadow-lg shadow-indigo-200">
            <GraduationCap size={28} />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-gray-900">
            欢迎回到 PUFFY
          </h1>

          <p className="text-sm text-gray-500 mt-2">
            登录以继续你的专属学习计划
          </p>
        </div>

        <Card className="border-gray-200 shadow-sm rounded-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">账号登录</CardTitle>
            <CardDescription>
              请输入你的邮箱和密码进入控制台
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6"
            >
              <FieldGroup>
                <Controller
                  name="email"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        电子邮箱
                      </FieldLabel>

                      <Input
                        {...field}
                        id={field.name}
                        type="email"
                        placeholder="hello@example.com"
                        aria-invalid={fieldState.invalid}
                        className="rounded-xl focus-visible:ring-indigo-600"
                      />

                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="password"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <div className="flex items-center justify-between">
                        <FieldLabel htmlFor={field.name}>
                          密码
                        </FieldLabel>

                        <Link
                          href="#"
                          className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                        >
                          忘记密码？
                        </Link>
                      </div>

                      <Input
                        {...field}
                        id={field.name}
                        type="password"
                        placeholder="••••••••"
                        aria-invalid={fieldState.invalid}
                        className="rounded-xl focus-visible:ring-indigo-600"
                      />

                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-6 text-base font-bold shadow-md shadow-indigo-100"
              >
                {form.formState.isSubmitting ? "登录中..." : "安全登录"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex justify-center border-t border-gray-100 pt-6">
            <div className="text-sm text-gray-500">
              还没有账号？{" "}
              <Link
                href="/register"
                className="font-bold text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                免费注册
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}