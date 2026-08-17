import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpenText,
  CircleDollarSign,
  ClipboardList,
  GraduationCap,
  MapPin,
  ShieldCheck,
} from "lucide-react";

import { DashboardPageHeader } from "../../../DashboardPageHeader";
import { SchoolCrest } from "@/components/school/SchoolCrest";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireActiveUser } from "@/lib/auth";

type University = {
  id: string;
  name_zh: string;
  name_ko: string;
  logo_url: string | null;
  detailed_introduction: string | null;
  summary: string;
  ownership: string;
  province: string;
  city: string;
  highlights: string[];
  tuition_min_cny: number;
  tuition_max_cny: number;
  tuition_reference_year: number;
  qs_rank_display: string | null;
  joongang_rank_display: string | null;
};
type School = { id: string; detailed_introduction: string | null };
type Program = {
  id: string;
  name_zh: string;
  name_local: string | null;
  education_stage: string;
  discipline_group: string;
  introduction: string | null;
  duration_text: string | null;
  tuition_note: string | null;
  admission_requirement: string | null;
};
type DocumentRequirement = {
  id: string;
  admission_stage: string;
  category: string;
  title: string;
  description: string | null;
  sort_order: number;
};
type VisaRequirement = {
  id: string;
  visa_type: string;
  stage: string;
  title: string;
  description: string | null;
  sort_order: number;
  applicable_scopes: string[];
};

const ownershipLabels: Record<string, string> = {
  national: "国立",
  public: "公立",
  private: "私立",
};
const stageLabels: Record<string, string> = {
  language: "语学堂",
  bachelor_fresh: "本科新入",
  bachelor_transfer: "本科插班",
  master: "硕士",
  doctor: "博士",
  high_school: "高中",
  vocational: "中专",
  technical: "技工",
  other: "其他",
};
const disciplineLabels: Record<string, string> = {
  humanities_social: "人文社会",
  science: "理科",
  natural_sciences: "自然科学",
  medicine: "医学",
  arts: "艺术",
  engineering: "工科",
  other: "其他",
};
const documentCategoryLabels: Record<string, string> = {
  identity: "身份资料",
  academic: "学历资料",
  application: "申请文书",
  financial: "财力证明",
  language: "语言资料",
};
const visaTypeLabels: Record<string, string> = {
  d4_language: "D-4 语学堂签证",
  d2_bachelor: "D-2 本科签证",
  d2_master: "D-2 硕士签证",
  d2_doctor: "D-2 博士签证",
};
const visaStageLabels: Record<string, string> = {
  admission: "录取准备",
  identity: "身份资料",
  finance: "财力证明",
  application: "申请材料",
  appointment: "预约",
  submission: "递交",
  result: "结果确认",
  entry: "入境准备",
};

function formatWan(value: number) {
  return Number((value / 10000).toFixed(1));
}

export default async function UniversityPublicDetailPage({
  params,
}: {
  params: Promise<{ universityId: string }>;
}) {
  const { universityId } = await params;
  const { supabase } = await requireActiveUser();
  const universityResult = await supabase
    .from("korean_universities")
    .select("id, name_zh, name_ko, logo_url, detailed_introduction, summary, ownership, province, city, highlights, tuition_min_cny, tuition_max_cny, tuition_reference_year, qs_rank_display, joongang_rank_display")
    .eq("id", universityId)
    .eq("is_published", true)
    .maybeSingle();

  if (universityResult.error) {
    return (
      <>
        <DashboardPageHeader title="大学详情" description="查看学校介绍、排名与专业资料" />
        <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-5">
          <section role="alert" className="rounded-2xl border p-4" style={{ color: "var(--destructive)", borderColor: "var(--destructive)", backgroundColor: "var(--surface-soft)" }}>
            <h3 className="text-sm font-bold">大学资料暂时无法读取</h3>
            <p className="mt-1 text-sm leading-6">请稍后刷新页面；当前状态不是资料不存在。</p>
          </section>
        </div>
      </>
    );
  }
  if (!universityResult.data) notFound();
  const university = universityResult.data as University;

  const [schoolResult, documentRequirementsResult, visaRequirementsResult] = await Promise.all([
    supabase
      .from("schools")
      .select("id, detailed_introduction")
      .eq("source_korean_university_id", universityId)
      .eq("is_published", true)
      .maybeSingle(),
    supabase
      .from("university_application_document_requirements")
      .select("id, admission_stage, category, title, description, sort_order")
      .eq("university_id", universityId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("university_visa_application_requirements")
      .select("id, visa_type, stage, title, description, sort_order, applicable_scopes")
      .eq("university_id", universityId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
  ]);
  const school = schoolResult.data as School | null;
  const documentRequirements = (documentRequirementsResult.data ?? []) as DocumentRequirement[];
  const visaRequirements = (visaRequirementsResult.data ?? []) as VisaRequirement[];
  const requirementsError = Boolean(documentRequirementsResult.error || visaRequirementsResult.error);
  let programs: Program[] = [];
  let programsError = false;
  if (school) {
    const result = await supabase
      .from("school_programs")
      .select("id, name_zh, name_local, education_stage, discipline_group, introduction, duration_text, tuition_note, admission_requirement")
      .eq("school_id", school.id)
      .eq("is_published", true)
      .order("sort_order", { ascending: true });
    programsError = Boolean(result.error);
    programs = (result.data ?? []) as Program[];
  }

  return (
    <>
      <DashboardPageHeader title={university.name_zh} description={`${ownershipLabels[university.ownership]} · ${university.province} · ${university.city}`} />
      <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-5">
        <Link href="/dashboard/universities/library" className="inline-flex items-center gap-2 rounded-lg text-xs font-bold app-muted-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2">
          <ArrowLeft size={14} aria-hidden="true" />返回大学学校库
        </Link>

        {(schoolResult.error || programsError || requirementsError) && (
          <section role="alert" className="rounded-2xl border p-4" style={{ color: "var(--destructive)", borderColor: "var(--destructive)", backgroundColor: "var(--surface-soft)" }}>
            <h3 className="text-sm font-bold">部分学校资料暂时无法读取</h3>
            <p className="mt-1 text-sm leading-6">学校基本资料仍可查看，请稍后刷新以确认介绍、申请要求与专业信息。</p>
          </section>
        )}

        <section className="app-card rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg,var(--card),var(--card),var(--accent))" }}>
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <SchoolCrest logoUrl={university.logo_url} name={university.name_zh} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}>{ownershipLabels[university.ownership]}</span>
                <span className="app-soft-card inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold"><MapPin size={12} aria-hidden="true" />{university.province} · {university.city}</span>
              </div>
              <h3 className="mt-3 text-2xl font-bold">{university.name_zh}</h3>
              <p className="app-muted-text mt-2 text-sm font-bold">{university.name_ko}</p>
            </div>
            <div className="grid min-w-[260px] grid-cols-2 gap-2">
              <a href="#school-introduction" className="inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2" style={{ backgroundColor: "var(--primary)" }}><BookOpenText size={15} aria-hidden="true" />学校详细介绍</a>
              <a href="#school-programs" className="inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2" style={{ backgroundColor: "var(--support)" }}><GraduationCap size={15} aria-hidden="true" />学校专业介绍</a>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "世界大学排名", value: university.qs_rank_display ?? "暂无" },
            { label: "韩国中央日报", value: university.joongang_rank_display ?? "暂无" },
            { label: `${university.tuition_reference_year} 年学费参考`, value: `${formatWan(university.tuition_min_cny)}万—${formatWan(university.tuition_max_cny)}万元` },
          ].map((item) => (
            <div key={item.label} className="app-card rounded-2xl border p-4">
              <p className="app-muted-text text-xs font-bold">{item.label}</p>
              <p className="mt-2 text-lg font-bold">{item.value}</p>
            </div>
          ))}
        </section>

        <section id="school-introduction" className="app-card scroll-mt-24 rounded-3xl border p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><BookOpenText size={20} style={{ color: "var(--primary)" }} aria-hidden="true" />学校详细介绍</h3>
          <p className="app-muted-text mt-5 whitespace-pre-line text-sm leading-6">{school?.detailed_introduction || university.detailed_introduction || university.summary}</p>
          {university.highlights.length > 0 && <div className="mt-6 flex flex-wrap gap-2">{university.highlights.map((item) => <span key={item} className="app-soft-card rounded-full border px-3 py-1.5 text-xs font-bold">{item}</span>)}</div>}
        </section>

        {!requirementsError && (
          <section id="application-requirements" className="scroll-mt-24" aria-labelledby="application-requirements-title">
            <div className="mb-3">
              <h3 id="application-requirements-title" className="flex items-center gap-2 text-xl font-bold">
                <ClipboardList size={21} style={{ color: "var(--primary)" }} aria-hidden="true" />
                申请与签证要求
              </h3>
              <p className="app-muted-text mt-2 text-xs">仅展示学校当前启用的要求，并按学校维护顺序排列。</p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader className="border-b">
                  <CardTitle><h4>申请资料要求</h4></CardTitle>
                  <CardDescription>{documentRequirements.length} 项启用要求</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  {documentRequirements.length > 0 ? (
                    <Table>
                      <TableCaption className="sr-only">申请资料要求，按学校维护顺序排列</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">资料</TableHead>
                          <TableHead>申请阶段</TableHead>
                          <TableHead>类型</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documentRequirements.map((requirement) => (
                          <TableRow key={requirement.id}>
                            <TableCell className="min-w-56 whitespace-normal py-3 pl-4 align-top">
                              <p className="font-medium text-foreground">{requirement.title}</p>
                              {requirement.description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{requirement.description}</p>}
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">{stageLabels[requirement.admission_stage] ?? requirement.admission_stage}</TableCell>
                            <TableCell className="whitespace-normal align-top">{documentCategoryLabels[requirement.category] ?? requirement.category}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">学校暂未发布申请资料要求。</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b">
                  <CardTitle><h4>签证资料要求</h4></CardTitle>
                  <CardDescription>{visaRequirements.length} 项启用要求</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  {visaRequirements.length > 0 ? (
                    <Table>
                      <TableCaption className="sr-only">签证资料要求，按学校维护顺序排列</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">资料</TableHead>
                          <TableHead>签证类型</TableHead>
                          <TableHead>办理阶段</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visaRequirements.map((requirement) => (
                          <TableRow key={requirement.id}>
                            <TableCell className="min-w-56 whitespace-normal py-3 pl-4 align-top">
                              <p className="font-medium text-foreground">{requirement.title}</p>
                              {requirement.description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{requirement.description}</p>}
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                适用：{requirement.applicable_scopes.map((scope) => stageLabels[scope] ?? scope).join("、")}
                              </p>
                            </TableCell>
                            <TableCell className="whitespace-normal align-top">{visaTypeLabels[requirement.visa_type] ?? requirement.visa_type}</TableCell>
                            <TableCell className="whitespace-normal align-top">{visaStageLabels[requirement.stage] ?? requirement.stage}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">学校暂未发布签证资料要求。</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        <section id="school-programs" className="app-card scroll-mt-24 rounded-3xl border p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-bold"><GraduationCap size={21} style={{ color: "var(--support)" }} aria-hidden="true" />学校专业介绍</h3>
              <p className="app-muted-text mt-2 text-xs">专业与申请条件由管理人员持续复核，实际招生以当年简章为准。</p>
            </div>
            <span className="app-soft-card rounded-full border px-3 py-1 text-xs font-bold">{programsError ? "—" : programs.length} 个专业</span>
          </div>
          {!schoolResult.error && !programsError && (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {programs.map((program) => (
                <article key={program.id} className="app-soft-card rounded-2xl border p-5">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}>{stageLabels[program.education_stage] ?? program.education_stage}</span>
                    <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}>{disciplineLabels[program.discipline_group] ?? program.discipline_group}</span>
                  </div>
                  <h4 className="mt-4 text-lg font-bold">{program.name_zh}</h4>
                  {program.name_local && <p className="app-muted-text mt-1 text-xs">{program.name_local}</p>}
                  <p className="app-muted-text mt-4 whitespace-pre-line text-sm leading-6">{program.introduction || "专业介绍正在完善中。"}</p>
                  <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                    {program.duration_text && <p><b>学制：</b>{program.duration_text}</p>}
                    {program.tuition_note && <p><b>学费：</b>{program.tuition_note}</p>}
                  </div>
                  {program.admission_requirement && <div className="mt-4 rounded-xl border p-3 text-xs leading-5" style={{ borderColor: "var(--border-subtle)" }}><b>申请要求：</b>{program.admission_requirement}</div>}
                </article>
              ))}
              {programs.length === 0 && <div className="app-soft-card col-span-full rounded-2xl border border-dashed p-8 text-center"><CircleDollarSign className="mx-auto opacity-25" aria-hidden="true" /><p className="mt-3 font-bold">专业资料正在完善中</p><p className="app-muted-text mt-2 text-xs">顾问可以先根据你的目标阶段提供人工建议。</p></div>}
            </div>
          )}
        </section>

        <div className="flex items-start gap-2 rounded-2xl p-4 text-xs leading-5" style={{ color: "var(--status-warning)", backgroundColor: "var(--status-warning-surface)" }}><ShieldCheck className="mt-0.5 shrink-0" size={16} aria-hidden="true" />页面不提供学校官网跳转；排名、学费和申请条件仅作规划参考，提交申请前请由顾问复核当年招生资料。</div>
      </div>
    </>
  );
}
