"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Edit3, Eye, EyeOff, Plus, Save, Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createUniversityAction,
  toggleUniversityPublishedAction,
  updateUniversityAction,
} from "./actions";

export type AdminUniversity = {
  id: string;
  name_zh: string;
  name_ko: string;
  ownership: "national" | "public" | "private";
  province: string;
  city: string;
  admission_stages: string[];
  discipline_groups: string[];
  tuition_min_krw: number;
  tuition_max_krw: number;
  tuition_min_cny: number;
  tuition_max_cny: number;
  tuition_reference_year: number;
  qs_rank_display: string | null;
  qs_rank_sort: number | null;
  qs_ranking_year: number | null;
  joongang_rank_display: string | null;
  joongang_rank_sort: number | null;
  joongang_ranking_year: number | null;
  summary: string;
  highlights: string[];
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
  updated_at: string;
};

const ownershipOptions = [["national", "国立"], ["public", "公立"], ["private", "私立"]] as const;
const ownershipLabels = Object.fromEntries(ownershipOptions) as Record<string, string>;
const stageOptions = [["language", "语学堂"], ["bachelor_fresh", "本科新入"], ["bachelor_transfer", "本科插班"], ["master", "硕士"], ["doctor", "博士"]] as const;
const disciplineOptions = [["humanities_social", "人文社会"], ["science", "理科"], ["natural_sciences", "自然"], ["medicine", "医学"]] as const;
const regionOptions = ["首尔特别市", "釜山广域市", "大邱广域市", "仁川广域市", "光州广域市", "大田广域市", "蔚山广域市", "世宗特别自治市", "京畿道", "江原特别自治道", "忠清北道", "忠清南道", "全北特别自治道", "全罗南道", "庆尚北道", "庆尚南道", "济州特别自治道"];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-60" style={{ backgroundColor: "var(--app-accent)" }}><Save size={15} />{pending ? "正在保存…" : label}</button>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-black">{label}{children}</label>;
}

function UniversityFormFields({ university }: { university?: AdminUniversity }) {
  const isNew = !university;
  const defaultStages = university?.admission_stages ?? stageOptions.map(([value]) => value);
  const defaultDisciplines = university?.discipline_groups ?? disciplineOptions.map(([value]) => value);

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="大学中文名称"><input name="nameZh" required minLength={2} maxLength={80} defaultValue={university?.name_zh} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" /></Field>
        <Field label="大学韩文名称"><input name="nameKo" required minLength={2} maxLength={100} defaultValue={university?.name_ko} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" /></Field>
        <Field label="学校性质"><select name="ownership" defaultValue={university?.ownership ?? "private"} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none">{ownershipOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="推荐顺序"><input name="sortOrder" type="number" min="0" required defaultValue={university?.sort_order ?? 1100} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" /></Field>
        <Field label="行政地区"><select name="province" defaultValue={university?.province ?? "首尔特别市"} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none">{regionOptions.map((region) => <option key={region}>{region}</option>)}</select></Field>
        <Field label="所在城市"><input name="city" required defaultValue={university?.city ?? "首尔"} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" /></Field>
        <Field label="学费参考年份"><input name="tuitionReferenceYear" type="number" min="2000" required defaultValue={university?.tuition_reference_year ?? 2025} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" /></Field>
        <div className="flex items-end gap-4 pb-3 text-xs font-black">
          <label className="flex items-center gap-2"><input name="isFeatured" type="checkbox" defaultChecked={university?.is_featured ?? false} /> 重点推荐</label>
          <label className="flex items-center gap-2"><input name="isPublished" type="checkbox" defaultChecked={university?.is_published ?? true} /> 对学生展示</label>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="学校介绍"><textarea name="summary" required minLength={10} maxLength={800} rows={5} defaultValue={university?.summary ?? "请在这里填写学校定位、教学特色、适合学生和申请注意事项。"} className="app-input mt-2 w-full resize-y rounded-xl border px-3 py-3 text-sm leading-6 outline-none" /></Field>
        <Field label="院校亮点（逗号或换行分隔，最多八项）"><textarea name="highlights" rows={5} defaultValue={university?.highlights.join("\n") ?? "国际学生支持\n专业选择丰富\n校园生活便利"} className="app-input mt-2 w-full resize-y rounded-xl border px-3 py-3 text-sm leading-6 outline-none" /></Field>
      </section>

      <section className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--app-border-soft)" }}>
        <Field label="韩元学费下限"><input name="tuitionMinKrw" type="number" min="0" required defaultValue={university?.tuition_min_krw ?? 6_500_000} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" /></Field>
        <Field label="韩元学费上限"><input name="tuitionMaxKrw" type="number" min="0" required defaultValue={university?.tuition_max_krw ?? 14_000_000} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" /></Field>
        <Field label="人民币学费下限"><input name="tuitionMinCny" type="number" min="20000" required defaultValue={university?.tuition_min_cny ?? 35_000} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" /></Field>
        <Field label="人民币学费上限"><input name="tuitionMaxCny" type="number" min="20000" required defaultValue={university?.tuition_max_cny ?? 78_000} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" /></Field>
      </section>

      <section className="grid gap-5 rounded-2xl border p-4 sm:grid-cols-2" style={{ borderColor: "var(--app-border-soft)" }}>
        <div><h3 className="text-xs font-black">申请阶段</h3><div className="mt-3 flex flex-wrap gap-3">{stageOptions.map(([value, label]) => <label key={value} className="flex items-center gap-2 text-xs font-bold"><input name="admissionStages" type="checkbox" value={value} defaultChecked={defaultStages.includes(value)} /> {label}</label>)}</div></div>
        <div><h3 className="text-xs font-black">优势学科</h3><div className="mt-3 flex flex-wrap gap-3">{disciplineOptions.map(([value, label]) => <label key={value} className="flex items-center gap-2 text-xs font-bold"><input name="disciplineGroups" type="checkbox" value={value} defaultChecked={defaultDisciplines.includes(value)} /> {label}</label>)}</div></div>
      </section>

      <section className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-3 lg:grid-cols-6" style={{ borderColor: "var(--app-border-soft)" }}>
        <Field label="世界排名显示"><input name="qsRankDisplay" placeholder="例如：155" defaultValue={university?.qs_rank_display ?? ""} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" /></Field>
        <Field label="世界排名排序值"><input name="qsRankSort" type="number" min="0" defaultValue={university?.qs_rank_sort ?? ""} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" /></Field>
        <Field label="世界排名年份"><input name="qsRankingYear" type="number" min="2000" defaultValue={university?.qs_ranking_year ?? ""} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" /></Field>
        <Field label="中央日报显示"><input name="joongangRankDisplay" placeholder="例如：8" defaultValue={university?.joongang_rank_display ?? ""} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" /></Field>
        <Field label="中央日报排序值"><input name="joongangRankSort" type="number" min="0" defaultValue={university?.joongang_rank_sort ?? ""} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" /></Field>
        <Field label="中央日报年份"><input name="joongangRankingYear" type="number" min="2000" defaultValue={university?.joongang_ranking_year ?? ""} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" /></Field>
      </section>
      {isNew && <p className="text-[10px] leading-5 app-muted-text">新增学校的内部技术标识由系统自动生成，管理员只需要维护学生能看到的中文资料。</p>}
    </div>
  );
}

function UniversityEditor({ university }: { university: AdminUniversity }) {
  return (
    <Dialog>
      <DialogTrigger type="button" className="app-soft-card inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black"><Edit3 size={13} /> 编辑</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader><DialogTitle className="text-lg font-black">编辑 {university.name_zh}</DialogTitle><DialogDescription>修正后会同步影响学生学校库、筛选、介绍与对比页面。</DialogDescription></DialogHeader>
        <form action={updateUniversityAction.bind(null, university.id)} className="space-y-5"><UniversityFormFields university={university} /><div className="flex justify-end"><SubmitButton label="保存大学资料" /></div></form>
      </DialogContent>
    </Dialog>
  );
}

export function UniversityAdminManager({ universities }: { universities: AdminUniversity[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "hidden">("all");
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("zh-CN");
    return universities.filter((university) => {
      if (status === "published" && !university.is_published) return false;
      if (status === "hidden" && university.is_published) return false;
      return !keyword || [university.name_zh, university.name_ko, university.province, university.city].join(" ").toLocaleLowerCase("zh-CN").includes(keyword);
    });
  }, [search, status, universities]);

  return (
    <div className="space-y-5">
      <section className="app-card rounded-[28px] border p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">{([['all', '全部'], ['published', '学生可见'], ['hidden', '停止展示']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setStatus(value)} className="rounded-xl px-3 py-2 text-xs font-black" style={status === value ? { color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" } : { color: "var(--app-muted)", backgroundColor: "var(--app-soft-bg)" }}>{label}</button>)}</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block sm:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 app-muted-text" size={15} /><span className="sr-only">搜索大学</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索大学或地区" className="app-input w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none" /></label>
            <Dialog>
              <DialogTrigger type="button" className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}><Plus size={14} /> 新增大学</DialogTrigger>
              <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle className="text-lg font-black">新增大学资料</DialogTitle><DialogDescription>填写学生选校时真正需要的信息，保存后立即进入学校库。</DialogDescription></DialogHeader><form action={createUniversityAction} className="space-y-5"><UniversityFormFields /><div className="flex justify-end"><SubmitButton label="新增到学校库" /></div></form></DialogContent>
            </Dialog>
          </div>
        </div>
      </section>

      <section className="app-card overflow-hidden rounded-[28px] border">
        <div className="hidden grid-cols-[minmax(260px,1.3fr)_100px_150px_130px_210px] gap-3 border-b px-5 py-3 text-[10px] font-black app-muted-text lg:grid" style={{ borderColor: "var(--app-border-soft)" }}><span>大学</span><span>性质</span><span>地区</span><span>排名</span><span>管理</span></div>
        <div className="divide-y" style={{ borderColor: "var(--app-border-soft)" }}>
          {filtered.map((university) => (
            <article key={university.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(260px,1.3fr)_100px_150px_130px_210px] lg:items-center">
              <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-sm font-black">{university.name_zh}</h2>{!university.is_published && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">已隐藏</span>}</div><p className="mt-1 truncate text-[10px] font-bold app-muted-text">{university.name_ko} · 顺序 {university.sort_order}</p></div>
              <p className="text-xs font-black">{ownershipLabels[university.ownership]}</p>
              <p className="text-xs font-bold app-muted-text">{university.province}<br />{university.city}</p>
              <p className="text-[10px] font-bold app-muted-text">世界：{university.qs_rank_display ?? "暂无"}<br />中央：{university.joongang_rank_display ?? "暂无"}</p>
              <div className="flex flex-wrap gap-2"><UniversityEditor university={university} /><form action={toggleUniversityPublishedAction.bind(null, university.id, !university.is_published)}><button type="submit" className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black" style={{ color: university.is_published ? "#dc2626" : "var(--app-success)", borderColor: "var(--app-border)" }}>{university.is_published ? <EyeOff size={13} /> : <Eye size={13} />}{university.is_published ? "停止展示" : "恢复展示"}</button></form></div>
            </article>
          ))}
        </div>
        {filtered.length === 0 && <div className="p-12 text-center text-sm font-bold app-muted-text">没有符合条件的大学。</div>}
      </section>
    </div>
  );
}
