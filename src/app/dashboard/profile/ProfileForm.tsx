"use client";

import { ChangeEvent, useActionState, useMemo, useState } from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  Gauge,
  GraduationCap,
  LoaderCircle,
  MapPin,
  Save,
  UserRound,
} from "lucide-react";

import { CHINA_PROVINCES, CHINA_REGION_CITIES } from "./china-cities";
import { updateProfileAction } from "./actions";
import { initialUpdateProfileState } from "./profile-state";

export type StudentProfileInitialValue = {
  fullName: string;
  gender: string;
  birthDate: string;
  avatarUrl: string | null;
  province: string;
  city: string;
  educationLevel: string;
  educationStatus: string;
  completionDate: string;
  academicAverage: string;
  gaokaoHasScore: boolean | null;
  gaokaoScore: string;
  englishLevel: string;
  mathLevel: string;
  hasKorean: boolean | null;
  topikLevel: string;
  hasWorkExperience: boolean | null;
};

const BIRTH_YEARS = Array.from({ length: 81 }, (_, index) => String(2020 - index));
const MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const ABILITY_LEVELS = [
  ["A1", "低"],
  ["A2", "中下"],
  ["B1", "中"],
  ["B2", "中上"],
  ["C1", "高"],
  ["C2", "极高"],
] as const;
const LOWER_EDUCATION_LEVELS = new Set(["high_school", "secondary_vocational", "technical_school"]);

function daysInMonth(yearText: string, monthText: string) {
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return 31;
  if (month === 2) {
    const leapYear = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
    return leapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function booleanValue(value: boolean | null) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "";
}

function isValidDottedDate(value: string) {
  const match = /^(\d{4})\.(0[1-9]|1[0-2])\.(0[1-9]|[12]\d|3[01])$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-lg font-black">{title}</h2>
        <p className="mt-1 text-xs leading-5 app-muted-text">{description}</p>
      </div>
    </div>
  );
}

const fieldClass = "app-input mt-2 w-full rounded-2xl border px-3.5 py-3 text-sm font-semibold outline-none transition";
const compactFieldClass = `${fieldClass} max-w-[380px]`;
const shortFieldClass = `${fieldClass} max-w-[240px]`;
const fieldWithoutMarginClass = fieldClass.replace("mt-2 ", "");

export function ProfileForm({ initialValue }: { initialValue: StudentProfileInitialValue }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialUpdateProfileState);
  const birthParts = initialValue.birthDate ? initialValue.birthDate.split("-") : ["", "", ""];
  const [birthYear, setBirthYear] = useState(birthParts[0] ?? "");
  const [birthMonth, setBirthMonth] = useState(birthParts[1] ?? "");
  const [birthDay, setBirthDay] = useState(birthParts[2] ?? "");
  const [province, setProvince] = useState(initialValue.province);
  const [city, setCity] = useState(initialValue.city);
  const [educationLevel, setEducationLevel] = useState(initialValue.educationLevel);
  const [educationStatus, setEducationStatus] = useState(initialValue.educationStatus);
  const [completionDate, setCompletionDate] = useState(initialValue.completionDate);
  const [academicAverage, setAcademicAverage] = useState(initialValue.academicAverage);
  const [gaokaoHasScore, setGaokaoHasScore] = useState(booleanValue(initialValue.gaokaoHasScore));
  const [hasKorean, setHasKorean] = useState(booleanValue(initialValue.hasKorean));
  const [photoPreview, setPhotoPreview] = useState(initialValue.avatarUrl);

  const cityOptions = CHINA_REGION_CITIES[province] ?? [];
  const dayOptions = useMemo(
    () => Array.from({ length: daysInMonth(birthYear, birthMonth) }, (_, index) => String(index + 1).padStart(2, "0")),
    [birthYear, birthMonth]
  );
  const needsGaokao = LOWER_EDUCATION_LEVELS.has(educationLevel);
  const completionDateWarning = completionDate !== "" && !isValidDottedDate(completionDate);
  const academicAverageNumber = Number(academicAverage);
  const academicAverageWarning =
    academicAverage !== "" &&
    (!Number.isFinite(academicAverageNumber) || academicAverageNumber < 0 || academicAverageNumber > 100);

  function handleProvinceChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextProvince = event.target.value;
    setProvince(nextProvince);
    setCity(CHINA_REGION_CITIES[nextProvince]?.[0] ?? "");
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!Object.hasOwn({ "image/jpeg": true, "image/png": true, "image/webp": true }, file.type) || file.size > 2 * 1024 * 1024) {
      event.target.value = "";
      return;
    }
    // 使用本地数据地址即时预览，真正的私有存储上传仍由服务端完成。
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(typeof reader.result === "string" ? reader.result : initialValue.avatarUrl);
    reader.readAsDataURL(file);
  }

  return (
    <form action={formAction} className="max-w-[980px] space-y-5">
      <section className="app-card rounded-3xl border p-5 sm:p-6">
        <SectionTitle icon={UserRound} title="基本信息" description="这些信息将用于留学评估、课程安排和顾问服务。" />

        <div className="mt-6 grid max-w-[900px] gap-6 lg:grid-cols-[160px_minmax(0,1fr)]">
          <div>
            <div
              className="flex aspect-square w-full max-w-[160px] items-end overflow-hidden rounded-[26px] border bg-cover bg-center"
              style={{
                backgroundColor: "var(--app-soft-bg)",
                backgroundImage: photoPreview ? `url("${photoPreview}")` : undefined,
              }}
            >
              {!photoPreview && <span className="m-auto text-5xl font-black" style={{ color: "var(--app-secondary)" }}>{initialValue.fullName.slice(0, 1) || "学"}</span>}
              <label className="m-2 flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/90 px-3 py-2 text-xs font-black text-slate-700 shadow-sm backdrop-blur">
                <Camera size={14} aria-hidden="true" />
                上传照片
                <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handlePhotoChange} />
              </label>
            </div>
            <p className="mt-2 text-[11px] leading-5 app-muted-text">支持 JPG、PNG、WEBP，最大 2MB。上传后会立即显示预览。</p>
          </div>

          <div className="grid content-start gap-x-5 gap-y-4 sm:grid-cols-2">
            <label className="max-w-[380px] text-sm font-black">
              真实姓名
              <input name="fullName" required minLength={2} maxLength={50} autoComplete="name" defaultValue={initialValue.fullName} className={compactFieldClass} />
              {state.fieldErrors?.fullName && <span className="mt-1.5 block text-xs text-red-600">{state.fieldErrors.fullName}</span>}
            </label>

            <fieldset className="max-w-[280px]">
              <legend className="text-sm font-black">性别</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[["male", "男"], ["female", "女"]].map(([value, label]) => (
                  <label key={value} className="app-soft-card flex cursor-pointer items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold">
                    <input name="gender" type="radio" value={value} required defaultChecked={initialValue.gender === value} className="accent-[var(--app-accent)]" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="max-w-[400px]">
              <span className="text-sm font-black">出生日期</span>
              <div className="mt-2 grid grid-cols-[1.3fr_1fr_1fr] gap-2">
                <select name="birthYear" required value={birthYear} onChange={(event) => setBirthYear(event.target.value)} className={fieldWithoutMarginClass} aria-label="出生年份">
                  <option value="">年</option>{BIRTH_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
                <select name="birthMonth" required value={birthMonth} onChange={(event) => setBirthMonth(event.target.value)} className={fieldWithoutMarginClass} aria-label="出生月份">
                  <option value="">月</option>{MONTHS.map((month) => <option key={month} value={month}>{month}</option>)}
                </select>
                <select name="birthDay" required value={birthDay} onChange={(event) => setBirthDay(event.target.value)} className={fieldWithoutMarginClass} aria-label="出生日期">
                  <option value="">日</option>{dayOptions.map((day) => <option key={day} value={day}>{day}</option>)}
                </select>
              </div>
            </div>

            <div className="max-w-[780px] sm:col-span-2">
              <div className="flex items-center gap-2 text-sm font-black"><MapPin size={15} aria-hidden="true" />住址（精确至市级）</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <select name="province" required value={province} onChange={handleProvinceChange} className={fieldWithoutMarginClass}>
                  <option value="">选择省级地区</option>{CHINA_PROVINCES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select name="city" required value={city} onChange={(event) => setCity(event.target.value)} disabled={!province} className={fieldWithoutMarginClass}>
                  <option value="">选择市级地区</option>{cityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="app-card rounded-3xl border p-5 sm:p-6">
        <SectionTitle icon={GraduationCap} title="教育经历与在校成绩" description="按照当前或最近就读阶段填写，毕业日期请使用年.月.日格式。" />
        <div className="mt-6 grid max-w-[780px] gap-x-5 gap-y-4 sm:grid-cols-2">
          <label className="text-sm font-black">教育阶段
            <select name="educationLevel" required value={educationLevel} onChange={(event) => setEducationLevel(event.target.value)} className={compactFieldClass}>
              <option value="">请选择</option><option value="bachelor">本科</option><option value="associate">大专</option><option value="high_school">高中</option><option value="secondary_vocational">中专</option><option value="technical_school">技工学校</option>
            </select>
          </label>
          <label className="text-sm font-black">就读状态
            <select name="educationStatus" required value={educationStatus} onChange={(event) => setEducationStatus(event.target.value)} className={compactFieldClass}>
              <option value="">请选择</option><option value="graduated">毕业</option><option value="studying">在读</option>
            </select>
          </label>
          <label className="text-sm font-black">{educationStatus === "studying" ? "预计毕业日期" : "毕业日期"}
            <input
              name="completionDate"
              type="text"
              required
              inputMode="numeric"
              maxLength={10}
              pattern="[0-9]{4}\.(0[1-9]|1[0-2])\.(0[1-9]|[12][0-9]|3[01])"
              placeholder="例如：2020.06.01"
              title="请按照 2020.06.01 的格式填写"
              value={completionDate}
              onChange={(event) => setCompletionDate(event.target.value)}
              aria-invalid={completionDateWarning || Boolean(state.fieldErrors?.completionDate)}
              className={compactFieldClass}
              style={completionDateWarning ? { borderColor: "#dc2626" } : undefined}
            />
            {(completionDateWarning || state.fieldErrors?.completionDate) ? (
              <span className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-red-600"><AlertCircle size={13} aria-hidden="true" />{state.fieldErrors?.completionDate ?? "日期格式必须为 2020.06.01，并且日期真实有效。"}</span>
            ) : (
              <span className="mt-1.5 block text-[11px] font-medium app-muted-text">格式：年.月.日，例如 2020.06.01</span>
            )}
          </label>
          <label className="text-sm font-black">平均成绩（百分制）
            <span className="app-input mt-2 flex max-w-[240px] items-center overflow-hidden rounded-2xl border" style={academicAverageWarning ? { borderColor: "#dc2626" } : undefined}>
              <input
                name="academicAverage"
                type="number"
                required
                min="0"
                max="100"
                step="0.01"
                inputMode="decimal"
                value={academicAverage}
                onChange={(event) => setAcademicAverage(event.target.value)}
                placeholder="例如：86.50"
                aria-invalid={academicAverageWarning || Boolean(state.fieldErrors?.academicAverage)}
                className="min-w-0 flex-1 bg-transparent px-3.5 py-3 text-sm font-semibold outline-none"
              />
              <span className="border-l px-3 text-sm font-black app-muted-text app-divider">%</span>
            </span>
            {(academicAverageWarning || state.fieldErrors?.academicAverage) ? (
              <span className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-red-600"><AlertCircle size={13} aria-hidden="true" />{state.fieldErrors?.academicAverage ?? "平均成绩必须在 0—100 之间，不能超过 100。"}</span>
            ) : (
              <span className="mt-1.5 block text-[11px] font-medium app-muted-text">请输入 0—100 之间的百分制成绩</span>
            )}
          </label>

          {needsGaokao && (
            <div className="app-soft-card rounded-2xl border p-4 sm:col-span-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-black">高考成绩
                  <select name="gaokaoHasScore" required value={gaokaoHasScore} onChange={(event) => setGaokaoHasScore(event.target.value)} className={shortFieldClass}>
                    <option value="">请选择</option><option value="yes">有</option><option value="no">无</option>
                  </select>
                </label>
                {gaokaoHasScore === "yes" && <label className="text-sm font-black">高考分数
                  <input name="gaokaoScore" type="number" required min="0" max="750" step="0.01" defaultValue={initialValue.gaokaoScore} className={shortFieldClass} />
                </label>}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="app-card rounded-3xl border p-5 sm:p-6">
        <SectionTitle icon={Gauge} title="能力评估" description="选择最接近当前水平的等级，后续可以随学习进度更新。" />
        <div className="mt-5 grid max-w-[720px] grid-cols-3 gap-1.5 sm:grid-cols-6">
          {ABILITY_LEVELS.map(([level, description]) => <div key={level} className="app-soft-card rounded-xl border px-2 py-2 text-center"><strong className="block text-xs">{level}</strong><span className="text-[10px] app-muted-text">{description}</span></div>)}
        </div>
        <div className="mt-5 grid max-w-[900px] gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          {[{ name: "englishLevel", label: "英语能力", value: initialValue.englishLevel }, { name: "mathLevel", label: "数学能力", value: initialValue.mathLevel }].map((item) => (
            <label key={item.name} className="text-sm font-black">{item.label}
              <select name={item.name} required defaultValue={item.value} className={compactFieldClass}>
                <option value="">请选择</option>{ABILITY_LEVELS.map(([level, description]) => <option key={level} value={level}>{level} · {description}</option>)}
              </select>
            </label>
          ))}
          <label className="text-sm font-black"><span className="flex items-center gap-2"><BriefcaseBusiness size={15} aria-hidden="true" />工作经历</span>
            <select name="hasWorkExperience" required defaultValue={booleanValue(initialValue.hasWorkExperience)} className={shortFieldClass}>
              <option value="">请选择</option><option value="yes">有</option><option value="no">无</option>
            </select>
          </label>

          {/* 韩语证书属于语言证明，单独成组后不会挤乱通用能力与工作经历的网格。 */}
          <div className="app-soft-card rounded-2xl border p-4 sm:col-span-2 xl:col-span-3">
            <div className="mb-3">
              <p className="text-sm font-black">韩语能力证明</p>
              <p className="mt-1 text-[11px] app-muted-text">没有韩语成绩也可以正常保存，后续取得 TOPIK 成绩后再补充。</p>
            </div>
            <div className="grid max-w-[520px] gap-4 sm:grid-cols-2">
              <label className="text-sm font-black">是否已有韩语成绩
                <select name="hasKorean" required value={hasKorean} onChange={(event) => setHasKorean(event.target.value)} className={shortFieldClass}>
                  <option value="">请选择</option><option value="yes">有</option><option value="no">无</option>
                </select>
              </label>
              {hasKorean === "yes" && <label className="text-sm font-black">TOPIK 等级
                <select name="topikLevel" required defaultValue={initialValue.topikLevel} className={shortFieldClass}>
                  <option value="">请选择</option>{[1, 2, 3, 4, 5, 6].map((level) => <option key={level} value={level}>TOPIK {level} 级</option>)}
                </select>
              </label>}
            </div>
          </div>
        </div>
      </section>

      {state.message && <p aria-live="polite" className="app-card flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold" style={state.status === "success" ? { color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" } : { color: "#dc2626", backgroundColor: "#fef2f2" }}>{state.status === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}{state.message}</p>}

      {/* 保存区跟随表单正常排版，避免手机端悬浮按钮遮挡输入项。 */}
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" style={{ backgroundColor: "var(--app-accent)" }}>
          {pending ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
          {pending ? "正在保存资料" : "保存全部资料"}
        </button>
      </div>
    </form>
  );
}
