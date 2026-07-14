"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import {
  ArrowRight,
  CircleAlert,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const formSchema = z.object({
  email: z.string().trim().toLowerCase().email({
    message: "请输入有效的电子邮箱",
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
    form.clearErrors("root");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    // 登录失败统一使用模糊提示，避免暴露邮箱是否已经注册。
    if (error) {
      form.setError("root", {
        message: "邮箱或密码不正确，请检查后重试",
      });
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <AuthPageShell variant="login">
      <section className="rounded-[2rem] border border-white/90 bg-white/94 p-6 shadow-[0_28px_75px_rgba(52,106,140,0.17)] backdrop-blur sm:p-8">
        <div>
          <p className="text-sm font-black tracking-[0.12em] text-[#ec7659]">账号登录</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#183f5b]">
            欢迎回来
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#708897]">
            输入邮箱和密码，继续你的课程与成长计划。
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-7 space-y-6" noValidate>
          <FieldGroup>
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name} className="font-black text-[#365c74]">
                    <Mail size={16} className="text-[#4a98c1]" />
                    电子邮箱
                  </FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="请输入注册时使用的邮箱"
                    aria-invalid={fieldState.invalid}
                    className="h-12 rounded-xl border-[#d8e7ee] bg-[#fbfdfe] px-4 text-base focus-visible:border-[#62add3] focus-visible:ring-[#d7effb]"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel htmlFor={field.name} className="font-black text-[#365c74]">
                      <LockKeyhole size={16} className="text-[#ef7d60]" />
                      密码
                    </FieldLabel>
                    <span className="text-xs font-bold text-[#8195a2]">忘记密码请联系管理员</span>
                  </div>
                  <PasswordInput
                    {...field}
                    id={field.name}
                    autoComplete="current-password"
                    placeholder="请输入账号密码"
                    aria-invalid={fieldState.invalid}
                    className="h-12 rounded-xl border-[#d8e7ee] bg-[#fbfdfe] px-4 text-base focus-visible:border-[#62add3] focus-visible:ring-[#d7effb]"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>

          {form.formState.errors.root?.message && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-[#f4d3c9] bg-[#fff4ef] px-4 py-3 text-sm font-bold leading-6 text-[#b95843]"
            >
              <CircleAlert size={17} className="mt-0.5 shrink-0" />
              {form.formState.errors.root.message}
            </div>
          )}

          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="h-12 w-full rounded-xl bg-[#f2785b] text-base font-black text-white shadow-[0_14px_30px_rgba(242,120,91,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e8684d]"
          >
            {form.formState.isSubmitting ? (
              "正在登录…"
            ) : (
              <span className="flex items-center gap-2">
                进入学习中心
                <ArrowRight size={17} />
              </span>
            )}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-bold text-[#7b929f]">
          <ShieldCheck size={15} className="text-[#4aa872]" />
          登录信息通过安全连接发送
        </div>

        <div className="mt-6 border-t border-[#e5eef3] pt-6 text-center text-sm text-[#708795]">
          还没有成长档案？
          <Link href="/register" className="ml-1 font-black text-[#3380aa] transition hover:text-[#ed7357]">
            免费创建账号
          </Link>
        </div>
      </section>
    </AuthPageShell>
  );
}
