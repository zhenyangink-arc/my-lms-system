"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const formSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, { message: "姓名至少需要 2 个字符" })
      .max(50, { message: "姓名不能超过 50 个字符" }),
    email: z.string().trim().toLowerCase().email({
      message: "请输入有效的电子邮箱",
    }),
    password: z
      .string()
      .min(8, { message: "密码至少需要 8 个字符" })
      .regex(/[A-Za-z]/, { message: "密码需要包含字母" })
      .regex(/[0-9]/, { message: "密码需要包含数字" }),
    confirmPassword: z.string().min(1, {
      message: "请再次输入密码",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof formSchema>;

function getRegisterErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("already registered")) {
    return "该邮箱可能已经注册，请尝试直接登录";
  }

  if (normalized.includes("password")) {
    return "密码没有通过安全要求，请按提示重新设置";
  }

  if (normalized.includes("rate") || normalized.includes("too many")) {
    return "操作过于频繁，请稍后再试";
  }

  return "暂时无法完成注册，请稍后重试";
}

export default function RegisterPage() {
  const router = useRouter();
  const [successName, setSuccessName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  // 单独订阅密码字段，避免整个表单因强度提示而重复渲染。
  const password = useWatch({
    control: form.control,
    name: "password",
  });
  const passwordChecks = [
    { label: "至少 8 个字符", passed: password.length >= 8 },
    { label: "包含字母", passed: /[A-Za-z]/.test(password) },
    { label: "包含数字", passed: /[0-9]/.test(password) },
  ];
  const strength = passwordChecks.filter((item) => item.passed).length;

  async function onSubmit(values: RegisterFormValues) {
    setErrorMessage("");
    const supabase = createClient();
    const fullName = values.fullName.trim();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        // 同时保留两个常用姓名键，兼容现有 Dashboard 和数据库触发器。
        data: {
          full_name: fullName,
          name: fullName,
        },
      },
    });

    if (error) {
      setErrorMessage(getRegisterErrorMessage(error.message));
      return;
    }

    // 如果项目关闭邮箱确认，Supabase 会直接返回会话并进入控制台。
    if (data.session) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setSuccessName(fullName);
  }

  if (successName) {
    return (
      <AuthPageShell variant="register">
        <section className="rounded-[2rem] border border-white/90 bg-white/94 p-7 text-center shadow-[0_28px_75px_rgba(52,106,140,0.17)] backdrop-blur sm:p-9">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e7f7ed] text-[#43a26a] shadow-sm">
            <CheckCircle2 size={32} />
          </span>
          <p className="mt-6 text-sm font-black tracking-[0.12em] text-[#45a16b]">注册申请已提交</p>
          <h2 className="mt-2 text-3xl font-black text-[#193f5b]">{successName}，欢迎加入</h2>
          <p className="mt-4 text-sm leading-7 text-[#6c8494]">
            如果当前项目需要邮箱验证，确认邮件已经发送。完成验证后即可登录并建立你的留学成长路线。
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f2785b] px-5 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(242,120,91,0.22)]"
            >
              前往登录
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-[#d7e6ee] bg-white px-5 py-3.5 text-sm font-black text-[#4e7085]"
            >
              返回首页
            </Link>
          </div>
        </section>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell variant="register">
      <section className="rounded-[2rem] border border-white/90 bg-white/94 p-6 shadow-[0_28px_75px_rgba(52,106,140,0.17)] backdrop-blur sm:p-8">
        <div>
          <p className="text-sm font-black tracking-[0.12em] text-[#ec7659]">创建账号</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#183f5b]">
            建立你的成长档案
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#708897]">
            填写基本信息，开始保存留学与韩语学习进度。
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-7 space-y-5" noValidate>
          <FieldGroup className="gap-4">
            <Controller
              name="fullName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel htmlFor={field.name} className="font-black text-[#365c74]">
                      <UserRound size={16} className="text-[#45a56e]" />
                      真实姓名
                    </FieldLabel>
                    <span className="text-xs font-bold text-[#8195a2]">用于课程称呼与成长档案</span>
                  </div>
                  <Input
                    {...field}
                    id={field.name}
                    autoComplete="name"
                    placeholder="请输入你的姓名"
                    aria-invalid={fieldState.invalid}
                    className="h-12 rounded-xl border-[#d8e7ee] bg-[#fbfdfe] px-4 text-base focus-visible:border-[#62add3] focus-visible:ring-[#d7effb]"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

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
                    placeholder="请输入常用邮箱"
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
                  <FieldLabel htmlFor={field.name} className="font-black text-[#365c74]">
                    <LockKeyhole size={16} className="text-[#ef7d60]" />
                    设置密码
                  </FieldLabel>
                  <PasswordInput
                    {...field}
                    id={field.name}
                    autoComplete="new-password"
                    placeholder="请设置安全密码"
                    aria-invalid={fieldState.invalid}
                    className="h-12 rounded-xl border-[#d8e7ee] bg-[#fbfdfe] px-4 text-base focus-visible:border-[#62add3] focus-visible:ring-[#d7effb]"
                  />
                  <div className="grid grid-cols-3 gap-2" aria-label="密码安全要求">
                    {passwordChecks.map((item, index) => (
                      <div key={item.label}>
                        <div
                          className={`h-1.5 rounded-full transition ${
                            strength > index ? "bg-[#59b77c]" : "bg-[#e8eff3]"
                          }`}
                        />
                        <p
                          className={`mt-1.5 flex items-center gap-1 text-[11px] font-bold ${
                            item.passed ? "text-[#419765]" : "text-[#91a2ad]"
                          }`}
                        >
                          {item.passed && <Check size={11} strokeWidth={3} />}
                          {item.label}
                        </p>
                      </div>
                    ))}
                  </div>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="confirmPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name} className="font-black text-[#365c74]">
                    <ShieldCheck size={16} className="text-[#e3a83d]" />
                    确认密码
                  </FieldLabel>
                  <PasswordInput
                    {...field}
                    id={field.name}
                    autoComplete="new-password"
                    placeholder="请再次输入密码"
                    aria-invalid={fieldState.invalid}
                    className="h-12 rounded-xl border-[#d8e7ee] bg-[#fbfdfe] px-4 text-base focus-visible:border-[#62add3] focus-visible:ring-[#d7effb]"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>

          {errorMessage && (
            <div
              role="alert"
              aria-live="polite"
              className="flex items-start gap-2 rounded-xl border border-[#f4d3c9] bg-[#fff4ef] px-4 py-3 text-sm font-bold leading-6 text-[#b95843]"
            >
              <CircleAlert size={17} className="mt-0.5 shrink-0" />
              {errorMessage}
            </div>
          )}

          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="h-12 w-full rounded-xl bg-[#f2785b] text-base font-black text-white shadow-[0_14px_30px_rgba(242,120,91,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e8684d]"
          >
            {form.formState.isSubmitting ? (
              "正在创建…"
            ) : (
              <span className="flex items-center gap-2">
                创建成长档案
                <ArrowRight size={17} />
              </span>
            )}
          </Button>
        </form>

        <div className="mt-6 border-t border-[#e5eef3] pt-6 text-center text-sm text-[#708795]">
          已经有账号？
          <Link href="/login" className="ml-1 font-black text-[#3380aa] transition hover:text-[#ed7357]">
            返回登录
          </Link>
        </div>
      </section>
    </AuthPageShell>
  );
}
