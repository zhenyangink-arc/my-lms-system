import Link from "next/link";

export type QuestionBankSection = "chapter" | "homework" | "exam";

const sections: Array<{
  key: QuestionBankSection;
  label: string;
}> = [
  {
    key: "chapter",
    label: "章节测试题库",
  },
  {
    key: "homework",
    label: "作业题库",
  },
  {
    key: "exam",
    label: "考试题库",
  },
];

export function QuestionBankSectionNav({
  active,
}: {
  active: QuestionBankSection;
}) {
  return (
    <nav
      aria-label="平台题库分区"
      className="grid border sm:grid-cols-3"
      style={{ borderColor: "var(--app-border)" }}
    >
      {sections.map((section) => {
        const selected = section.key === active;
        return (
          <Link
            key={section.key}
            href={`?bank=${section.key}`}
            aria-current={selected ? "page" : undefined}
            className="border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-[var(--app-soft-bg)] sm:border-b-0 sm:border-r sm:last:border-r-0"
            style={
              selected
                ? {
                    color: "var(--app-secondary)",
                    backgroundColor: "var(--app-secondary-soft)",
                  }
                : undefined
            }
          >
            <span className="block text-sm font-black">{section.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
