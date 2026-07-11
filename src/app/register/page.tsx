"use client";

import Link from "next/link";
import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

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




const formSchema = z
  .object({
    email: z.string().email({
      message: "请输入有效的邮箱格式",
    }),
    password: z.string().min(6, {
      message: "密码至少需要 6 个字符",
    }),
    confirmPassword: z.string().min(6, {
      message: "请再次输入密码",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof formSchema>;

export default function RegisterPage() {
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    setMessage("");
    setErrorMessage("");

    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setErrorMessage(error.message || "注册失败，请稍后再试");
      return;
    }

    setMessage("注册成功！请检查邮箱确认账号，然后返回登录。");
    form.reset();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50/50 px-4">
  <div className="w-full max-w-sm">
    <div className="mb-8 flex flex-col items-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
        <GraduationCap size={28} />
      </div>

      <h1 className="text-2xl font-black tracking-tight text-gray-900">
        创建 PUFFY 账号
      </h1>

      <p className="mt-2 text-sm text-gray-500">
        注册后开始你的专属学习计划
      </p>
    </div>

    <Card className="w-full rounded-2xl border-gray-200 shadow-xl shadow-gray-200/70">
        <CardHeader>
          <CardTitle>创建账号</CardTitle>
          <CardDescription>
            输入邮箱和密码注册你的账号
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>邮箱</FieldLabel>

                    <Input
                      {...field}
                      id={field.name}
                      type="email"
                      placeholder="m@example.com"
                      aria-invalid={fieldState.invalid}
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
                    <FieldLabel htmlFor={field.name}>密码</FieldLabel>

                    <Input
                      {...field}
                      id={field.name}
                      type="password"
                      placeholder="至少 6 个字符"
                      aria-invalid={fieldState.invalid}
                    />

                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="confirmPassword"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>确认密码</FieldLabel>

                    <Input
                      {...field}
                      id={field.name}
                      type="password"
                      placeholder="再次输入密码"
                      aria-invalid={fieldState.invalid}
                    />

                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {errorMessage && (
                <p className="text-sm text-red-500">{errorMessage}</p>
              )}

              {message && (
                <p className="text-sm text-green-600">{message}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "注册中..." : "注册"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            已有账号？{" "}
            <Link href="/login" className="underline underline-offset-4">
              登录
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
</div>
  );
}