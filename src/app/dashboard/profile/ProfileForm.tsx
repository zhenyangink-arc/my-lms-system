"use client";

import { ChangeEvent, useActionState, useMemo, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Gauge,
  GraduationCap,
  LoaderCircle,
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

function ProfileTableSection({
  icon: Icon,
  title,
}: {
  icon: typeof UserRound;
  title: string;
}) {
  return (
    <tr
      className="border-y"
      style={{
        backgroundColor: "color-mix(in srgb, var(--app-accent-soft) 58%, var(--app-accent) 42%)",
        borderColor: "color-mix(in srgb, var(--app-accent) 62%, var(--app-border))",
      }}
    >
      <th colSpan={3} className="px-4 py-4 text-left sm:px-5">
        <span className="flex items-center gap-2.5 text-base font-black" style={{ color: "var(--app-accent-strong)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/65">
            <Icon size={18} style={{ color: "var(--app-accent)" }} aria-hidden="true" />
          </span>
          {title}
        </span>
      </th>
    </tr>
  );
}

function ProfileTableRow({
  number,
  label,
  children,
}: {
  number: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr className="border-t align-top app-divider">
      <td className="w-14 px-3 py-4 text-center sm:w-16 sm:px-4 sm:py-5">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}>
          {number}
        </span>
      </td>
      <th scope="row" className="w-32 px-3 py-5 text-left text-sm font-black sm:w-44 sm:px-5">
        {label}
      </th>
      <td className="min-w-[260px] px-3 py-4 sm:px-5 sm:py-5">{children}</td>
    </tr>
  );
}

const fieldClass = "profile-table-input w-full rounded-2xl border px-3.5 py-3 text-sm font-semibold outline-none transition";

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

  const abilityRowStart = needsGaokao ? 11 : 10;

  return (
    <form action={formAction} className="app-card overflow-hidden rounded-3xl border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse">
          <colgroup>
            <col className="w-16" />
            <col className="w-44" />
            <col />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: "color-mix(in srgb, var(--app-secondary) 68%, var(--app-text-soft) 32%)" }}>
              <th className="px-3 py-4 text-center text-sm font-black text-white">序号</th>
              <th className="px-5 py-4 text-left text-sm font-black text-white">填写项目</th>
              <th className="px-5 py-4 text-left text-sm font-black text-white">填写内容</th>
            </tr>
          </thead>
          <tbody>
            <ProfileTableSection icon={UserRound} title="基本信息" />
            <ProfileTableRow number={1} label="个人照片">
              <div className="flex items-center gap-4">
                <span
                  className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-cover bg-center text-xl font-black"
                  style={{
                    color: "var(--app-secondary)",
                    backgroundColor: "var(--app-soft-bg)",
                    backgroundImage: photoPreview ? `url("${photoPreview}")` : undefined,
                  }}
                >
                  {!photoPreview && (initialValue.fullName.slice(0, 1) || "学")}
                </span>
                <label className="profile-table-input inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black">
                  <Camera size={15} aria-hidden="true" />上传照片
                  <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handlePhotoChange} />
                </label>
              </div>
            </ProfileTableRow>
            <ProfileTableRow number={2} label="真实姓名">
              <input name="fullName" required minLength={2} maxLength={50} autoComplete="name" defaultValue={initialValue.fullName} className={fieldClass} />
              {state.fieldErrors?.fullName && <span className="mt-1.5 block text-xs text-red-600">{state.fieldErrors.fullName}</span>}
            </ProfileTableRow>
            <ProfileTableRow number={3} label="性别">
              <div className="grid max-w-sm grid-cols-2 gap-2">
                {[["male", "男"], ["female", "女"]].map(([value, label]) => (
                  <label key={value} className="profile-table-input flex cursor-pointer items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold">
                    <input name="gender" type="radio" value={value} required defaultChecked={initialValue.gender === value} className="accent-[var(--app-accent)]" />{label}
                  </label>
                ))}
              </div>
            </ProfileTableRow>
            <ProfileTableRow number={4} label="出生日期">
              <div className="profile-table-input grid max-w-xl grid-cols-[1.3fr_1fr_1fr] overflow-hidden rounded-2xl border">
                <select name="birthYear" required value={birthYear} onChange={(event) => setBirthYear(event.target.value)} className="bg-transparent px-3 py-3 text-sm font-semibold outline-none" aria-label="出生年份">
                  <option value="">年</option>{BIRTH_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
                <select name="birthMonth" required value={birthMonth} onChange={(event) => setBirthMonth(event.target.value)} className="app-divider border-l bg-transparent px-3 py-3 text-sm font-semibold outline-none" aria-label="出生月份">
                  <option value="">月</option>{MONTHS.map((month) => <option key={month} value={month}>{month}</option>)}
                </select>
                <select name="birthDay" required value={birthDay} onChange={(event) => setBirthDay(event.target.value)} className="app-divider border-l bg-transparent px-3 py-3 text-sm font-semibold outline-none" aria-label="出生日期">
                  <option value="">日</option>{dayOptions.map((day) => <option key={day} value={day}>{day}</option>)}
                </select>
              </div>
            </ProfileTableRow>
            <ProfileTableRow number={5} label="居住地址">
              <div className="profile-table-input grid max-w-xl grid-cols-2 overflow-hidden rounded-2xl border">
                <select name="province" required value={province} onChange={handleProvinceChange} className="bg-transparent px-3.5 py-3 text-sm font-semibold outline-none">
                  <option value="">省级地区</option>{CHINA_PROVINCES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select name="city" required value={city} onChange={(event) => setCity(event.target.value)} disabled={!province} className="app-divider border-l bg-transparent px-3.5 py-3 text-sm font-semibold outline-none disabled:opacity-50">
                  <option value="">市级地区</option>{cityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </ProfileTableRow>

            <ProfileTableSection icon={GraduationCap} title="教育经历与在校成绩" />
            <ProfileTableRow number={6} label="教育阶段">
              <select name="educationLevel" required value={educationLevel} onChange={(event) => setEducationLevel(event.target.value)} className={fieldClass}>
                <option value="">请选择</option><option value="bachelor">本科</option><option value="associate">大专</option><option value="high_school">高中</option><option value="secondary_vocational">中专</option><option value="technical_school">技工学校</option>
              </select>
            </ProfileTableRow>
            <ProfileTableRow number={7} label="就读状态">
              <select name="educationStatus" required value={educationStatus} onChange={(event) => setEducationStatus(event.target.value)} className={fieldClass}>
                <option value="">请选择</option><option value="graduated">毕业</option><option value="studying">在读</option>
              </select>
            </ProfileTableRow>
            <ProfileTableRow number={8} label={educationStatus === "studying" ? "预计毕业日期" : "毕业日期"}>
              <input
                name="completionDate" type="text" required inputMode="numeric" maxLength={10}
                pattern="[0-9]{4}\.(0[1-9]|1[0-2])\.(0[1-9]|[12][0-9]|3[01])"
                placeholder="例如：2020.06.01" title="请按照 2020.06.01 的格式填写"
                value={completionDate} onChange={(event) => setCompletionDate(event.target.value)}
                aria-invalid={completionDateWarning || Boolean(state.fieldErrors?.completionDate)}
                className={fieldClass} style={completionDateWarning ? { borderColor: "#dc2626" } : undefined}
              />
              {(completionDateWarning || state.fieldErrors?.completionDate) && (
                <span className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-red-600"><AlertCircle size={13} aria-hidden="true" />{state.fieldErrors?.completionDate ?? "日期格式不正确。"}</span>
              )}
            </ProfileTableRow>
            <ProfileTableRow number={9} label="平均成绩（百分制）">
              <span className="profile-table-input flex items-center overflow-hidden rounded-2xl border" style={academicAverageWarning ? { borderColor: "#dc2626" } : undefined}>
                <input
                  name="academicAverage" type="number" required min="0" max="100" step="0.01" inputMode="decimal"
                  value={academicAverage} onChange={(event) => setAcademicAverage(event.target.value)} placeholder="例如：86.50"
                  aria-invalid={academicAverageWarning || Boolean(state.fieldErrors?.academicAverage)}
                  className="min-w-0 flex-1 bg-transparent px-3.5 py-3 text-sm font-semibold outline-none"
                />
                <span className="border-l px-3 text-sm font-black app-muted-text app-divider">%</span>
              </span>
              {(academicAverageWarning || state.fieldErrors?.academicAverage) && (
                <span className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-red-600"><AlertCircle size={13} aria-hidden="true" />{state.fieldErrors?.academicAverage ?? "成绩必须在 0—100 之间。"}</span>
              )}
            </ProfileTableRow>
            {needsGaokao && (
              <ProfileTableRow number={10} label="高考成绩">
                <div className="grid gap-3 sm:grid-cols-2">
                  <select name="gaokaoHasScore" required value={gaokaoHasScore} onChange={(event) => setGaokaoHasScore(event.target.value)} className={fieldClass}>
                    <option value="">请选择有或无</option><option value="yes">有</option><option value="no">无</option>
                  </select>
                  {gaokaoHasScore === "yes" && <input name="gaokaoScore" aria-label="高考分数" type="number" required min="0" max="750" step="0.01" placeholder="高考分数" defaultValue={initialValue.gaokaoScore} className={fieldClass} />}
                </div>
              </ProfileTableRow>
            )}

            <ProfileTableSection icon={Gauge} title="能力评估" />
            <ProfileTableRow number={abilityRowStart} label="英语能力">
              <select name="englishLevel" required defaultValue={initialValue.englishLevel} className={fieldClass}>
                <option value="">请选择</option>{ABILITY_LEVELS.map(([level, description], index) => <option key={level} value={level}>第 {index + 1} 级 · {description}</option>)}
              </select>
            </ProfileTableRow>
            <ProfileTableRow number={abilityRowStart + 1} label="数学能力">
              <select name="mathLevel" required defaultValue={initialValue.mathLevel} className={fieldClass}>
                <option value="">请选择</option>{ABILITY_LEVELS.map(([level, description], index) => <option key={level} value={level}>第 {index + 1} 级 · {description}</option>)}
              </select>
            </ProfileTableRow>
            <ProfileTableRow number={abilityRowStart + 2} label="韩语能力">
              <div className="grid gap-3 sm:grid-cols-2">
                <select name="hasKorean" required value={hasKorean} onChange={(event) => setHasKorean(event.target.value)} className={fieldClass}>
                  <option value="">请选择有或无</option><option value="yes">有韩语成绩</option><option value="no">无韩语成绩</option>
                </select>
                {hasKorean === "yes" && <select name="topikLevel" required aria-label="韩国语能力考试等级" defaultValue={initialValue.topikLevel} className={fieldClass}>
                  <option value="">请选择韩国语能力考试等级</option>{[1, 2, 3, 4, 5, 6].map((level) => <option key={level} value={level}>韩国语能力考试 {level} 级</option>)}
                </select>}
              </div>
            </ProfileTableRow>
            <ProfileTableRow number={abilityRowStart + 3} label="工作经历">
              <select name="hasWorkExperience" required defaultValue={booleanValue(initialValue.hasWorkExperience)} className={fieldClass}>
                <option value="">请选择</option><option value="yes">有</option><option value="no">无</option>
              </select>
            </ProfileTableRow>
          </tbody>
        </table>
      </div>

      {state.message && <p aria-live="polite" className="mx-4 mt-5 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold sm:mx-6" style={state.status === "success" ? { color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" } : { color: "#dc2626", backgroundColor: "#fef2f2" }}>{state.status === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}{state.message}</p>}

      <div className="flex flex-col gap-3 border-t p-4 app-divider sm:flex-row sm:items-center sm:justify-between sm:p-6" style={{ backgroundColor: "var(--app-soft-bg)" }}>
        <p className="text-sm font-bold app-muted-text">请确认全部项目后统一保存。</p>
        <button type="submit" disabled={pending} className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" style={{ backgroundColor: "var(--app-accent)" }}>
          {pending ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
          {pending ? "正在保存资料" : "保存全部资料"}
        </button>
      </div>
    </form>
  );
}
