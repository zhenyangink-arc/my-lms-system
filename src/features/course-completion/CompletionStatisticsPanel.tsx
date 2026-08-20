import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import type {
  CompletionStatistics,
  InstitutionCompletionStatistics,
  PlatformCompletionStatistics,
  PlatformCompletionTrendPoint,
} from "./statistics-types";

const categoryLabels: Record<string, string> = {
  course: "课程与教材",
  assignment: "必修作业",
  chapter_exam: "章节考试",
  stage_exam: "阶段考试",
  midterm_exam: "期中考试",
  final_exam: "期末考试",
  manual_grading: "人工批改",
  overall_score: "综合成绩",
  chapter_practice: "章节巩固",
  specialized_practice: "专项练习",
  review: "错题复习",
};

function formatRate(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatMonth(value: string) {
  const [year, month] = value.slice(0, 7).split("-");
  return `${year}年${Number(month)}月`;
}

function RateCard({
  title,
  description,
  rate,
  completed,
  total,
}: {
  title: string;
  description: string;
  rate: number;
  completed: number;
  total: number;
}) {
  return (
    <article className="min-h-36 border bg-[var(--surface-soft)] p-4">
      <CardTitleWithHint
        title={title}
        description={description}
        headingLevel={3}
        titleClassName="text-sm font-medium text-[var(--foreground-secondary)]"
        hintLabel={`查看${title}统计口径`}
      />
      <strong className="mt-3 block text-3xl font-semibold tabular-nums">
        {formatRate(rate)}
      </strong>
      <span className="app-muted-text mt-2 block text-sm tabular-nums">
        {completed} / {total}
      </span>
    </article>
  );
}

function InstitutionStatistics({
  statistics,
}: {
  statistics: InstitutionCompletionStatistics;
}) {
  const largestGap = statistics.gaps[0]?.count ?? 0;

  return (
    <section className="space-y-4" aria-label="结课统计">
      <div className="app-card border p-4 sm:p-5">
        <CardTitleWithHint
          title="结课统计"
          description="只统计本机构当前未被替代的资格记录；符合资格率以全部当前资格记录为分母，颁发率以符合资格记录为分母，并只计仍然有效的证书。"
          headingLevel={2}
          titleClassName="text-lg font-semibold"
          hintLabel="查看结课统计范围与口径"
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <RateCard
            title="符合资格率"
            description="状态为符合资格且资格结果为通过的记录，占当前资格记录总数的比例。"
            rate={statistics.eligibleRate}
            completed={statistics.eligibleCount}
            total={statistics.totalEvaluations}
          />
          <RateCard
            title="颁发率"
            description="已有有效证书的资格记录，占符合资格记录数的比例；已撤销或已被替代的旧证书不计入。"
            rate={statistics.issuanceRate}
            completed={statistics.issuedCount}
            total={statistics.eligibleCount}
          />
          <article className="min-h-36 border bg-[var(--surface-soft)] p-4">
            <CardTitleWithHint
              title="当前资格记录"
              description="每名学生、课程和当前政策计算产生的最新记录；历史替代记录不计入。"
              headingLevel={3}
              titleClassName="text-sm font-medium text-[var(--foreground-secondary)]"
              hintLabel="查看当前资格记录口径"
            />
            <strong className="mt-3 block text-3xl font-semibold tabular-nums">
              {statistics.totalEvaluations}
            </strong>
            <span className="app-muted-text mt-2 block text-sm tabular-nums">
              共 {statistics.missingRequirementCount} 项未达标缺口
            </span>
          </article>
        </div>
      </div>

      <section className="app-card border p-4 sm:p-5">
        <CardTitleWithHint
          title="主要未达标缺口"
          description="逐条展开当前资格记录的缺口数组，并按缺口键和类别在数据库内聚合；同一学生可能有多个缺口。"
          headingLevel={2}
          titleClassName="text-base font-semibold"
          hintLabel="查看未达标缺口统计口径"
        />
        {statistics.gaps.length === 0 ? (
          <p className="app-muted-text mt-4 text-sm">当前没有未达标缺口。</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {statistics.gaps.map((gap) => (
              <li key={`${gap.category}:${gap.key}`}>
                <div className="flex items-start justify-between gap-4 text-sm">
                  <div className="min-w-0">
                    <span className="block break-words font-medium">{gap.title}</span>
                    <span className="app-muted-text mt-1 block break-all text-xs">
                      {categoryLabels[gap.category] ?? gap.category} · {gap.key}
                    </span>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{gap.count} 次</span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]"
                  role="img"
                  aria-label={`${gap.title}缺口 ${gap.count} 次`}
                >
                  <span
                    className="block h-full rounded-full bg-[var(--primary)]"
                    style={{ width: `${largestGap ? (gap.count / largestGap) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}

type TrendSeries = {
  key: string;
  label: string;
  points: PlatformCompletionTrendPoint[];
};

function buildSeries(trend: PlatformCompletionTrendPoint[]): TrendSeries[] {
  const grouped = new Map<string, TrendSeries>();
  for (const point of trend) {
    const key = `${point.policyId}:${point.policyVersion}`;
    const series = grouped.get(key) ?? {
      key,
      label: `${point.policyCode} 第 ${point.policyVersion} 版`,
      points: [],
    };
    series.points.push(point);
    grouped.set(key, series);
  }
  return [...grouped.values()];
}

const chartStyles = [
  { color: "var(--primary)", dash: undefined },
  { color: "var(--status-warning)", dash: "10 6" },
  { color: "var(--status-danger)", dash: "3 5" },
  { color: "var(--foreground-secondary)", dash: "12 4 3 4" },
] as const;

function CompletionTrendChart({ trend }: { trend: PlatformCompletionTrendPoint[] }) {
  const periods = [...new Set(trend.map((point) => point.periodStart))].sort();
  const series = buildSeries(trend);
  const width = 760;
  const height = 260;
  const left = 48;
  const top = 20;
  const plotWidth = width - left - 20;
  const plotHeight = height - top - 44;
  const x = (period: string) => {
    const index = periods.indexOf(period);
    return left + (periods.length === 1 ? plotWidth / 2 : (index / (periods.length - 1)) * plotWidth);
  };
  const y = (rate: number) => top + plotHeight - (Math.min(100, rate) / 100) * plotHeight;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs" aria-label="政策版本图例">
        {series.map((item, index) => {
          const style = chartStyles[index % chartStyles.length];
          return (
            <span key={item.key} className="inline-flex items-center gap-2">
              <svg width="28" height="8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="28"
                  y2="4"
                  stroke={style.color}
                  strokeWidth="3"
                  strokeDasharray={style.dash}
                />
              </svg>
              {item.label}
            </span>
          );
        })}
      </div>
      <div
        className="mt-3 overflow-x-auto rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
        tabIndex={0}
        aria-label="符合资格率月度折线图"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[680px]"
          role="img"
          aria-labelledby="completion-trend-chart-title completion-trend-chart-description"
        >
          <title id="completion-trend-chart-title">按政策版本区分的符合资格率月度趋势</title>
          <desc id="completion-trend-chart-description">
            横轴为统计月份，纵轴为符合资格率。不同政策版本使用不同颜色和线型，精确数字见下方数据表。
          </desc>
          {[0, 25, 50, 75, 100].map((tick) => (
            <g key={tick}>
              <line
                x1={left}
                y1={y(tick)}
                x2={left + plotWidth}
                y2={y(tick)}
                stroke="currentColor"
                opacity="0.12"
              />
              <text x={left - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="currentColor">
                {tick}%
              </text>
            </g>
          ))}
          {periods.map((period) => (
            <text
              key={period}
              x={x(period)}
              y={height - 14}
              textAnchor="middle"
              fontSize="11"
              fill="currentColor"
            >
              {period.slice(0, 7)}
            </text>
          ))}
          {series.map((item, index) => {
            const style = chartStyles[index % chartStyles.length];
            const sorted = [...item.points].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
            const path = sorted
              .map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"}${x(point.periodStart)},${y(point.eligibleRate)}`)
              .join(" ");
            return (
              <g key={item.key}>
                <path
                  d={path}
                  fill="none"
                  stroke={style.color}
                  strokeWidth="3"
                  strokeDasharray={style.dash}
                />
                {sorted.map((point) => (
                  <circle
                    key={point.periodStart}
                    cx={x(point.periodStart)}
                    cy={y(point.eligibleRate)}
                    r="4"
                    fill="var(--background)"
                    stroke={style.color}
                    strokeWidth="3"
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function TrendRows({ trend }: { trend: PlatformCompletionTrendPoint[] }) {
  return (
    <>
      <div className="mt-4 grid gap-3 md:hidden">
        {trend.map((point) => (
          <article key={`${point.periodStart}:${point.policyId}:${point.policyVersion}`} className="border bg-[var(--surface-soft)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{point.policyCode} 第 {point.policyVersion} 版</h3>
                <p className="app-muted-text mt-1 text-xs">{formatMonth(point.periodStart)}</p>
              </div>
              <span className="shrink-0 text-xs tabular-nums">{point.institutionCount} 家机构</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="app-muted-text text-xs">符合资格率</dt><dd className="mt-1 font-semibold tabular-nums">{formatRate(point.eligibleRate)}（{point.eligibleCount}/{point.totalEvaluations}）</dd></div>
              <div><dt className="app-muted-text text-xs">颁发率</dt><dd className="mt-1 font-semibold tabular-nums">{formatRate(point.issuanceRate)}（{point.issuedCount}/{point.eligibleCount}）</dd></div>
            </dl>
          </article>
        ))}
      </div>
      <div
        className="mt-4 hidden overflow-x-auto rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 md:block"
        tabIndex={0}
        aria-label="跨机构结课趋势数据表"
      >
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[var(--surface-soft)] text-xs text-[var(--foreground-secondary)]">
            <tr>
              <th scope="col" className="px-3 py-3 font-medium">月份</th>
              <th scope="col" className="px-3 py-3 font-medium">政策版本</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">机构</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">资格记录</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">符合资格率</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">颁发率</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((point) => (
              <tr key={`${point.periodStart}:${point.policyId}:${point.policyVersion}`} className="border-t">
                <td className="px-3 py-3 tabular-nums">{formatMonth(point.periodStart)}</td>
                <th scope="row" className="px-3 py-3 font-medium">{point.policyCode} 第 {point.policyVersion} 版</th>
                <td className="px-3 py-3 text-right tabular-nums">{point.institutionCount}</td>
                <td className="px-3 py-3 text-right tabular-nums">{point.totalEvaluations}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatRate(point.eligibleRate)} <span className="app-muted-text text-xs">{point.eligibleCount}/{point.totalEvaluations}</span></td>
                <td className="px-3 py-3 text-right tabular-nums">{formatRate(point.issuanceRate)} <span className="app-muted-text text-xs">{point.issuedCount}/{point.eligibleCount}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PlatformStatistics({ statistics }: { statistics: PlatformCompletionStatistics }) {
  const policyCount = new Set(
    statistics.trend.map((point) => `${point.policyId}:${point.policyVersion}`),
  ).size;
  const institutionCount = Math.max(0, ...statistics.trend.map((point) => point.institutionCount));
  const showChart = statistics.trend.length >= 4 && new Set(statistics.trend.map((point) => point.periodStart)).size >= 2;

  return (
    <section className="app-card border p-4 sm:p-5" aria-label="跨机构结课趋势">
      <CardTitleWithHint
        title="跨机构结课趋势"
        description="按首尔时区月份和政策编号、版本聚合当前资格记录。不同政策编号或版本始终作为独立系列；颁发率只计仍然有效的证书。"
        headingLevel={2}
        titleClassName="text-lg font-semibold"
        hintLabel="查看跨机构结课趋势统计口径"
      />
      {statistics.trend.length === 0 ? (
        <p className="app-muted-text mt-4 text-sm">当前还没有可用于趋势统计的结课资格记录。</p>
      ) : (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="border bg-[var(--surface-soft)] p-4"><dt className="app-muted-text text-xs">政策版本</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{policyCount}</dd></div>
            <div className="border bg-[var(--surface-soft)] p-4"><dt className="app-muted-text text-xs">单月最多覆盖机构</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{institutionCount}</dd></div>
          </dl>
          {showChart ? <CompletionTrendChart trend={statistics.trend} /> : null}
          <TrendRows trend={statistics.trend} />
        </>
      )}
    </section>
  );
}

export function CompletionStatisticsPanel({ statistics }: { statistics: CompletionStatistics }) {
  return statistics.scope === "institution"
    ? <InstitutionStatistics statistics={statistics} />
    : <PlatformStatistics statistics={statistics} />;
}
