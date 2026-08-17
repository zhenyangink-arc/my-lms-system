import {
  CardTitleWithHint,
  type CardTitleWithHintProps,
} from "@/components/ui/card-title-with-hint";

export type DashboardTitleWithHintProps = CardTitleWithHintProps;

export function DashboardTitleWithHint({
  className = "",
  titleClassName = "font-bold tracking-tight",
  hintClassName = "",
  ...props
}: DashboardTitleWithHintProps) {
  return (
    <CardTitleWithHint
      {...props}
      className={`dashboard-title-with-hint ${className}`}
      titleClassName={`dashboard-title-heading ${titleClassName}`}
      hintClassName={`dashboard-title-hint ${hintClassName}`}
    />
  );
}
